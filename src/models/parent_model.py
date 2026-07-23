from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from src.database import Base

#аккаунт для входа в приложение
class ParentModel(Base):
    __tablename__ = "parents"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    name: Mapped[str] = mapped_column(nullable=True)
    password_hash: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    