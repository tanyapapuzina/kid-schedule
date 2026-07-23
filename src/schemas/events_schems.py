from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

#Literal[...] - значение может быть только одним из перечисленных вариантов
EventCategory = Literal[
    "school",
    "sport",
    "doctor",
    "homework",
    "rest",
    "family",
    "other",
]

EventStatus = Literal[
    "planned",
    "done",
    "canceled",
]

#Схема входящего запроса на создание события
class EventCreateSchema(BaseModel):
    child_member_id: int # ID участника семьи, которому назначено событие
    title: str = Field(min_length=1, max_length=120) #Field задает правила валидации 
    description: str | None = Field(default=None, max_length=1000)
    starts_at: datetime
    ends_at: datetime
    all_day: bool = False
    category: EventCategory = "other"
    location: str | None = Field(default=None, max_length=255)
    recurrence_rule: str | None = None
    recurrence_until: datetime | None = None

#Схема изменения
class EventUpdateSchema(BaseModel):
    child_member_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    all_day: bool | None = None
    category: EventCategory | None = None
    status: EventStatus | None = None
    location: str | None = Field(default=None, max_length=255)
    recurrence_rule: str | None = None
    recurrence_until: datetime | None = None

#Схема ответа на бэк 
class EventSchema(BaseModel):
    id: int
    occurrence_id: str | None = None
    is_recurring_instance: bool = False
    family_id: int
    child_member_id: int
    created_by_member_id: int
    title: str
    description: str | None
    starts_at: datetime
    ends_at: datetime
    all_day: bool
    category: str
    status: str
    created_at: datetime
    updated_at: datetime
    location: str | None
    recurrence_rule: str | None
    recurrence_until: datetime | None

    class Config: # Config настраивает поведение Pydantic модели
        from_attributes = True # Разрешает создание экземпляра модели из атрибутов объекта

# для статистики событий
class EventCategoryStatsSchema(BaseModel):
    category: str
    events_count: int
    minutes: int

# для статистики событий по детям
class EventChildStatsSchema(BaseModel):
    child_member_id: int
    nickname: str
    events_count: int
    minutes: int

# для статистики событий по дням
class EventDayStatsSchema(BaseModel):
    date: str
    events_count: int
    minutes: int

# для общей статистики событий
class EventStatsSchema(BaseModel):
    total_events: int
    total_minutes: int
    by_category: list[EventCategoryStatsSchema]
    by_child: list[EventChildStatsSchema]
    by_day: list[EventDayStatsSchema]
