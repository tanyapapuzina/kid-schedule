from datetime import timedelta
from authx import AuthX, AuthXConfig


config = AuthXConfig()
config.JWT_SECRET_KEY = "SECRET_KEY"  # Секрет для подписи JWT. В рабочем проекте храните в переменных окружения.
config.JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)  # Время жизни access token.
config.JWT_TOKEN_LOCATION = ["headers", "cookies"]  # Web берет token из cookies, mobile передает token в Authorization header.
config.JWT_HEADER_NAME = "Authorization"
config.JWT_HEADER_TYPE = "Bearer"

config.JWT_ACCESS_COOKIE_NAME = "my_access_token"  # Имя cookie для access token.
config.JWT_COOKIE_SECURE = False  # Для локального запуска.
config.JWT_COOKIE_HTTP_ONLY = True  # Браузер не может прочитать cookie через JavaScript.
config.JWT_COOKIE_SAMESITE = "lax"  # Защита от CSRF в браузере.
config.JWT_COOKIE_CSRF_PROTECT = True # Включает CSRF-проверку
config.JWT_ACCESS_CSRF_COOKIE_NAME = "csrf_access_token"
config.JWT_ACCESS_CSRF_HEADER_NAME = "X-CSRF-TOKEN" # Имя header, где backend ждет CSRF-token
security = AuthX(config=config)
