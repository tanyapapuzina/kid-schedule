from datetime import datetime, timedelta
import secrets
import hashlib
import hmac
from src.api.auth_config import REFRESH_TOKEN_EXPIRES_DAYS, REFRESH_TOKEN_SECRET_KEY, security
from src.models.family_member_model import FamilyMemberModel
from src.models.parent_model import ParentModel
from src.repositories.family_join_code_repository import FamilyJoinCodeRepository
from src.repositories.family_member_repository import FamilyMemberRepository
from src.repositories.mobile_refresh_token_repository import MobileRefreshTokenRepository
from src.repositories.parent_repository import ParentRepository



# Сервис для работы с мобильной аутентификацией. Он инкапсулирует логику создания, обновления и отзыва токенов для родителей и участников семей. Сервис использует репозитории для доступа к данным о родителях, участниках семей и токенах.
class MobileAuthService:
    def __init__(
        self,
        *, # используем * для того, чтобы все параметры после него были переданы только по ключу. Это повышает читаемость кода и предотвращает ошибки при передаче аргументов.
        parent_repo: ParentRepository,
        refresh_repo: MobileRefreshTokenRepository,
        member_repo: FamilyMemberRepository | None = None,
        code_repo: FamilyJoinCodeRepository | None = None,
    ):
        self.parent_repo = parent_repo
        self.member_repo = member_repo
        self.code_repo = code_repo
        self.refresh_repo = refresh_repo

    def generate_refresh_token(self) -> str:
        return secrets.token_urlsafe(64)

    def hash_refresh_token(self, refresh_token: str) -> str:
        normalized_token = refresh_token.strip()

        # HMAC (Hash-based Message Authentication Code) используется для создания безопасного хэша токена с использованием секретного ключа. Это предотвращает возможность подделки токена, так как для генерации правильного хэша требуется знание секретного ключа.
        secret_key = REFRESH_TOKEN_SECRET_KEY.encode()
        message = normalized_token.encode()

        return hmac.new(
            secret_key,
            message,
            hashlib.sha256,
        ).hexdigest()

    # Создает пару токенов (access и refresh) для родителя. 
    # Access-токен используется для аутентификации запросов, а refresh-токен позволяет получить новый access-токен без повторного ввода учетных данных.
    # Метод сохраняет хэш refresh-токена в базе данных вместе с информацией о родителе и устройстве.
    async def create_token_pair_for_parent(
        self,
        parent: ParentModel,
        *,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[str, str]:
        # Генерируем access-токен с использованием UID родителя. UID используется для идентификации пользователя в системе.
        access_token = security.create_access_token(uid=str(parent.id))

        # Генерируем refresh-токен и создаем его хэш для безопасного хранения в базе данных. Хэширование предотвращает возможность компрометации токена в случае утечки базы данных.
        refresh_token = self.generate_refresh_token()
        refresh_token_hash = self.hash_refresh_token(refresh_token)

        # Сохраняем хэш refresh-токена в базе данных с указанием типа актера (родитель),
        # идентификатора родителя, времени истечения токена, имени устройства и user-agent.
        # Это позволяет отслеживать активные сессии и управлять ими.
        await self.refresh_repo.create(
            actor_type="parent",
            parent_id=parent.id,
            family_member_id=None,
            token_hash=refresh_token_hash,
            expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRES_DAYS),
            device_name=device_name,
            user_agent=user_agent,
        )

        return access_token, refresh_token

    # Обновляет access-токен и refresh-токен для родителя или участника семейной группы. Метод проверяет действительность предоставленного refresh-токена, создает новые токены и обновляет запись в базе данных.
    async def create_token_pair_for_member(
        self,
        member: FamilyMemberModel,
        *,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[str, str]:
        access_token = security.create_access_token(uid=f"member:{member.id}")

        refresh_token = self.generate_refresh_token()
        refresh_token_hash = self.hash_refresh_token(refresh_token)

        await self.refresh_repo.create(
            actor_type="family_member",
            parent_id=None,
            family_member_id=member.id,
            token_hash=refresh_token_hash,
            expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRES_DAYS),
            device_name=device_name,
            user_agent=user_agent,
        )

        return access_token, refresh_token

    # Обновляет access-токен и refresh-токен для родителя или участника семейной группы. Метод проверяет действительность предоставленного refresh-токена, создает новые токены и обновляет запись в базе данных.
    async def refresh_mobile_token(self, refresh_token: str) -> tuple[str, str]:
        #сначала хэшируем refresh token, чтобы найти его в базе данных. Это обеспечивает безопасность, так как мы не храним сами токены в базе данных.
        token_hash = self.hash_refresh_token(refresh_token)

        # Получаем запись о refresh-токене из базы данных по его хэшу. Если запись не найдена, это означает, что токен недействителен или истек.
        stored_token = await self.refresh_repo.get_active_by_hash(token_hash)

        if stored_token is None:
            raise ValueError("Сессия недействительна или истекла.")

        if stored_token.actor_type == "parent":
            if stored_token.parent_id is None:
                raise ValueError("Некорректная сессия.")

            parent = await self.parent_repo.get_by_id(stored_token.parent_id)

            if parent is None:
                raise ValueError("Пользователь не найден.")

            access_token = security.create_access_token(uid=str(parent.id))

        elif stored_token.actor_type == "family_member":
            if stored_token.family_member_id is None or self.member_repo is None:
                raise ValueError("Некорректная сессия.")

            member = await self.member_repo.get_member_by_id(stored_token.family_member_id)

            if member is None or not member.is_active:
                raise ValueError("Участник не найден или больше не активен.")

            access_token = security.create_access_token(uid=f"member:{member.id}")

        else:
            raise ValueError("Некорректный тип сессии.")

        # Генерируем новый refresh-токен и его хэш для обновления записи в базе данных. Это предотвращает возможность повторного использования старого токена.
        new_refresh_token = self.generate_refresh_token()
        # Генерируем новый хэш для нового refresh-токена, чтобы безопасно хранить его в базе данных.
        new_refresh_hash = self.hash_refresh_token(new_refresh_token)

        # rotate - функция, которая обновляет запись о refresh-токене в базе данных, заменяя старый токен на новый. Это обеспечивает безопасность сессии, так как старый токен становится недействительным.
        await self.refresh_repo.rotate(
            old_token=stored_token,
            new_token_hash=new_refresh_hash,
            new_expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRES_DAYS),
        )

        return access_token, new_refresh_token

    # Завершает сессию пользователя, отозвав refresh-токен. Это предотвращает использование токена после выхода из аккаунта.
    async def logout_mobile(self, refresh_token: str) -> None:
        token_hash = self.hash_refresh_token(refresh_token)
        stored_token = await self.refresh_repo.get_by_hash(token_hash)

        if stored_token is None:
            return

        if stored_token.revoked_at is None:
            await self.refresh_repo.revoke(stored_token)