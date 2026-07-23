from pydantic import BaseModel
from datetime import datetime
from typing import Literal


class FamilyMemberUpdateSchema(BaseModel):
    nickname: str | None = None
    color: str | None = None

    class Config:
        extra = "forbid"

#входящий запрос - для создания участника семьи 
class FamilyMemberCreateSchema(BaseModel): 
    nickname: str
    role: Literal["parent", "child"]
    color: str | None = None

#для ответа API
class FamilyMemberSchema(BaseModel):
    id: int
    family_id: int
    parent_id: int | None
    nickname: str
    role: str
    created_by_parent_id: int
    created_at: datetime
    color: str | None
    is_active: bool
    archived_at: datetime | None
    archived_by_parent_id: int | None
    
    class Config:
        from_attributes = True
