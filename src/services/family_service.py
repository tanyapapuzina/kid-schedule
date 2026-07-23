from datetime import datetime

from src.models.family_model import FamilyModel

from src.models.family_member_model import FamilyMemberModel
from src.repositories.family_repository import FamilyRepository
from src.repositories.family_join_code_repository import FamilyJoinCodeRepository
from src.repositories.family_member_repository import FamilyMemberRepository
import re

HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")
ALLOWED_MEMBER_ROLES = {"parent", "child"}

class FamilyService:
    def __init__(
        self,
        family_repo: FamilyRepository,
        member_repo: FamilyMemberRepository,
        code_repo: FamilyJoinCodeRepository | None = None,
    ):
        self.family_repo = family_repo
        self.member_repo = member_repo
        self.code_repo = code_repo

    #создать новую семью и сразу добавить владельца как участника семьи
    async def create_family(
        self,
        name: str,
        owner_parent_id: int,
        owner_nickname: str,
    ) -> FamilyModel:
        
        existing_families = await self.family_repo.list_families_by_parent_id(owner_parent_id)
        if existing_families:
            raise ValueError("У этого аккаунта уже есть семья.")
        
        name = name.strip()
        owner_nickname = owner_nickname.strip()

        if not name:
            raise ValueError("Название семьи обязательно.")

        if not owner_nickname:
            raise ValueError("Имя владельца семьи обязательно.")

        if owner_parent_id <= 0:
            raise ValueError("Некорректный id родителя.")

        family = FamilyModel(
            name=name,
            owner_parent_id=owner_parent_id,
        )

        family = await self.family_repo.create_family(family)

        owner_member = FamilyMemberModel(
            family_id=family.id,
            parent_id=owner_parent_id,
            nickname=owner_nickname,
            role="parent",
            created_by_parent_id=owner_parent_id,
        )

        await self.member_repo.create_member(owner_member)

        return family
    
    async def list_owned_families(
            self, 
            parent_id: int,
    ) -> list[FamilyModel]:
         if parent_id <= 0:
            raise ValueError("Некорректный id родителя.")
         return await self.family_repo.list_owned_families_by_parent_id(parent_id)
    
    async def get_family_by_id(
        self,
        family_id: int,
    ) -> FamilyModel:
        if family_id <= 0:
            raise ValueError("Некорректный id семьи.")

        family = await self.family_repo.get_family_by_id(family_id)

        if family is None:
            raise ValueError("Семья не найдена.")

        return family
    
    #список участников получит только участник этой семьи
    async def list_family_members(
        self,
        family_id: int,
        parent_id: int,
    ) -> list[FamilyMemberModel]:
        await self.ensure_parent_is_family_member(
            parent_id=parent_id,
            family_id=family_id,
        )
        return await self.member_repo.list_members_by_family_id(family_id)
    
    #состоит ли parent в family
    async def ensure_parent_is_family_member(self, parent_id:int, family_id:int) -> FamilyMemberModel:
        if parent_id <= 0:
            raise ValueError("Некорректный id родителя.")

        if family_id <= 0:
            raise ValueError("Некорректный id семьи.")
        
        member = await self.member_repo.get_member_by_parent_and_family(
            parent_id=parent_id,
            family_id=family_id,
        )
        if member is None:
            raise PermissionError("У вас нет доступа к этой семье.")

        return member
    
    #список доступных семей - все семьи, где parent является member
    async def list_parent_families(self, parent_id:int) -> list[FamilyModel]:
        if parent_id <= 0:
            raise ValueError("Некорректный id родителя.")
        return await self.family_repo.list_families_by_parent_id(parent_id)
    
    #получить доступную семью
    async def get_family_for_parent(self, family_id:int, parent_id:int) -> FamilyModel:
        await self.ensure_parent_is_family_member(
            parent_id=parent_id,
            family_id=family_id,
        )
        family = await self.family_repo.get_family_by_id(family_id)
        if family is None:
            raise ValueError("Семья не найдена.")
        return family
    
    #создаем участника семьи
    async def create_family_member(
        self,
        family_id: int,
        created_by_parent_id: int,
        nickname: str,
        role: str,
        color: str | None = None,
    ) -> FamilyMemberModel:
        nickname = nickname.strip()
        role = role.strip().lower()
        
        if color is not None:
            color = color.strip()

            if not HEX_COLOR_PATTERN.fullmatch(color):
                raise ValueError("Некорректный цвет участника.")

            color = color.upper()

        if family_id <= 0:
            raise ValueError("Некорректный id семьи.")
        if created_by_parent_id <= 0:
            raise ValueError("Некорректный id родителя.")
        if not nickname:
            raise ValueError("Имя участника обязательно.")
        if role not in ALLOWED_MEMBER_ROLES:
            raise ValueError("Роль участника должна быть parent или child.")
        
        await self.ensure_parent_is_family_member(
            parent_id=created_by_parent_id,
            family_id=family_id,
        )

        existing_member = await self.member_repo.get_member_by_family_and_nickname(
            family_id=family_id,
            nickname=nickname,
        )

        if existing_member is not None:
            raise ValueError("Участник с таким именем уже есть в этой семье.")

        member = FamilyMemberModel(
            family_id=family_id,
            parent_id=None,
            nickname=nickname,
            role=role,
            color=color,
            created_by_parent_id=created_by_parent_id,
        )

        return await self.member_repo.create_member(member)
    
    def normalize_member_color(self, color: str | None) -> str | None:
        if color is None:
            return None

        color = color.strip()

        if not HEX_COLOR_PATTERN.fullmatch(color):
            raise ValueError("Некорректный цвет участника.")

        return color.upper()

    async def update_family_member(
        self,
        family_id: int,
        member_id: int,
        parent_id: int,
        update_data: dict,
    ) -> FamilyMemberModel:
        if family_id <= 0:
            raise ValueError("Некорректный id семьи.")

        if member_id <= 0:
            raise ValueError("Некорректный id участника.")

        if parent_id <= 0:
            raise ValueError("Некорректный id родителя.")

        await self.ensure_parent_is_family_member(
            parent_id=parent_id,
            family_id=family_id,
        )

        member = await self.member_repo.get_member_by_id(member_id)

        if member is None:
            raise ValueError("Участник не найден.")

        if member.family_id != family_id:
            raise PermissionError("Участник не принадлежит этой семье.")

        if not member.is_active:
            raise ValueError("Участник уже архивирован.")

        unsupported_fields = set(update_data) - {"nickname", "color"}

        if unsupported_fields:
            raise ValueError("Можно изменить только имя участника и цвет ребенка.")

        if "nickname" in update_data:
            raw_nickname = update_data["nickname"]

            if raw_nickname is None:
                raise ValueError("Имя участника обязательно.")

            nickname = raw_nickname.strip()

            if not nickname:
                raise ValueError("Имя участника обязательно.")

            existing_member = await self.member_repo.get_member_by_family_and_nickname(
                family_id=family_id,
                nickname=nickname,
            )

            if existing_member is not None and existing_member.id != member.id:
                raise ValueError("Участник с таким именем уже есть в этой семье.")

            member.nickname = nickname

        if "color" in update_data:
            if member.role != "child":
                raise ValueError("Цвет можно менять только ребенку.")

            member.color = self.normalize_member_color(update_data["color"])

        return await self.member_repo.save_member(member)

    async def delete_family_member(
        self,
        family_id: int,
        member_id: int,
        parent_id: int,
    ) -> None:
        if family_id <= 0:
            raise ValueError("Некорректный id семьи.")

        if member_id <= 0:
            raise ValueError("Некорректный id участника.")

        if parent_id <= 0:
            raise ValueError("Некорректный id родителя.")

        await self.ensure_parent_is_family_member(
            parent_id=parent_id,
            family_id=family_id,
        )

        member = await self.member_repo.get_member_by_id(member_id)

        if member is None:
            raise ValueError("Участник не найден.")

        if member.family_id != family_id:
            raise PermissionError("Участник не принадлежит этой семье.")

        if not member.is_active:
            raise ValueError("Участник уже архивирован.")

        if member.parent_id is not None:
            raise ValueError("Зарегистрированного родителя нельзя убрать из семьи.")

        member.is_active = False
        member.archived_at = datetime.utcnow()
        member.archived_by_parent_id = parent_id

        if self.code_repo is not None:
            await self.code_repo.revoke_active_codes_for_member(member.id)

        await self.member_repo.archive_member(member)
