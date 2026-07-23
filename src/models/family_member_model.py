from datetime import datetime
from sqlalchemy import UniqueConstraint, String
from sqlalchemy.orm import Mapped, mapped_column
from src.database import Base

#любой участник семьи: родитель, ребенок, бабушка, няня
#это роль внутри конкретной семьи
class FamilyMemberModel(Base):
    __tablename__ = "family_members"
    __table_args__ = (
        UniqueConstraint("family_id", "nickname", name="uq_family_member_family_nickname"),
    ) #настройка ограничения уникальности на уровне таблицы базы данных
     #уникальность члена семьи по семье и никнейму

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] # в какой семье состоит участник
    parent_id: Mapped[int | None] = mapped_column(nullable=True) #ссылка на ParentModel, если участник является зарегистрированным родителем
    nickname: Mapped[str] #имя внутри семьи
    role: Mapped[str]
    created_by_parent_id: Mapped[int] #какой родитель добавил участника
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    archived_at: Mapped[datetime | None] = mapped_column(nullable=True)
    archived_by_parent_id: Mapped[int | None] = mapped_column(nullable=True)
