import asyncio #нужен, потому что SQLAlchemy engine асинхронный
import os #нужен, чтобы прочитать переменную окружения
from logging.config import fileConfig #читает настройки логирования из alembic.ini

from alembic import context #главный объект Alembic во время выполнения миграций.
#Через него мы говорим:
# где база;
# какие metadata использовать;
# offline или online режим;
# как запускать миграции.

from dotenv import load_dotenv #load_dotenv() читает .env файл и загружает переменные в окружение Python-процесса
from sqlalchemy import pool #нужен для настройки пула подключений.
from sqlalchemy.engine import Connection #тип синхронного подключения SQLAlchemy.
from sqlalchemy.ext.asyncio import async_engine_from_config #нужен для создания асинхронного движка SQLAlchemy из конфигурации alembic.ini

from src.database import Base # импортируем базовый класс для моделей SQLAlchemy, чтобы Alembic знал, какие модели использовать для генерации миграций.

# импортируем все модели, чтобы Alembic знал о них и мог создавать миграции для всех таблиц.
from src.models.parent_model import ParentModel
from src.models.pending_registration import PendingRegistration
from src.models.password_request_model import PasswordResetRequest
from src.models.family_model import FamilyModel
from src.models.family_member_model import FamilyMemberModel
from src.models.family_join_code_model import FamilyJoinCodeModel
from src.models.event_models import EventModel


load_dotenv() # читает файл .env и загружает переменные из него в окружение Python-процесса.

# объект с настройками Alembic. Он читает alembic.ini и предоставляет доступ к его настройкам. Через него мы можем изменить настройки во время выполнения миграций.
config = context.config

database_url = os.getenv("DATABASE_URL") # берем значение переменной окружения DATABASE_URL, 
# которая содержит URL для подключения к базе данных. Если переменная не установлена, 
# будет выброшено исключение RuntimeError.
if database_url is None:
    raise RuntimeError("DATABASE_URL is not set")

# Подставляем URL базы данных в конфигурацию Alembic, чтобы Alembic знал, к какой базе подключаться.
config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# target_metadata - это объект MetaData, который содержит информацию о всех моделях SQLAlchemy. 
# Alembic использует его для генерации миграций. Мы импортируем Base из src/database.py, а затем берем его metadata.
target_metadata = Base.metadata

# Функция для запуска миграций в offline режиме. В этом режиме Alembic не подключается к базе данных, а просто генерирует SQL-скрипт миграции.
# Потом этот скрипт можно будет выполнить вручную в базе данных.
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url") # берем URL базы данных из конфигурации Alembic.

    # Context.configure настраивает Alembic для работы в offline режиме. Мы передаем URL базы данных, target_metadata и другие параметры.
    context.configure(
        url=url,
        target_metadata=target_metadata, # SQLAlchemy-схема 
        literal_binds=True, # подставлять значения прямо в SQL 
        dialect_opts={"paramstyle": "named"}, # стиль параметров SQL
        compare_type=True, # сравнивать типы колонок
    )

    with context.begin_transaction(): # открываем транзакцию Alembic. В offline режиме это просто логическая транзакция, которая группирует SQL-операции.
        context.run_migrations() # запускает миграции. Alembic будет использовать target_metadata, чтобы понять, какие изменения нужно внести в базу данных, и сгенерирует SQL-скрипт.


# Функция для запуска миграций в online режиме. В этом режиме Alembic подключается к базе данных и выполняет миграции напрямую.
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()

# Функция для запуска миграций в online режиме с использованием асинхронного движка SQLAlchemy. 
# Alembic сам не поддерживает асинхронные движки, поэтому мы создаем синхронное подключение через асинхронный движок.
async def run_async_migrations() -> None:
    connectable = async_engine_from_config( # создает асинхронный движок SQLAlchemy из конфигурации Alembic. 
        #Мы передаем настройки из alembic.ini, префикс "sqlalchemy." и указываем, что хотим использовать NullPool (без пула подключений).
        
        config.get_section(config.config_ini_section, {}), # берем настройки из alembic.ini. config.config_ini_section - это имя секции в alembic.ini, обычно это "alembic".
        prefix="sqlalchemy.",
        poolclass=pool.NullPool, # не использовать пул подключений, потому что Alembic сам управляет подключениями.
    )

    async with connectable.connect() as connection: # открываем асинхронное подключение к базе данных. connectable.connect() возвращает объект Connection, который мы используем для выполнения миграций.
        await connection.run_sync(do_run_migrations) # запускаем do_run_migrations в синхронном контексте. Alembic не поддерживает асинхронные операции, поэтому мы используем run_sync, чтобы выполнить do_run_migrations в синхронном режиме.

    await connectable.dispose() # закрываем асинхронный движок SQLAlchemy. dispose() освобождает все ресурсы, связанные с движком, включая пул подключений.

# Функция для запуска миграций в online режиме. Она просто вызывает run_async_migrations через asyncio.run, чтобы запустить асинхронный код в синхронном контексте.
def run_migrations_online() -> None:
    asyncio.run(run_async_migrations()) # запускает асинхронную функцию run_async_migrations в синхронном контексте. asyncio.run создает новый цикл событий, выполняет run_async_migrations и закрывает цикл событий после завершения.


# Основной блок кода, который определяет, в каком режиме запускать миграции (offline или online).
# Alembic сам определяет режим работы через context.is_offline_mode(). Если Alembic запущен 
# с флагом --sql, то он работает в offline режиме и генерирует SQL-скрипт. Если Alembic запущен 
# без флага --sql, то он работает в online режиме и выполняет миграции напрямую в базе данных.
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
