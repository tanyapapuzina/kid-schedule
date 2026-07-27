from datetime import datetime, timedelta
import secrets
from passlib.context import CryptContext
from src.models.parent_model import ParentModel
from src.repositories.parent_repository import ParentRepository
from src.models.pending_registration import PendingRegistration
from src.api.auth_config import security
from src.models.password_request_model import PasswordResetRequest
from src.services.email_service import EmailService

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    def __init__(self, repo: ParentRepository, email_service: EmailService | None = None,):
        self.repo = repo
        self.email_service = email_service
    
    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)
    
    def generate_pin(self, length: int = 6) -> str:
        return "".join(str(secrets.randbelow(10)) for _ in range(length))
    
    # helper для отправки регистрации. Если email_service не передан, метод ничего не делает.
    async def send_registration_email(self, email: str, pin_code: str) -> None:
        if self.email_service is None:
            return
        await self.email_service.send_registration_pin(email, pin_code)
    
    # удаляет устаревшие заявки
    async def cleanup_expired_pending_registrations(self):
        cutoff = datetime.utcnow()
        return await self.repo.delete_expired_pending_registrations(cutoff)
    
    async def cleanup_expired_password_resets(self):
        cutoff = datetime.utcnow()
        return await self.repo.delete_expired_password_resets(cutoff)

    # создаёт временную заявку
    async def register_parent(self, email: str, password: str, name: str | None):
        email = email.lower().strip()
        await self.cleanup_expired_pending_registrations()
        existing_parent = await self.repo.get_by_email(email)
        if existing_parent is not None:
            raise ValueError("Если email не зарегистрирован, на него придет PIN-код.")
        existing_pending = await self.repo.get_pending_by_email(email)
        if existing_pending is not None:
            if existing_pending.pin_expires_at >= datetime.utcnow():
                raise ValueError("Если email не зарегистрирован, на него придет PIN-код.")
            await self.repo.delete_pending_registration(existing_pending)
        
        password_hash = self.hash_password(password)
        pin_code = self.generate_pin()
        pin_expires_at = datetime.utcnow() + timedelta(minutes=5)

        pending = PendingRegistration(
            email=email,
            name=name,
            password_hash=password_hash,
            pin_code=pin_code,
            pin_expires_at=pin_expires_at,
        )
        created_pending = await self.repo.create_pending_registration(pending)
        await self.send_registration_email(email, pin_code)
        return created_pending
    
    # временный запрос на восстановление пароля
    async def request_password_reset(self, email: str):
        email = email.lower().strip()
        await self.cleanup_expired_password_resets()        
        existing_parent = await self.repo.get_by_email(email)
        if existing_parent is None:
            raise ValueError("Если email не зарегистрирован, на него придет PIN-код.")
        
        existing_request = await self.repo.get_password_reset_by_email(email)
        if existing_request is not None:
            if existing_request.pin_expires_at >= datetime.utcnow():
                return existing_request
            await self.repo.delete_password_reset(existing_request)
        pin_code = self.generate_pin()
        pin_expires_at = datetime.utcnow() + timedelta(minutes=3)
        password_reset = PasswordResetRequest(
            email=email,
            pin_code=pin_code,
            pin_expires_at=pin_expires_at,
        )
        created_requuest = await self.repo.create_password_reset(password_reset)

        if self.email_service is not None:
            await self.email_service.send_password_reset_pin(email, pin_code)

        return created_requuest 


    # проверяет PIN и переносит данные в parents
    async def confirm_parent(self, email: str, pin_code: str):
        email = email.lower().strip()
        pending = await self.repo.get_pending_by_email(email)
        if pending is None:
            raise ValueError("PIN-код недействителен или не найден. Пожалуйста, пройдите регистрацию заново.")
        existing_parent = await self.repo.get_by_email(email)
        if existing_parent is not None:
            await self.repo.delete_pending_registration(pending)
            raise ValueError("Если email не зарегистрирован, на него придет PIN-код.")
        if pending.pin_code != pin_code:
            raise ValueError("Неверный PIN-код")
        if pending.pin_expires_at < datetime.utcnow():
            await self.repo.delete_pending_registration(pending)
            raise ValueError(" Срок действия кода истёк. Пожалуйста, пройдите регистрацию заново.")

        parent = await self.repo.create_parent_from_pending(pending)
        await self.repo.delete_pending_registration(pending)
        return parent  
    


    #меняет только пароль существующей учётной записи
    async def confirm_password_reset(self, email:str, pin_code:str, new_password:str):
        email = email.lower().strip()
        request = await self.repo.get_password_reset_by_email(email)
        if request is None or request.pin_code != pin_code:
            raise ValueError("Неверный PIN-код или заявка не найдена.")
        if request.pin_expires_at < datetime.utcnow():
            await self.repo.delete_password_reset(request)
            raise ValueError("Срок действия PIN-кода истёк. Запросите сброс заново.")
        parent = await self.repo.get_by_email(email)
        if parent is None:
            raise ValueError("Пользователь не найден.")
        parent.password_hash = self.hash_password(new_password)
        await self.repo.session.commit()
        await self.repo.session.refresh(parent)
        await self.repo.delete_password_reset(request)
        return parent
    

    #пин-код для воссановления пароля
    async def resend_password_reset_pin(self, email: str):
        email = email.lower().strip()
        existing_request = await self.repo.get_password_reset_by_email(email)
        if existing_request is None:
            raise ValueError("Срок действия PIN-кода истёк или код не найден. Пожалуйста, запросите сброс снова.")
        if existing_request.pin_expires_at >= datetime.utcnow():
            raise ValueError("Текущий PIN-код ещё действителен. Используйте его для подтверждения.")

        pin_code = self.generate_pin()
        pin_expires_at = datetime.utcnow() + timedelta(minutes=3)

        updated_request = await self.repo.update_password_reset(existing_request, pin_code, pin_expires_at)

        if self.email_service is not None:
            await self.email_service.send_password_reset_pin(email, pin_code)

        return updated_request
    

    # обновляет expired PIN, но только если заявка ещё есть
    async def resend_pin(self, email: str):
        email = email.lower().strip()
        pending = await self.repo.get_pending_by_email(email)
        if pending is None:
            raise ValueError("Срок действия PIN-кода истёк или код не найден. Пожалуйста, пройдите регистрацию заново.")
        if pending.pin_expires_at >= datetime.utcnow():
            raise ValueError("Текущий PIN-код ещё действителен. Используйте его для подтверждения.")

        pin_code = self.generate_pin()
        pin_expires_at = datetime.utcnow() + timedelta(minutes=3)

        updated_pending = await self.repo.update_pending_parent(pending, pin_code, pin_expires_at)
        await self.send_registration_email(email, pin_code)
        return updated_pending
        


    async def authenticate_parent(self, email: str, password: str) -> ParentModel:
        email = email.lower().strip()

        parent = await self.repo.get_by_email(email)

        if parent is None:
            raise ValueError("Неверный email или пароль.")

        if not self.verify_password(password, parent.password_hash):
            raise ValueError("Неверный email или пароль.")

        return parent
    


    async def login_parent(self, email: str, password: str) -> str:
        parent = await self.authenticate_parent(email, password)
        token = security.create_access_token(uid=str(parent.id))
        return token