from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from src.models.family_member_model import FamilyMemberModel
from src.models.event_models import EventModel


class FamilyMemberRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    #сохраняем FamilyMemberModel в базе
    async def create_member(self, member: FamilyMemberModel) -> FamilyMemberModel:
        self.session.add(member)
        await self.session.commit()
        await self.session.refresh(member)
        return member
    
    #Проверяем, является ли конкретный parent участником конкретной семьи
    async def get_member_by_parent_and_family(self, parent_id: int, family_id: int) -> FamilyMemberModel | None:
        query = select(FamilyMemberModel).where(
            FamilyMemberModel.parent_id == parent_id,
            FamilyMemberModel.family_id == family_id,
            FamilyMemberModel.is_active.is_(True),
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    #получаем всех участников семьи
    async def list_members_by_family_id(self, family_id:int) -> list[FamilyMemberModel]:
        query = (
                select(FamilyMemberModel)
                .where(
                    FamilyMemberModel.family_id == family_id,
                    FamilyMemberModel.is_active.is_(True),
                )
                .order_by(
                    FamilyMemberModel.created_at.asc(),
                    FamilyMemberModel.id.asc(),
                )
            )
        result = await self.session.execute(query)
        return result.scalars().all()
    
    #поиск по nickname внутри семьи
    async def get_member_by_family_and_nickname(self, family_id:int, nickname:str) -> FamilyMemberModel | None:
        query = select(FamilyMemberModel).where(
            FamilyMemberModel.family_id == family_id,
            FamilyMemberModel.nickname == nickname,
            FamilyMemberModel.is_active.is_(True),
        )
        result = await self.session.execute(query)
        return result.scalars().first()
    
    #ищем участника по id
    async def get_member_by_id(self, member_id:int) -> FamilyMemberModel | None:
        query = select(FamilyMemberModel).where(FamilyMemberModel.id == member_id)
        result = await self.session.execute(query)
        return result.scalars().first()
    
    #ищем запись участника семьи по parent_id
    async def get_member_by_parent_id(self, parent_id: int) -> FamilyMemberModel | None:
        query = select(FamilyMemberModel).where(
            FamilyMemberModel.parent_id == parent_id,
            FamilyMemberModel.is_active.is_(True),
        )
        result = await self.session.execute(query)
        return result.scalars().first()
    
    async def save_member(self, member: FamilyMemberModel) -> FamilyMemberModel:
        await self.session.commit()
        await self.session.refresh(member)
        return member

    async def delete_member(self, member: FamilyMemberModel) -> None:
        await self.session.delete(member)
        await self.session.commit()

    async def archive_member(self, member: FamilyMemberModel) -> FamilyMemberModel:
        await self.session.commit()
        await self.session.refresh(member)
        return member
    
    async def count_events_by_child_member_id(self, child_member_id: int) -> int:
        query = select(func.count(EventModel.id)).where(
            EventModel.child_member_id == child_member_id
        )
        result = await self.session.execute(query)
        return result.scalar_one()
