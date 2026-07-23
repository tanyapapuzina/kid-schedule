from __future__ import annotations

from collections import defaultdict #специальный словарь Python, меет автоматически создавать значение по умолчанию, 
from copy import copy
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from src.models.event_models import EventModel
from src.models.family_member_model import FamilyMemberModel
from src.repositories.event_repository import EventRepository
from src.repositories.family_member_repository import FamilyMemberRepository
from src.schemas.events_schems import EventCreateSchema, EventUpdateSchema

if TYPE_CHECKING:
    from src.api.dependencies import CurrentActor #объект “кто сейчас вошел”

ALLOWED_RECURRENCE_FREQ = {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"}
ALLOWED_RECURRENCE_DAYS = {"MO", "TU", "WE", "TH", "FR", "SA", "SU"}
WEEKDAY_BY_CODE = {
    "MO": 0,
    "TU": 1,
    "WE": 2,
    "TH": 3,
    "FR": 4,
    "SA": 5,
    "SU": 6,
}

ALLOWED_EVENT_CATEGORIES = {
    "school",
    "sport",
    "doctor",
    "homework",
    "rest",
    "family",
    "other",
}

ALLOWED_EVENT_STATUSES = {
    "planned",
    "done",
    "canceled",
}


class EventService:
    def __init__(
        self,
        event_repo: EventRepository,
        member_repo: FamilyMemberRepository,
    ):
        self.event_repo = event_repo
        self.member_repo = member_repo

    def get_actor_member(self, actor: CurrentActor) -> FamilyMemberModel:
        if actor.member is None:
            raise PermissionError("Сначала создайте семью.")

        if not actor.member.is_active:
            raise PermissionError("Участник больше не активен.")

        return actor.member

    def get_actor_family_id(self, actor: CurrentActor) -> int:
        actor_member = self.get_actor_member(actor)
        return actor_member.family_id

    def normalize_datetime(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value

        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def normalize_optional_datetime(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None

        return self.normalize_datetime(value)

    #проверить  , что выбранный ребенок принадлежит семье текущего пользователя
    async def ensure_child_from_actor_family(
        self,
        actor: CurrentActor,
        child_member_id: int,
    ) -> FamilyMemberModel:
        actor_family_id = self.get_actor_family_id(actor)
        child = await self.member_repo.get_member_by_id(child_member_id)

        if child is None:
            raise ValueError("Ребенок не найден.")

        if child.family_id != actor_family_id:
            raise PermissionError("Нельзя создать событие для участника чужой семьи.")

        if not child.is_active:
            raise ValueError("Нельзя создать событие для архивного участника.")

        if child.role != "child":
            raise ValueError("Событие можно назначить только участнику с ролью child.")

        return child

    def validate_event_dates(
        self,
        starts_at: datetime,
        ends_at: datetime,
    ) -> None:
        if ends_at <= starts_at:
            raise ValueError("Дата окончания должна быть позже даты начала.")

    def validate_category(self, category: str) -> None:
        if category not in ALLOWED_EVENT_CATEGORIES:
            raise ValueError("Некорректная категория события.")

    def validate_status(self, status: str) -> None:
        if status not in ALLOWED_EVENT_STATUSES:
            raise ValueError("Некорректный статус события.")

    def parse_recurrence_rule(self, recurrence_rule: str) -> dict[str, str]:
        rule_parts: dict[str, str] = {}

        for raw_part in recurrence_rule.split(";"):
            if "=" not in raw_part:
                raise ValueError("Некорректное правило повтора.")

            key, value = raw_part.split("=", 1)
            key = key.strip().upper()
            value = value.strip().upper()

            if not key or not value:
                raise ValueError("Некорректное правило повтора.")

            rule_parts[key] = value

        return rule_parts

    def validate_recurrence(
        self,
        recurrence_rule: str | None,
        recurrence_until: datetime | None,
        starts_at: datetime,
    ) -> None:
        if recurrence_until is not None and recurrence_until <= starts_at:
            raise ValueError("Дата окончания повтора должна быть позже начала события.")

        if recurrence_rule is None:
            return

        rule_parts = self.parse_recurrence_rule(recurrence_rule)
        frequency = rule_parts.get("FREQ")

        if frequency not in ALLOWED_RECURRENCE_FREQ:
            raise ValueError("Некорректная частота повтора.")

        if frequency == "WEEKLY":
            by_day = rule_parts.get("BYDAY")

            if by_day is None:
                raise ValueError("Для еженедельного повтора выберите дни недели.")

            days = {day.strip().upper() for day in by_day.split(",") if day.strip()}

            if not days or not days.issubset(ALLOWED_RECURRENCE_DAYS):
                raise ValueError("Некорректные дни недели в правиле повтора.")

    async def create_event(
        self,
        actor: CurrentActor,
        data: EventCreateSchema,
    ) -> EventModel:
        creator_member = self.get_actor_member(actor)
        starts_at = self.normalize_datetime(data.starts_at)
        ends_at = self.normalize_datetime(data.ends_at)
        recurrence_until = self.normalize_optional_datetime(data.recurrence_until)

        await self.ensure_child_from_actor_family(
            actor=actor,
            child_member_id=data.child_member_id,
        )

        self.validate_event_dates(starts_at, ends_at)
        self.validate_category(data.category)
        self.validate_recurrence(
            recurrence_rule=data.recurrence_rule,
            recurrence_until=recurrence_until,
            starts_at=starts_at,
        )

        event = EventModel(
            family_id=creator_member.family_id,
            child_member_id=data.child_member_id,
            created_by_member_id=creator_member.id,
            title=data.title.strip(),
            description=data.description.strip() if data.description else None,
            starts_at=starts_at,
            ends_at=ends_at,
            all_day=data.all_day,
            category=data.category,
            status="planned",
            location=data.location.strip() if data.location else None,
            recurrence_rule=data.recurrence_rule.strip().upper() if data.recurrence_rule else None,
            recurrence_until=recurrence_until,
        )

        return await self.event_repo.create_event(event)

    async def list_events(
        self,
        actor: CurrentActor,
        starts_at: datetime,
        ends_at: datetime,
    ) -> list[EventModel]:
        starts_at = self.normalize_datetime(starts_at)
        ends_at = self.normalize_datetime(ends_at)
        self.validate_event_dates(starts_at, ends_at)

        actor_member = self.get_actor_member(actor)

        if actor_member.role == "child":
            events = await self.event_repo.list_events_by_child_and_period(
                family_id=actor_member.family_id,
                child_member_id=actor_member.id,
                starts_at=starts_at,
                ends_at=ends_at,
            )
            return self.expand_recurring_events(events, starts_at, ends_at)

        events = await self.event_repo.list_events_by_family_and_period(
            family_id=actor_member.family_id,
            starts_at=starts_at,
            ends_at=ends_at,
        )
        return self.expand_recurring_events(events, starts_at, ends_at)

    #получает одно событие и проверяет, можно ли текущему пользователю его видеть
    async def get_event_for_actor(
        self,
        actor: CurrentActor,
        event_id: int,
    ) -> EventModel:
        actor_member = self.get_actor_member(actor)
        event = await self.event_repo.get_event_by_id(event_id)

        if event is None:
            raise ValueError("Событие не найдено.")

        if event.family_id != actor_member.family_id:
            raise PermissionError("У вас нет доступа к этому событию.")

        if actor_member.role == "child" and event.child_member_id != actor_member.id:
            raise PermissionError("У вас нет доступа к этому событию.")

        return event

    async def update_event(
        self,
        actor: CurrentActor,
        event_id: int,
        data: EventUpdateSchema,
    ) -> EventModel:
        actor_member = self.get_actor_member(actor)
        event = await self.get_event_for_actor(actor, event_id)

        if actor_member.role == "child":
            raise PermissionError("Ребенок пока не может изменять события.")

        update_data = data.model_dump(exclude_unset=True) #model_dump() превращает Pydantic-схему в словарь

        if "starts_at" in update_data and update_data["starts_at"] is not None:
            update_data["starts_at"] = self.normalize_datetime(update_data["starts_at"])

        if "ends_at" in update_data and update_data["ends_at"] is not None:
            update_data["ends_at"] = self.normalize_datetime(update_data["ends_at"])

        if "recurrence_until" in update_data and update_data["recurrence_until"] is not None:
            update_data["recurrence_until"] = self.normalize_datetime(update_data["recurrence_until"])

        if "child_member_id" in update_data:
            await self.ensure_child_from_actor_family(
                actor=actor,
                child_member_id=update_data["child_member_id"],
            )

        new_starts_at = update_data.get("starts_at", event.starts_at)
        new_ends_at = update_data.get("ends_at", event.ends_at)
        self.validate_event_dates(new_starts_at, new_ends_at)

        if "category" in update_data:
            self.validate_category(update_data["category"])

        if "status" in update_data:
            self.validate_status(update_data["status"])

        new_recurrence_rule = update_data.get("recurrence_rule", event.recurrence_rule)
        new_recurrence_until = update_data.get("recurrence_until", event.recurrence_until)
        self.validate_recurrence(
            recurrence_rule=new_recurrence_rule,
            recurrence_until=new_recurrence_until,
            starts_at=new_starts_at,
        )

        for field_name, field_value in update_data.items():
            if field_name == "title" and field_value is not None:
                field_value = field_value.strip()

            if field_name == "description" and field_value is not None:
                field_value = field_value.strip()

            if field_name == "location" and field_value is not None:
                field_value = field_value.strip()

            if field_name == "recurrence_rule" and field_value is not None:
                field_value = field_value.strip().upper()

            setattr(event, field_name, field_value)

        return await self.event_repo.save_event(event)

    def expand_recurring_events(
        self,
        events: list[EventModel],
        starts_at: datetime,
        ends_at: datetime,
    ) -> list[EventModel]:
        expanded_events: list[EventModel] = []

        for event in events:
            if event.recurrence_rule is None:
                if event.starts_at < ends_at and event.ends_at > starts_at:
                    expanded_events.append(event)
                continue

            expanded_events.extend(
                self.build_event_occurrences(
                    event=event,
                    period_starts_at=starts_at,
                    period_ends_at=ends_at,
                )
            )

        return sorted(expanded_events, key=lambda event: event.starts_at)

    def build_event_occurrences(
        self,
        event: EventModel,
        period_starts_at: datetime,
        period_ends_at: datetime,
    ) -> list[EventModel]:
        rule_parts = self.parse_recurrence_rule(event.recurrence_rule or "")
        frequency = rule_parts["FREQ"]
        duration = event.ends_at - event.starts_at
        recurrence_until = event.recurrence_until or period_ends_at
        recurrence_end = min(recurrence_until, period_ends_at)

        occurrences: list[EventModel] = []
        current_date = event.starts_at

        if frequency == "DAILY":
            while current_date < recurrence_end:
                self.add_occurrence_if_in_period(
                    occurrences=occurrences,
                    event=event,
                    occurrence_starts_at=current_date,
                    duration=duration,
                    period_starts_at=period_starts_at,
                    period_ends_at=period_ends_at,
                )
                current_date += timedelta(days=1)

        if frequency == "WEEKLY":
            days = {
                WEEKDAY_BY_CODE[day.strip().upper()]
                for day in rule_parts.get("BYDAY", "").split(",")
                if day.strip().upper() in WEEKDAY_BY_CODE
            }

            while current_date < recurrence_end:
                if current_date.weekday() in days:
                    self.add_occurrence_if_in_period(
                        occurrences=occurrences,
                        event=event,
                        occurrence_starts_at=current_date,
                        duration=duration,
                        period_starts_at=period_starts_at,
                        period_ends_at=period_ends_at,
                    )
                current_date += timedelta(days=1)

        if frequency == "MONTHLY":
            while current_date < recurrence_end:
                self.add_occurrence_if_in_period(
                    occurrences=occurrences,
                    event=event,
                    occurrence_starts_at=current_date,
                    duration=duration,
                    period_starts_at=period_starts_at,
                    period_ends_at=period_ends_at,
                )
                current_date = self.add_month(current_date)

        if frequency == "YEARLY":
            while current_date < recurrence_end:
                self.add_occurrence_if_in_period(
                    occurrences=occurrences,
                    event=event,
                    occurrence_starts_at=current_date,
                    duration=duration,
                    period_starts_at=period_starts_at,
                    period_ends_at=period_ends_at,
                )
                current_date = self.add_year(current_date)

        return occurrences

    def add_occurrence_if_in_period(
        self,
        occurrences: list[EventModel],
        event: EventModel,
        occurrence_starts_at: datetime,
        duration: timedelta,
        period_starts_at: datetime,
        period_ends_at: datetime,
    ) -> None:
        occurrence_ends_at = occurrence_starts_at + duration

        if occurrence_starts_at >= period_ends_at or occurrence_ends_at <= period_starts_at:
            return

        occurrence = copy(event)
        occurrence.starts_at = occurrence_starts_at
        occurrence.ends_at = occurrence_ends_at
        occurrence.occurrence_id = f"{event.id}:{occurrence_starts_at.isoformat()}"
        occurrence.is_recurring_instance = occurrence_starts_at != event.starts_at
        occurrences.append(occurrence)

    def add_month(self, date: datetime) -> datetime:
        month = date.month + 1
        year = date.year

        if month > 12:
            month = 1
            year += 1

        try:
            return date.replace(year=year, month=month)
        except ValueError:
            return date.replace(year=year, month=month, day=28)

    def add_year(self, date: datetime) -> datetime:
        try:
            return date.replace(year=date.year + 1)
        except ValueError:
            return date.replace(year=date.year + 1, day=28)

    async def delete_event(
        self,
        actor: CurrentActor,
        event_id: int,
    ) -> None:
        actor_member = self.get_actor_member(actor)
        event = await self.get_event_for_actor(actor, event_id)

        if actor_member.role == "child":
            raise PermissionError("Ребенок пока не может удалять события.")

        await self.event_repo.delete_event(event)

    #считает статистику событий за период
    async def get_stats(
        self,
        actor: CurrentActor,
        starts_at: datetime,
        ends_at: datetime,
    ) -> dict:
        actor_member = self.get_actor_member(actor)

        events = await self.list_events(
            actor=actor,
            starts_at=starts_at,
            ends_at=ends_at,
        )

        by_category = defaultdict(lambda: {"events_count": 0, "minutes": 0})
        by_child = defaultdict(lambda: {"nickname": "", "events_count": 0, "minutes": 0})
        by_day = defaultdict(lambda: {"events_count": 0, "minutes": 0})

        members = await self.member_repo.list_members_by_family_id(actor_member.family_id)
        member_names = {member.id: member.nickname for member in members}

        total_minutes = 0

        for event in events:
            minutes = int((event.ends_at - event.starts_at).total_seconds() // 60)
            total_minutes += minutes

            by_category[event.category]["events_count"] += 1
            by_category[event.category]["minutes"] += minutes

            child_stats = by_child[event.child_member_id]
            child_stats["nickname"] = member_names.get(event.child_member_id, "Участник")
            child_stats["events_count"] += 1
            child_stats["minutes"] += minutes

            day_key = event.starts_at.date().isoformat()
            by_day[day_key]["events_count"] += 1
            by_day[day_key]["minutes"] += minutes

        return {
            "total_events": len(events),
            "total_minutes": total_minutes,
            "by_category": [
                {
                    "category": category,
                    "events_count": values["events_count"],
                    "minutes": values["minutes"],
                }
                for category, values in by_category.items()
            ],
            "by_child": [
                {
                    "child_member_id": child_member_id,
                    "nickname": values["nickname"],
                    "events_count": values["events_count"],
                    "minutes": values["minutes"],
                }
                for child_member_id, values in by_child.items()
            ],
            "by_day": [
                {
                    "date": date,
                    "events_count": values["events_count"],
                    "minutes": values["minutes"],
                }
                for date, values in sorted(by_day.items())
            ],
        }
