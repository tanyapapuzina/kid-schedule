from pydantic import BaseModel, EmailStr


class PasswordResetRequestSchema(BaseModel): #запрос на сброс
    email: EmailStr

class PasswordResetConfirmSchema(BaseModel): #подтверждение сброса
    email: EmailStr
    pin_code: str
    new_password: str

class ResendPasswordPinSchema(BaseModel): #повторный запрос PIN-кода
    email: EmailStr

