from fastapi import APIRouter, HTTPException, Request, status

from src.api.dependencies import SessionDep
from src.repositories.family_join_code_repository import FamilyJoinCodeRepository
from src.repositories.family_member_repository import FamilyMemberRepository
from src.repositories.mobile_refresh_token_repository import MobileRefreshTokenRepository
from src.repositories.parent_repository import ParentRepository
from src.schemas.auth_schemas import ParentLoginSchema
from src.schemas.family_join_code_schemas import FamilyMemberCodeLoginSchema
from src.schemas.mobile_auth_schemas import (
    MobileLogoutRequestSchema,
    MobileRefreshRequestSchema,
    MobileRefreshResponseSchema,
    MobileTokenPairResponseSchema,
)
from src.services.auth_service import AuthService
from src.services.family_join_code_service import FamilyJoinCodeService
from src.services.mobile_auth_service import MobileAuthService


router = APIRouter(prefix="/mobile/auth", tags=["mobile-auth"])


@router.post(
    "/login",
    response_model=MobileTokenPairResponseSchema,
    summary="Mobile: вход родителя по email и паролю",
)
async def mobile_login_parent(
    data: ParentLoginSchema,
    session: SessionDep,
    request: Request,
):
    parent_repo = ParentRepository(session)
    refresh_repo = MobileRefreshTokenRepository(session)

    auth_service = AuthService(parent_repo)
    mobile_auth_service = MobileAuthService(
        parent_repo=parent_repo,
        refresh_repo=refresh_repo,
    )

    try:
        parent = await auth_service.authenticate_parent(data.email, data.password)

        access_token, refresh_token = await mobile_auth_service.create_token_pair_for_parent(
            parent,
            user_agent=request.headers.get("user-agent"),
        )

        return MobileTokenPairResponseSchema(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )


@router.post(
    "/code-login",
    response_model=MobileTokenPairResponseSchema,
    summary="Mobile: вход участника семьи по коду",
)
async def mobile_login_family_member_by_code(
    data: FamilyMemberCodeLoginSchema,
    session: SessionDep,
    request: Request,
):
    code_repo = FamilyJoinCodeRepository(session)
    member_repo = FamilyMemberRepository(session)
    parent_repo = ParentRepository(session)
    refresh_repo = MobileRefreshTokenRepository(session)

    code_service = FamilyJoinCodeService(code_repo, member_repo)
    mobile_auth_service = MobileAuthService(
        parent_repo=parent_repo,
        member_repo=member_repo,
        code_repo=code_repo,
        refresh_repo=refresh_repo,
    )

    try:
        _, member = await code_service.login_by_code(data.code)

        access_token, refresh_token = await mobile_auth_service.create_token_pair_for_member(
            member,
            user_agent=request.headers.get("user-agent"),
        )

        return MobileTokenPairResponseSchema(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )


@router.post(
    "/refresh",
    response_model=MobileRefreshResponseSchema,
    summary="Mobile: обновить access token по refresh token",
)
# Обновляет access token по refresh token. Если refresh token недействителен или истек, возвращает ошибку 401 Unauthorized.
async def mobile_refresh_token(
    data: MobileRefreshRequestSchema,
    session: SessionDep,
):
    parent_repo = ParentRepository(session)
    member_repo = FamilyMemberRepository(session)
    refresh_repo = MobileRefreshTokenRepository(session)

    service = MobileAuthService(
        parent_repo=parent_repo,
        member_repo=member_repo,
        refresh_repo=refresh_repo,
    )

    try: # создаем новый access token и refresh token, используя старый refresh token. Если старый refresh token недействителен или истек, будет выброшено исключение ValueError.
        access_token, refresh_token = await service.refresh_mobile_token(data.refresh_token)

        return MobileRefreshResponseSchema(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mobile: выйти с текущего устройства",
)
async def mobile_logout(
    data: MobileLogoutRequestSchema,
    session: SessionDep,
):
    parent_repo = ParentRepository(session)
    refresh_repo = MobileRefreshTokenRepository(session)

    service = MobileAuthService(
        parent_repo=parent_repo,
        refresh_repo=refresh_repo,
    )

    await service.logout_mobile(data.refresh_token)
    return None