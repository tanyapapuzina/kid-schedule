from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.mobile_refresh_token_model import MobileRefreshTokenModel


# Репозиторий для работы с моделью MobileRefreshTokenModel. Репозиторий инкапсулирует логику доступа к данным и предоставляет методы для создания, получения, обновления и удаления записей в таблице mobile_refresh_tokens.
class MobileRefreshTokenRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *, # используется для явного указания, что все последующие параметры должны передаваться как именованные аргументы. Это повышает читаемость кода и предотвращает ошибки при передаче аргументов в неправильном порядке.
        actor_type: str,
        token_hash: str,
        expires_at: datetime,
        parent_id: int | None = None,
        family_member_id: int | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> MobileRefreshTokenModel:
        token = MobileRefreshTokenModel(
            actor_type=actor_type,
            parent_id=parent_id,
            family_member_id=family_member_id,
            token_hash=token_hash,
            expires_at=expires_at,
            device_name=device_name,
            user_agent=user_agent,
        )

        self.session.add(token)
        await self.session.commit()
        await self.session.refresh(token)

        return token

    async def get_active_by_hash(
        self,
        token_hash: str,
    ) -> MobileRefreshTokenModel | None: # возвращает активный (не отозванный и не истекший) токен по его хэшу. Если токен не найден или он недействителен, возвращает None.
        query = ( # создаем SQL-запрос для выборки токена из базы данных. Мы ищем запись в таблице mobile_refresh_tokens, где хэш токена совпадает с переданным значением, токен не отозван (revoked_at is None) и срок действия токена еще не истек (expires_at > текущая дата и время).
            select(MobileRefreshTokenModel)
            .where(
                MobileRefreshTokenModel.token_hash == token_hash,
                MobileRefreshTokenModel.revoked_at.is_(None),
                MobileRefreshTokenModel.expires_at > datetime.utcnow(),
            )
        )

        # Выполняем запрос к базе данных и получаем результат. result.scalar_one_or_none() возвращает единственный объект MobileRefreshTokenModel, если он найден, или None, если запись не найдена. Если найдено более одной записи, будет выброшено исключение.
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_hash(
        self, # возвращает токен по его хэшу, независимо от его состояния (активный, отозванный или истекший). Если токен не найден, возвращает None.
        token_hash: str,
    ) -> MobileRefreshTokenModel | None:
        query = (
            select(MobileRefreshTokenModel)
            .where(MobileRefreshTokenModel.token_hash == token_hash)
        )

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    # Отзывает токен, устанавливая поле revoked_at в текущее время. После этого токен считается недействительным.
    async def revoke(self, token: MobileRefreshTokenModel) -> None:
        token.revoked_at = datetime.utcnow()
        await self.session.commit()

    async def rotate( # создает новый токен, заменяя старый. Старый токен помечается как отозванный, а новый токен сохраняется в базе данных. Возвращает новый токен.
        self,
        *,
        old_token: MobileRefreshTokenModel,
        new_token_hash: str,
        new_expires_at: datetime,
    ) -> MobileRefreshTokenModel:
        new_token = MobileRefreshTokenModel(
            actor_type=old_token.actor_type,
            parent_id=old_token.parent_id,
            family_member_id=old_token.family_member_id,
            token_hash=new_token_hash,
            expires_at=new_expires_at,
            device_name=old_token.device_name,
            user_agent=old_token.user_agent,
        )

        self.session.add(new_token)
        await self.session.flush() # выполняет синхронизацию состояния сессии с базой данных, но не фиксирует транзакцию. Это позволяет получить ID нового токена до коммита, что необходимо для связывания старого токена с новым.

        # Обновляем старый токен, помечая его как отозванный и связывая его с новым токеном. Это обеспечивает возможность отслеживания истории токенов и предотвращает повторное использование старого токена.
        old_token.revoked_at = datetime.utcnow()
        # id нового токена присваивается полю replaced_by_token_id старого токена, чтобы указать, что старый токен был заменен новым. Это полезно для аудита и отслеживания изменений токенов.
        old_token.replaced_by_token_id = new_token.id

        await self.session.commit()
        await self.session.refresh(new_token)

        return new_token

    async def revoke_all_for_actor( # отзываем все активные токены для конкретного актера (родителя или участника семьи). Это полезно, например, при выходе из аккаунта или смене пароля.
        self,
        *,
        actor_type: str,
        parent_id: int | None = None,
        family_member_id: int | None = None,
    ) -> None:
        conditions = [
            MobileRefreshTokenModel.actor_type == actor_type,
            MobileRefreshTokenModel.revoked_at.is_(None),
        ]

        if actor_type == "parent":
            conditions.append(MobileRefreshTokenModel.parent_id == parent_id)
        elif actor_type == "family_member":
            conditions.append(MobileRefreshTokenModel.family_member_id == family_member_id)

        query = (
            update(MobileRefreshTokenModel)
            .where(*conditions)
            .values(revoked_at=datetime.utcnow())
        )

        await self.session.execute(query)
        await self.session.commit()

    # Отзывает все токены, срок действия которых истек. Это полезно для очистки базы данных от устаревших токенов и предотвращения их использования.
    async def cleanup_expired(self) -> None:
        query = (
            update(MobileRefreshTokenModel)
            .where(
                MobileRefreshTokenModel.expires_at <= datetime.utcnow(),
                MobileRefreshTokenModel.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.utcnow())
        )

        await self.session.execute(query)
        await self.session.commit()