from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from src.database import Base

class FamilyJoinCodeModel(Base):
    __tablename__ = "family_join_codes"

    id: Mapped[int] = mapped_column(primary_key=True) #Первичный ключ записи
    family_id: Mapped[int]
    family_member_id: Mapped[int] #Конкретный участник, который войдет по этому коду
    code_hash: Mapped[str] #HMAC-hash кода
    
    expires_at: Mapped[datetime] #Когда код перестает работать
    last_used_at: Mapped[datetime | None] = mapped_column(nullable=True) #Когда код последний раз использовали
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True) #Когда код был отозван. Если None, значит код не отозван

    created_by_parent_id: Mapped[int] #Какой зарегистрированный родитель создал код
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow) #Когда код был создан