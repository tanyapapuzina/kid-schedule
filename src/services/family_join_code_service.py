from datetime import datetime, timedelta
import hashlib #алгоритм hash
import hmac #keyed hash, то есть hash с секретным ключом backend
import secrets #предназначен для генерации криптографически случайных значений
import string

from src.api.auth_config import config, security
from src.models.family_join_code_model import FamilyJoinCodeModel
from src.models.family_member_model import FamilyMemberModel
from src.repositories.family_join_code_repository import FamilyJoinCodeRepository
from src.repositories.family_member_repository import FamilyMemberRepository


JOIN_CODE_TTL_DAYS = 7 #Код действует 7 дней
JOIN_CODE_GROUPS = 4 #Код будет иметь 4 группы по 4 символа
JOIN_CODE_GROUP_SIZE = 4
JOIN_CODE_PREFIX = "KS"


class FamilyJoinCodeService:
    def __init__(
        self,
        code_repo: FamilyJoinCodeRepository,
        member_repo: FamilyMemberRepository,
    ):
        self.code_repo = code_repo
        self.member_repo = member_repo

    def normalize_code(self, code: str) -> str:
        # strip() убирает пробелы по краям; upper() делает большие буквы;replace убирает дефисы и пробелы.

        return code.strip().upper().replace("-", "").replace(" ", "")

    def hash_code(self, code: str) -> str:
        normalized_code = self.normalize_code(code)
        #Берем секретный ключ backend из настроек AuthX
        #.encode() переводит строку в bytes. Потому что hmac.new(...) работает не с обычными строками Python, а с байтамиs
        secret_key = config.JWT_SECRET_KEY.encode()
        message = normalized_code.encode()

        #HMAC — это механизм аутентификации, который объединяет хеш-функцию (например, ту же SHA-256) с секретным ключом
        return hmac.new(
            secret_key,
            message, #кода входа
            hashlib.sha256, #лгоритм hash
        ).hexdigest() #Преобразует результат в обычную строку из символов 0-9 и a-f

    #Генерирует реальный код, который увидит родитель
    def generate_raw_code(self) -> str:
        #ascii_uppercase - готовая строка из библиотеки string:то есть все английские большие буквы
        #digits - тоже готовая строка: все цифры
        alphabet = string.ascii_uppercase + string.digits
        groups = []

        for _ in range(JOIN_CODE_GROUPS):
            group = "".join(
                secrets.choice(alphabet)
                for _ in range(JOIN_CODE_GROUP_SIZE)
            )
            groups.append(group)

        return f"{JOIN_CODE_PREFIX}-" + "-".join(groups)

    #Создает новый код для конкретного участника
    async def create_join_code(
        self,
        family_id: int,
        family_member_id: int,
        created_by_parent_id: int,
    ) -> tuple[str, FamilyJoinCodeModel]:
        if family_id <= 0:
            raise ValueError("Некорректный id семьи.")

        if family_member_id <= 0:
            raise ValueError("Некорректный id участника.")

        if created_by_parent_id <= 0:
            raise ValueError("Некорректный id родителя.")

        #Проверяем, что родитель действительно состоит в этой семье
        creator_member = await self.member_repo.get_member_by_parent_and_family(
            parent_id=created_by_parent_id,
            family_id=family_id,
        )

        if creator_member is None:
            raise PermissionError("У вас нет доступа к этой семье.")

        #Находим участника, для которого создается код
        target_member = await self.member_repo.get_member_by_id(family_member_id)

        if target_member is None:
            raise ValueError("Участник не найден.")

        if target_member.family_id != family_id:
            raise ValueError("Участник не относится к выбранной семье.")

        if not target_member.is_active:
            raise ValueError("Нельзя создать код для архивного участника.")

        #Отзываем старые активные коды этого участника
        await self.code_repo.revoke_active_codes_for_member(family_member_id)

        #Создаем код, который покажем родителю
        raw_code = self.generate_raw_code()
        #Создаем hash для базы
        code_hash = self.hash_code(raw_code)
        #Код истечет через JOIN_CODE_TTL_DAYS дней
        expires_at = datetime.utcnow() + timedelta(days=JOIN_CODE_TTL_DAYS)

        #Создаем ORM-объект для сохранения
        join_code = FamilyJoinCodeModel(
            family_id=family_id,
            family_member_id=family_member_id,
            code_hash=code_hash,
            expires_at=expires_at,
            created_by_parent_id=created_by_parent_id,
        )

        saved_code = await self.code_repo.create_code(join_code)

        return raw_code, saved_code

    #Вход участника по коду
    async def login_by_code(self, code: str) -> tuple[str, FamilyMemberModel]:
        if not code.strip():
            raise ValueError("Введите код входа.")

        code_hash = self.hash_code(code)
        #Ищем активный код
        join_code = await self.code_repo.get_active_code_by_hash(code_hash)

        if join_code is None:
            raise ValueError("Код недействителен или срок действия истек.")

        #Находим участника
        member = await self.member_repo.get_member_by_id(join_code.family_member_id)

        if member is None:
            raise ValueError("Участник не найден.")

        if not member.is_active:
            raise ValueError("Участник больше не активен.")

        #Записываем дату последнего использования
        await self.code_repo.mark_code_used(join_code)

        token = security.create_access_token(
            uid=f"member:{member.id}"
        )

        return token, member
