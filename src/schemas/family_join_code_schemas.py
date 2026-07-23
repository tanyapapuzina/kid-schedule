from datetime import datetime
from pydantic import BaseModel


#ответ backend после создания кода
class FamilyJoinCodeCreateResponseSchema(BaseModel):
    code: str
    expires_at: datetime
    family_member_id: int

#Вход по коду. Пользователь вводит только код
class FamilyMemberCodeLoginSchema(BaseModel):
    code: str


class FamilyMemberLoginResponseSchema(BaseModel):
    message: str