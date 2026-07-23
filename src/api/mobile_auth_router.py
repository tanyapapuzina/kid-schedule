from fastapi import APIRouter, HTTPException, status

from src.api.dependencies import SessionDep
from src.repositories.parent_repository import ParentRepository
from src.schemas.auth_schemas import ParentLoginSchema, MobileTokenResponseSchema
from src.services.auth_service import AuthService
from src.schemas.family_join_code_schemas import FamilyMemberCodeLoginSchema

from src.repositories.family_join_code_repository import FamilyJoinCodeRepository
from src.repositories.family_member_repository import FamilyMemberRepository
from src.services.family_join_code_service import FamilyJoinCodeService


router = APIRouter(prefix="/mobile/auth", tags=["mobile-auth"])

@router.post(
    "/login",
    response_model=MobileTokenResponseSchema,
    summary="Mobile: вход родителя по email и паролю",
)
async def mobile_login_parent(data: ParentLoginSchema, session: SessionDep):
    repo = ParentRepository(session)
    service = AuthService(repo)
    try:
        token = await service.login_parent(data.email, data.password)
        return MobileTokenResponseSchema(access_token=token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    

@router.post(
    "/code-login",
    response_model=MobileTokenResponseSchema,
    summary="Mobile: вход участника семьи по коду",
)
async def mobile_login_family_member_by_code(
    data: FamilyMemberCodeLoginSchema,
    session: SessionDep,
):
    code_repo = FamilyJoinCodeRepository(session)
    member_repo = FamilyMemberRepository(session)
    service = FamilyJoinCodeService(code_repo, member_repo)

    try:
        token, member = await service.login_by_code(data.code)
        return MobileTokenResponseSchema(access_token=token)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        )
