from fastapi import APIRouter, HTTPException, Response
from src.api.dependencies import SessionDep, CurrentParentDep, CurrentActorDep
from src.api.auth_config import security
from src.repositories.parent_repository import ParentRepository
from src.services.auth_service import AuthService
from src.schemas.auth_schemas import (
    RegisterRequestSchema,
    ConfirmPinSchema,
    ParentSchema,
    ResendPinSchema,
    ParentLoginSchema,
    CurrentSessionSchema
)
from src.schemas.password_request_schemas import (
    PasswordResetConfirmSchema,
    PasswordResetRequestSchema,
    ResendPasswordPinSchema
)


router = APIRouter(prefix="/auth")

@router.get("/", tags=["Главная"], summary="Проверка работы сервиса")
async def root():
    return {"message": "FastAPI is running"}
      


@router.post(
    "/register",
    tags=["Авторизация"],
    summary="Создать нового пользователя"
)
async def register_parent(data: RegisterRequestSchema, session: SessionDep):
    repo = ParentRepository(session)
    service = AuthService(repo)
    try:
        await service.register_parent(data.email, data.password, data.name)
        return {"message": "Если email не зарегистрирован, на него придет PIN-код."}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.post(
    "/confirm",
    tags=["Авторизация"],
    summary="Подтвердить пин-код"
)
async def confirm_parent(data:ConfirmPinSchema, session: SessionDep):
    repo = ParentRepository(session)
    service = AuthService(repo)
    try:
        parent = await service.confirm_parent(data.email, data.pin_code)
        return parent
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.post(
        "/resend-pin",
        tags=["Авторизация"],
        summary="Запросить новый пин-код"
)
async def resend_pin(data: ResendPinSchema, session: SessionDep):
    repo = ParentRepository(session)
    service = AuthService(repo)
    try:
        await service.resend_pin(data.email)
        return {"message": "PIN истёк. Новый PIN отправлен."}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.post(
        "/login",
        tags=["Авторизация"],
        summary="Ввод логина и пароля"
)
async def login_parent(data: ParentLoginSchema, response: Response, session: SessionDep):
    repo = ParentRepository(session)
    service = AuthService(repo)
    try:
        token = await service.login_parent(data.email, data.password)
        security.set_access_cookies(token=token, response=response)
        return {"message": "Вход выполнен."}
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

#запрос на восстановление пароля   
@router.post(
    "/password-reset",
    tags = ["Авторизация"],
    summary = "Запросить PIN для восстановления пароля"
)
async def password_reset_request(data:PasswordResetRequestSchema, session: SessionDep):
    repo = ParentRepository(session)
    service = AuthService(repo)
    try:
        await service.request_password_reset(data.email)
        return {"message": "Если email зарегистрирован, на него придёт PIN-код."}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    
#подтверждение пин-кода и новый пароль
@router.post(
    "/password-reset/confirm",
    tags = ["Авторизация"],
    summary = "Подтвердить PIN и установить новый пароль",
    response_model=ParentSchema,
)
async def password_reset_cofirm(data:PasswordResetConfirmSchema, session: SessionDep):
    repo = ParentRepository(session)
    service = AuthService(repo)
    try:
        parent = await service.confirm_password_reset(data.email, data.pin_code, data.new_password)
        return parent
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post(
    "/password-reset/resend",
    tags=["Авторизация"],
    summary="Запросить новый PIN для восстановления пароля"
)
async def password_reset_resend(data: ResendPasswordPinSchema, session: SessionDep):
    repo = ParentRepository(session)
    service = AuthService(repo)
    try:
        await service.resend_password_reset_pin(data.email)
        return {"message": "Если email зарегистрирован, выдан новый PIN-код."}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    
@router.post("/logout")
async def logout_parent(response: Response):
    security.unset_access_cookies(response)
    return {"message": "Вы вышли из аккаунта."}


@router.get(
    "/me",
    response_model=ParentSchema,
    tags=["Авторизация"],
    summary="Получить профиль текущего родителя",
) # 1. Browser отправляет my_access_token cookie.
#2. CurrentParentDep вызывает get_current_parent.
#3. AuthX проверяет JWT.
#4. get_current_parent находит ParentModel.
#5. Router возвращает ParentSchema.
async def get_current_parent_profile(current_parent: CurrentParentDep, session: SessionDep):
    return current_parent


@router.get(
    "/session",
    response_model=CurrentSessionSchema,
    tags=["Авторизация"],
    summary="Получить текущую сессию родителя или участника семьи",
)
async def get_current_session(actor: CurrentActorDep):
    if actor.actor_type == "parent":
        return CurrentSessionSchema(
            actor_type="parent",
            id=actor.parent.id,
            name=actor.parent.name,
            email=actor.parent.email,
        )

    return CurrentSessionSchema(
        actor_type="family_member",
        id=actor.member.id,
        nickname=actor.member.nickname,
        role=actor.member.role,
        family_id=actor.member.family_id,
    )
