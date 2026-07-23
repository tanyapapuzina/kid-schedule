from typing import Annotated
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.auth_config import security
from src.database import get_db
from src.models.parent_model import ParentModel
from src.repositories.parent_repository import ParentRepository

from dataclasses import dataclass #позволяет быстро создать класс-контейнер
from src.models.family_member_model import FamilyMemberModel
from src.repositories.family_member_repository import FamilyMemberRepository


SessionDep = Annotated[AsyncSession, Depends(get_db)] # Тип для зависимости получения сессии базы данных. Нужен для указания типа данных, 
#который будет передаваться в обработчики запросов при использовании зависимости get_db. Annotated - это тип, который позволяет добавлять
#метаданные к типу данных, а Depends - это функция FastAPI, которая указывает, что данная зависимость должна быть разрешена при обработке запроса. 
#В данном случае, SessionDep будет использоваться для указания типа данных AsyncSession, который будет передаваться в обработчики запросов при 
#использовании зависимости get_db.



# get_current_parent нужна, чтобы backend автоматически понимал, 
# какой родитель отправил запрос, не спрашивая его id у frontend.
# Она нужна всем защищенным ручкам: создание семьи, добавление 
# участников, создание событий и просмотр личных данных.
async def get_current_parent(
    session: SessionDep,
    token=Depends(security.access_token_required),
) -> ParentModel:
    try:
        parent_id = int(token.sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Некорректный token.")

    repo = ParentRepository(session)
    parent = await repo.get_by_id(parent_id)

    if parent is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден.")

    return parent

CurrentParentDep = Annotated[ParentModel, Depends(get_current_parent)]


@dataclass
class CurrentActor:
    actor_type: str
    parent: ParentModel | None = None #Если вошел родитель, здесь будет ParentModel. Если вошел участник по коду, здесь будет None
    member: FamilyMemberModel | None = None # это запись текущего пользователя внутри семьи, если семья уже есть.

    @property #позволяет обращаться к методу как к обычному полю
    def id(self) -> int:
        if self.actor_type == "parent" and self.parent is not None:
            return self.parent.id

        if self.actor_type == "family_member" and self.member is not None:
            return self.member.id

        raise RuntimeError("Некорректное состояние CurrentActor.")

    @property
    def family_id(self) -> int | None:
        if self.member is not None:
            return self.member.family_id

        return None

    @property
    def role(self) -> str | None:
        if self.member is not None:
            return self.member.role

        return None


async def get_current_actor(
    session: SessionDep, #сессия базы данных
    token=Depends(security.access_token_required), #проверенный JWT token через AuthX
) -> CurrentActor:
    token_subject = str(token.sub)

    #если строка начинается с member:, значит это вход участника семьи по коду
    if token_subject.startswith("member:"):
        member_id_text = token_subject.removeprefix("member:")

        try:
            member_id = int(member_id_text)
        except ValueError:
            raise HTTPException(status_code=401, detail="Некорректный token участника.")

        member_repo = FamilyMemberRepository(session)
        #ищем участника в базе
        member = await member_repo.get_member_by_id(member_id)

        if member is None:
            raise HTTPException(status_code=401, detail="Участник не найден.")

        if not member.is_active:
            raise HTTPException(status_code=401, detail="Участник больше не активен.")

        return CurrentActor(
            actor_type="family_member",
            member=member,
        )

    #если token не member-token, пробуем обработать его как parent-token
    try:
        parent_id = int(token_subject)
    except ValueError:
        raise HTTPException(status_code=401, detail="Некорректный token.")

    parent_repo = ParentRepository(session)
    #ищем родителя в базе
    parent = await parent_repo.get_by_id(parent_id)

    if parent is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден.")
    
    member_repo = FamilyMemberRepository(session)
    member = await member_repo.get_member_by_parent_id(parent.id)

    return CurrentActor(
        actor_type="parent",
        parent=parent,
        member=member,
    )


CurrentActorDep = Annotated[CurrentActor, Depends(get_current_actor)]
