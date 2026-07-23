from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models.family_model import FamilyModel
from src.models.family_member_model import FamilyMemberModel


class FamilyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    #сохраняем FamilyModel в базе 
    async def create_family(self, family: FamilyModel) -> FamilyModel:
        self.session.add(family)
        await self.session.commit()
        await self.session.refresh(family)
        return family

    #получаем семьи, где owner_parent_id равен id родителя
    async def list_owned_families_by_parent_id(self, parent_id:int) -> list[FamilyModel]:
        query = select(FamilyModel).where(FamilyModel.owner_parent_id==parent_id)
        result = await self.session.execute(query)
        return result.scalars().all()
    

    #найти семью по id
    async def get_family_by_id(self, family_id:int) -> FamilyModel | None:
        query = select(FamilyModel).where(FamilyModel.id==family_id)
        result = await self.session.execute(query)
        return result.scalars().first()
    
    #получить все семьи участника
    async def list_families_by_parent_id(self, parent_id:int) -> list[FamilyModel]:
        query = (
        select(FamilyModel) #получить модели семей
        .join(              #Соединяем
            FamilyMemberModel, 
            FamilyMemberModel.family_id == FamilyModel.id,
        ) #оставляем семьи, где текущий родитель является участником
        .where(FamilyMemberModel.parent_id == parent_id)
        .distinct() #Не допускаем повторения одной семьи в результате.
        .order_by(FamilyModel.created_at.desc()) #Новые семьи будут первыми
    )
        result = await self.session.execute(query)
        return list(result.scalars().all())