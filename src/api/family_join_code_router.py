from fastapi import APIRouter, HTTPException, Response, status

from src.api.auth_config import security
from src.api.dependencies import SessionDep, CurrentParentDep
from src.repositories.family_join_code_repository import FamilyJoinCodeRepository
from src.repositories.family_member_repository import FamilyMemberRepository
from src.schemas.family_join_code_schemas import (
    FamilyJoinCodeCreateResponseSchema,
    FamilyMemberCodeLoginSchema,
    FamilyMemberLoginResponseSchema,
)
from src.services.family_join_code_service import FamilyJoinCodeService


router = APIRouter(prefix="/family-codes", tags=["family codes"])

@router.post(
    "/families/{family_id}/members/{family_member_id}",
    response_model=FamilyJoinCodeCreateResponseSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Создать код входа для участника семьи",
)#Родитель создает код для конкретного участника конкретной семьи
async def create_family_member_join_code(
    family_id: int,
    family_member_id: int,
    session: SessionDep,
    current_parent: CurrentParentDep,
):
    code_repo = FamilyJoinCodeRepository(session)
    member_repo = FamilyMemberRepository(session)
    #Сервис возвращает:реальный код; запись из базы
    service = FamilyJoinCodeService(code_repo, member_repo)

    try:
        raw_code, saved_code = await service.create_join_code(
            family_id=family_id,
            family_member_id=family_member_id,
            created_by_parent_id=current_parent.id,
        )
    #Если родитель не имеет доступа к семье 
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    #Если данные некорректны
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

    return FamilyJoinCodeCreateResponseSchema(
        code=raw_code,
        expires_at=saved_code.expires_at,
        family_member_id=saved_code.family_member_id,
    )


# @router.post(
#     "/login",
#     response_model=FamilyMemberLoginResponseSchema,
#     summary="Войти участником семьи по коду",
# ) #Вход участника по коду
# async def login_family_member_by_code(
#     data: FamilyMemberCodeLoginSchema,
#     response: Response, #Нужен, чтобы поставить cookie
#     session: SessionDep,
# ):
#     code_repo = FamilyJoinCodeRepository(session)
#     member_repo = FamilyMemberRepository(session)
#     service = FamilyJoinCodeService(code_repo, member_repo)

#     try: #Сервис проверяет код и создает JWT
#         token, member = await service.login_by_code(data.code)
#         #Ставим JWT в HttpOnly-cookie
#         security.set_access_cookies(token=token, response=response)
#         return FamilyMemberLoginResponseSchema(message="Вход выполнен.")
#     except ValueError as error:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail=str(error),
#         )