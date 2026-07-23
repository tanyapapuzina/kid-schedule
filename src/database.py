import os
from dotenv import load_dotenv
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


load_dotenv() #читает файл .env и загружает переменные из него в окружение Python-процесса.

DATABASE_URL = os.getenv("DATABASE_URL") # берем значение переменной окружения DATABASE_URL, которая содержит URL для подключения к базе данных. Если переменная не установлена, будет выброшено исключение RuntimeError.

if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL is not set")

engine = create_async_engine(DATABASE_URL) # engine - объект SQLAlchemy, который знает, как подключаться к базе данных и выполнять SQL-запросы. create_async_engine - функция, которая создает асинхронный движок для работы с базой данных.
session_local = async_sessionmaker(engine, expire_on_commit=False) # Создаем асинхронную сессию для работы с базой данных

async def get_db() -> AsyncGenerator[AsyncSession, None]: # Функция для получения асинхронной сессии базы данных. AsyncGenerator - это тип, который указывает, что функция является асинхронным генератором, который будет использоваться для управления ресурсами (в данном случае, сессией базы данных) в рамках обработки HTTP-запросов.
    async with session_local() as session: #Открываем асинхронную сессию
        yield session # Передаем сессию в обработчик запроса

class Base(DeclarativeBase): # Базовый класс для моделей SQLAlchemy
    pass


