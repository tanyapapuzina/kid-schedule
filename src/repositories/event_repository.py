from datetime import datetime
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.event_models import EventModel


class EventRepository:
    def __init__(self, session: AsyncSession): # Инициализируем репозиторий с асинхронной сессией базы данных. Это позволяет нам выполнять операции с базой данных в рамках этого репозитория, используя предоставленную сессию.
        self.session = session # Сохраняем сессию в атрибуте класса для дальнейшего использования в методах репозитория.

    async def create_event(self, event: EventModel) -> EventModel: # Принимаем объект EventModel и сохраняем его в базе данных
        self.session.add(event)
        await self.session.commit()
        await self.session.refresh(event)
        return event
    
    # Получаем событие по его ID. Если событие с заданным ID не найдено, то возвращаем None.
    async def get_event_by_id(self, event_id: int) -> EventModel | None:
        query = select(EventModel).where(EventModel.id == event_id)
        result = await self.session.execute(query)
        return result.scalars().first() # scalars() извлекает только значения столбцов из результата запроса, а first() возвращает первый результат или None, если результатов нет.
    

    #получить все события конкретной семьи за выбранный период
    async def list_events_by_family_and_period(
            self,
            family_id: int,
            starts_at: datetime,
            ends_at: datetime,
    ) -> list[EventModel]:
        query = (select(EventModel).where(
            EventModel.family_id == family_id,
            or_(
                and_(
                    EventModel.starts_at < ends_at,
                    EventModel.ends_at > starts_at,
                ),
                and_(
                    EventModel.recurrence_rule.is_not(None),
                    EventModel.starts_at < ends_at,
                    or_(
                        EventModel.recurrence_until.is_(None),
                        EventModel.recurrence_until > starts_at,
                    ),
                ),
            )
        ).order_by(EventModel.starts_at.asc())
        )
        #order_by — это сортировка. EventModel.starts_at — колонка “когда событие начинается”.
        # .asc() означает ascending, то есть по возрастанию.
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def list_events_by_child_and_period(
        self,
        family_id: int,
        child_member_id: int,
        starts_at: datetime,
        ends_at: datetime,
    ) -> list[EventModel]:
        query = (select(EventModel).where(
            EventModel.family_id == family_id,
            EventModel.child_member_id == child_member_id,
            or_(
                and_(
                    EventModel.starts_at < ends_at,
                    EventModel.ends_at > starts_at,
                ),
                and_(
                    EventModel.recurrence_rule.is_not(None),
                    EventModel.starts_at < ends_at,
                    or_(
                        EventModel.recurrence_until.is_(None),
                        EventModel.recurrence_until > starts_at,
                    ),
                ),
            )
        )
            .order_by(EventModel.starts_at.asc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())


    async def save_event(self, event: EventModel) -> EventModel:
        await self.session.commit()
        await self.session.refresh(event)
        return event


    async def delete_event(self, event: EventModel) -> None: # Удаляем событие по его ID. Если событие с заданным ID не найдено, то возвращаем False. Если событие найдено и успешно удалено, то возвращаем True.
        await self.session.delete(event)
        await self.session.commit()
    
