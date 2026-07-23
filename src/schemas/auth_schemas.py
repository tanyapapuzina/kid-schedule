from pydantic import BaseModel, EmailStr


class RegisterRequestSchema(BaseModel): # данные для регистрации. Используется только для входящего запроса
    email: EmailStr
    password: str
    name: str | None = None

class ConfirmPinSchema(BaseModel): # код подтверждения
    email: EmailStr # чтобы найти нужного родителя 
    pin_code: str

class ParentLoginSchema(BaseModel):
    email: EmailStr
    password: str

class ParentSchema(BaseModel): # ответ пользователю описывает, что возвращаем клиенту
    id: int
    email: EmailStr
    name: str | None
    
    class Config:
        from_attributes = True # позволяет автоматически возвращать ORM-модель прямо из FastAPI. Без него Pydantic ожидает обычный словарь.
class ResendPinSchema(BaseModel):
    email: EmailStr

#возвращает текущую сессию любого типа
class CurrentSessionSchema(BaseModel):
    actor_type: str
    id: int
    name: str | None = None
    email: EmailStr | None = None
    nickname: str | None = None
    role: str | None = None
    family_id: int | None = None


class MobileTokenResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    