import os
from datetime import timedelta

from authx import AuthX, AuthXConfig
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if JWT_SECRET_KEY is None:
    raise RuntimeError("JWT_SECRET_KEY is not set")

REFRESH_TOKEN_SECRET_KEY = os.getenv("REFRESH_TOKEN_SECRET_KEY")
if REFRESH_TOKEN_SECRET_KEY is None:
    raise RuntimeError("REFRESH_TOKEN_SECRET_KEY is not set")

ACCESS_TOKEN_EXPIRES_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRES_MINUTES", "30"))
REFRESH_TOKEN_EXPIRES_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRES_DAYS", "30"))
JWT_COOKIE_SECURE = os.getenv("JWT_COOKIE_SECURE", "false").lower() == "true"

config = AuthXConfig()
config.JWT_SECRET_KEY = JWT_SECRET_KEY
config.JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=ACCESS_TOKEN_EXPIRES_MINUTES)

config.JWT_TOKEN_LOCATION = ["headers"]  # mobile передает token в Authorization header.
config.JWT_HEADER_NAME = "Authorization"
config.JWT_HEADER_TYPE = "Bearer"

# web - cookie
#config.JWT_ACCESS_COOKIE_NAME = "my_access_token"  # Имя cookie для access token.
#config.JWT_COOKIE_SECURE = JWT_COOKIE_SECURE
# config.JWT_COOKIE_HTTP_ONLY = True  # Браузер не может прочитать cookie через JavaScript.
# config.JWT_COOKIE_SAMESITE = "lax"  # Защита от CSRF в браузере.
# config.JWT_COOKIE_CSRF_PROTECT = True # Включает CSRF-проверку
# config.JWT_ACCESS_CSRF_COOKIE_NAME = "csrf_access_token"
# config.JWT_ACCESS_CSRF_HEADER_NAME = "X-CSRF-TOKEN" # Имя header, где backend ждет CSRF-token

security = AuthX(config=config)
