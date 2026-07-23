from fastapi import APIRouter, HTTPException, status
from src.api.dependencies import SessionDep, CurrentParentDep, CurrentActorDep
from src.repositories.family_repository import FamilyRepository
from src.repositories.family_join_code_repository import FamilyJoinCodeRepository
from src.repositories.family_member_repository import FamilyMemberRepository
from src.schemas.family_schemas import FamilyCreateSchema, FamilySchema
from src.services.family_service import FamilyService
from src.schemas.family_member_schemas import FamilyMemberSchema, FamilyMemberCreateSchema, FamilyMemberUpdateSchema


router = APIRouter(prefix="/families", tags=["families"])


@router.post(
        "/",
    response_model=FamilySchema,
    status_code=status.HTTP_201_CREATED,
    summary="Создать семью",
)
async def create_family(
    data: FamilyCreateSchema,
    session: SessionDep,
    current_parent: CurrentParentDep,
):
    # Эта ручка parent-only.
    # Семью может создавать только зарегистрированный родитель,
    # поэтому здесь используем CurrentParentDep, а не CurrentActorDep.

    family_repo = FamilyRepository(session)
    member_repo = FamilyMemberRepository(session)
    service = FamilyService(family_repo, member_repo)

    try:
        family = await service.create_family(
            name=data.name,
            owner_parent_id=current_parent.id,
            owner_nickname=data.owner_nickname,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )
    return family

@router.get(
    "/",
    response_model=list[FamilySchema],
    summary="Получить все семьи текущего пользователя",
)
async def list_current_actor_families(
    session:SessionDep,
    actor:CurrentActorDep,
):
    # Эта ручка доступна и родителю, и участнику по коду.
    #
    # Для родителя:
    # возвращаем все семьи, где он состоит как family_member.
    #
    # Для участника по коду:
    # возвращаем список из одной семьи, потому что такой участник
    # связан с конкретной записью family_members и одной family_id.


    family_repo = FamilyRepository(session)
    member_repo = FamilyMemberRepository(session)
    service = FamilyService(family_repo, member_repo)

    try:
        if actor.actor_type == "family_member":
            family = await service.get_family_by_id(actor.member.family_id)
            return [family]
        
        return await service.list_parent_families(actor.parent.id)
    
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get(
    "/{family_id}",
    response_model=FamilySchema,
    summary="Получить семью по id",
)
async def get_family(
    family_id:int, 
    session:SessionDep, 
    actor:CurrentActorDep,
    ):
    # Эта ручка доступна и родителю, и участнику по коду

    # Если actor - family_member:
    # он может открыть только свою семью.
    #
    # Если actor - parent:
    # проверяем, что parent состоит в этой семье.

    family_repo = FamilyRepository(session)
    member_repo = FamilyMemberRepository(session)
    service = FamilyService(family_repo, member_repo)
    try:
        if actor.actor_type == "family_member":
            if actor.member.family_id != family_id:
                raise PermissionError("У вас нет доступа к этой семье.")

            return await service.get_family_by_id(family_id)
        
        return await service.get_family_for_parent(
            family_id=family_id,
            parent_id=actor.parent.id,
        )
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )

@router.get(
    "/{family_id}/members",
    response_model=list[FamilyMemberSchema],
    summary="Получить участников семьи",
)
async def list_family_members(
    family_id:int,
    session:SessionDep, 
    actor:CurrentActorDep,
    ):
    # Эта ручка читает участников конкретной семьи.
    #
    # Для family_member:
    # проверяем, что family_id из URL совпадает с actor.member.family_id.
    #
    # Для parent:
    # используем service.list_family_members, где уже есть проверка
    # ensure_parent_is_family_member.

    family_repo = FamilyRepository(session)
    member_repo = FamilyMemberRepository(session)
    service = FamilyService(family_repo, member_repo)

    try:
        if actor.actor_type == "family_member":
            if actor.member.family_id != family_id:
                raise PermissionError("У вас нет доступа к этой семье.")

            return await member_repo.list_members_by_family_id(family_id)
        
        return await service.list_family_members(
            family_id=family_id,
            parent_id=actor.parent.id,
        )
    
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )

@router.post(
    "/{family_id}/members",
    response_model=FamilyMemberSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Добавить участника семьи",
)
async def create_family_member(
    family_id: int,
    data: FamilyMemberCreateSchema,
    session: SessionDep,
    current_parent: CurrentParentDep,
):
    # Эта ручка parent-only.
    #
    # Участник по коду не должен добавлять новых участников.
    # Поэтому здесь CurrentParentDep.

    family_repo = FamilyRepository(session)
    member_repo = FamilyMemberRepository(session)
    service = FamilyService(family_repo, member_repo)

    try:
        return await service.create_family_member(
            family_id=family_id,
            created_by_parent_id=current_parent.id,
            nickname=data.nickname,
            role=data.role,
            color=data.color,

        )
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )
    
@router.patch(
    "/{family_id}/members/{member_id}",
    response_model=FamilyMemberSchema,
    summary="Переименовать участника семьи",
)
async def update_family_member(
    family_id: int,
    member_id: int,
    data: FamilyMemberUpdateSchema,
    session: SessionDep,
    current_parent: CurrentParentDep,
):
    family_repo = FamilyRepository(session)
    member_repo = FamilyMemberRepository(session)
    service = FamilyService(family_repo, member_repo)

    try:
        return await service.update_family_member(
            family_id=family_id,
            member_id=member_id,
            parent_id=current_parent.id,
            update_data=data.model_dump(exclude_unset=True),
        )
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )
    

@router.delete(
    "/{family_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Архивировать участника семьи",
)
async def delete_family_member(
    family_id: int,
    member_id: int,
    session: SessionDep,
    current_parent: CurrentParentDep,
):
    family_repo = FamilyRepository(session)
    member_repo = FamilyMemberRepository(session)
    code_repo = FamilyJoinCodeRepository(session)
    service = FamilyService(family_repo, member_repo, code_repo)

    try:
        await service.delete_family_member(
            family_id=family_id,
            member_id=member_id,
            parent_id=current_parent.id,
        )
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )
