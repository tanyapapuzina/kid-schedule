
from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.family_join_code_model import FamilyJoinCodeModel

class FamilyJoinCodeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    #сохрвняет новую запись кода 
    async def create_code(self, code: FamilyJoinCodeModel) -> FamilyJoinCodeModel:
        self.session.add(code)
        await self.session.commit()
        await self.session.refresh(code)
        return code
    
    #Отзывает активные коды участника
    async def revoke_active_codes_for_member(self, family_member_id: int) -> None:
        query = (
            update(FamilyJoinCodeModel)
            .where(
                FamilyJoinCodeModel.family_member_id == family_member_id,
                FamilyJoinCodeModel.revoked_at.is_(None),
                FamilyJoinCodeModel.expires_at > datetime.utcnow(),
            )
            .values(revoked_at=datetime.utcnow())
        )

        await self.session.execute(query)
        await self.session.commit()


    #Ищет код по hash
    async def get_active_code_by_hash(self, code_hash: str) -> FamilyJoinCodeModel | None:
        query = (
            select(FamilyJoinCodeModel)
            .where(
                FamilyJoinCodeModel.code_hash == code_hash,
                FamilyJoinCodeModel.revoked_at.is_(None),
                FamilyJoinCodeModel.expires_at > datetime.utcnow(),
            )
        )

        result = await self.session.execute(query)
        return result.scalars().first()

    #Обновляет дату последнего использования
    async def mark_code_used(self, code: FamilyJoinCodeModel) -> FamilyJoinCodeModel:
        code.last_used_at = datetime.utcnow()
        await self.session.commit()
        await self.session.refresh(code)
        return code
