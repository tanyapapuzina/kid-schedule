from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from src.database import Base

class EventModel(Base):
    __tablename__ = "events"

    #apped[int] говорит: это поле модели, которое SQLAlchemy связывает с колонкой таблицы
    #mapped_column(...) задает настройки колонки
    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int]
    child_member_id: Mapped[int] #Событие назначено ребенку
    created_by_member_id: Mapped[int] #Событие создал участник семьи

    title: Mapped[str]
    description: Mapped[str | None] = mapped_column(nullable=True)

    starts_at: Mapped[datetime]
    ends_at: Mapped[datetime]
    all_day: Mapped[bool] = mapped_column(default=False) #Флаг “на весь день”

    category: Mapped[str] = mapped_column(default="other") #Категория для фильтров и статистики
    status: Mapped[str] = mapped_column(default="planned")

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    #Поле обновляется при изменении записи
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    location: Mapped[str | None] = mapped_column(nullable=True)
    recurrence_rule: Mapped[str | None] = mapped_column(nullable=True) # Правила повторения события в формате iCalendar (например, "FREQ=WEEKLY;BYDAY=MO,WE,FR" для повторения по понедельникам, средам и пятницам)
    recurrence_until: Mapped[datetime | None] = mapped_column(nullable=True) # Дата, до которой событие будет повторяться, если оно является повторяющимся. Если None, то событие повторяется бесконечно.