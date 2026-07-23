from pydantic import BaseModel
from datetime import datetime

#схема для входящего запроса - Какие данные frontend должен отправить, чтобы создать семью?
class FamilyCreateSchema(BaseModel): 
    name: str
    owner_nickname: str
    
#схема для ответа API - Какие данные API вернет после создания семьи?
class FamilySchema(BaseModel):
    id: int
    name: str
    owner_parent_id: int
    created_at: datetime

    class Config:
        from_attributes = True