from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from src.database import Base

class PasswordResetRequest(Base):
    __tablename__ = "password_reset_request"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str]
    pin_code: Mapped[str]
    pin_expires_at: Mapped[datetime]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)