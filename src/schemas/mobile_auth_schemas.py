from pydantic import BaseModel


class MobileTokenPairResponseSchema(BaseModel): # возвращает пару токенов (access и refresh) после успешной аутентификации
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MobileRefreshRequestSchema(BaseModel):
    refresh_token: str


class MobileRefreshResponseSchema(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MobileLogoutRequestSchema(BaseModel):
    refresh_token: str
