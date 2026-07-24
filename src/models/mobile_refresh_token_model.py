from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


'''Создаем SQLAlchemy ORM-модель.
Base — базовый класс из src/database.py. 
Через него SQLAlchemy понимает, что этот 
Python-класс должен стать таблицей.
'''
class MobileRefreshTokenModel(Base):
    __tablename__ = "mobile_refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)

    actor_type: Mapped[str] = mapped_column(String(30), index=True)
    
    '''Это связь с таблицей parents.
    ondelete="CASCADE" значит: если родитель удален,
    связанные refresh sessions тоже можно удалить на уровне базы.
    '''
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("parents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    '''Это связь с таблицей family_members.
    ondelete="CASCADE" значит: если член семьи удален,
    связанные refresh sessions тоже можно удалить на уровне базы.
    '''
    family_member_id: Mapped[int | None] = mapped_column(
        ForeignKey("family_members.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)

    issued_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True, index=True)

    replaced_by_token_id: Mapped[int | None] = mapped_column(
        ForeignKey("mobile_refresh_tokens.id"),
        nullable=True,
    )

    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    parent = relationship("ParentModel")
    family_member = relationship("FamilyMemberModel")