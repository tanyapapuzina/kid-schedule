from datetime import datetime
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.pending_registration import PendingRegistration
from src.models.parent_model import ParentModel
from src.models.password_request_model import PasswordResetRequest


class ParentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    #  ищет временную заявку
    async def get_pending_by_email(self, email: str) -> PendingRegistration | None:
        query = select(PendingRegistration).where(PendingRegistration.email==email)
        result = await self.session.execute(query)
        return result.scalars().first()
    
    async def get_by_email(self, email: str) -> ParentModel | None:
        query = select(ParentModel).where(ParentModel.email==email)
        result = await self.session.execute(query)
        return result.scalars().first()
    
    # ищет по id. Для поиска по primary key SQLAlchemy дает короткий метод:
    # self.session.get(Model, id)
    async def get_by_id(self, parent_id: int) -> ParentModel | None:
        parent = await self.session.get(ParentModel, parent_id)
        return parent
    
    # сохраняет временную заявку
    async def create_pending_registration(self, pending: PendingRegistration) -> PendingRegistration:
        self.session.add(pending)
        await self.session.commit()
        await self.session.refresh(pending)
        return pending
    
    # обновляет пин-код и срок
    async def update_pending_parent(self, pending: PendingRegistration, pin_code:str, pin_expires_at:datetime) -> PendingRegistration:
       pending.pin_code = pin_code
       pending.pin_expires_at = pin_expires_at
       await self.session.commit()
       await self.session.refresh(pending)
       return pending
    
    # удаляем заявку, если пин просрочен
    async def delete_pending_registration(self, pending: PendingRegistration) -> None:
        await self.session.delete(pending)
        await self.session.commit()

    # массовая очистка старых заявок
    async def delete_expired_pending_registrations(self, cutoff: datetime) -> int:
        query = delete(PendingRegistration).where(PendingRegistration.pin_expires_at < cutoff)
        result = await self.session.execute(query)
        await self.session.commit()
        return result.rowcount
    

    # записываем данные в ревльную таблицу
    async def create_parent_from_pending(self, pending: PendingRegistration) -> ParentModel:
        parent = ParentModel(
            email = pending.email,
            name = pending.name,
            password_hash = pending.password_hash,
        )
        self.session.add(parent)
        await self.session.commit()
        await self.session.refresh(parent)
        return parent
    

    # -----------------------Восствновление пароля----------------------

    async def get_password_reset_by_email(self, email: str) -> PasswordResetRequest | None:
        query = select(PasswordResetRequest).where(PasswordResetRequest.email==email)
        result = await self.session.execute(query)
        return result.scalars().first()
    
    async def create_password_reset(self, request: PasswordResetRequest) -> PasswordResetRequest:
        self.session.add(request)
        await self.session.commit()
        await self.session.refresh(request)
        return request
    
    async def update_password_reset(self, request: PasswordResetRequest, pin_code: str, pin_expires_at) -> PasswordResetRequest:
        request.pin_code = pin_code
        request.pin_expires_at = pin_expires_at
        await self.session.commit()
        await self.session.refresh(request)
        return request
    
    async def delete_password_reset(self, request:PasswordResetRequest) -> None:
        await self.session.delete(request)
        await self.session.commit()


    async def delete_expired_password_resets(self, cutoff: datetime) -> int:
        query = delete(PasswordResetRequest).where(PasswordResetRequest.pin_expires_at<cutoff)
        result = await self.session.execute(query)
        await self.session.commit()
        return result.rowcount


    

    
    


