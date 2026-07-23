from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from src.database import Base

#семейное пространство, контейнер
class FamilyModel(Base):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] 
    owner_parent_id: Mapped[int] = mapped_column(unique=True) #id родителя, который создал семью
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
