from pathlib import Path
from fastapi import FastAPI
from starlette.responses import HTMLResponse
import uvicorn
from fastapi.staticfiles import StaticFiles
from src.api import main_router
from fastapi.middleware.cors import CORSMiddleware # CORS (Cross-Origin Resource Sharing) - это механизм безопасности, который позволяет ограничить 
#доступ к ресурсам на веб-сервере из других доменов. В FastAPI, CORS middleware используется для настройки правил доступа к ресурсам API из других доменов.
# Это особенно важно при разработке фронтенд-приложений, которые могут находиться на другом домене, чем API. CORS middleware позволяет указать, какие домены 
#могут обращаться к API, какие HTTP-методы разрешены и какие заголовки могут быть использованы при запросах к API.
app = FastAPI() # Создаем экземпляр FastAPI 


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# @app.middleware("http") # позволяет ограничить выполнение определенной функции (в данном случае, my_middleware) только для HTTP-запросов. Это означает, что функция my_middleware будет выполняться для каждого HTTP-запроса, который приходит на сервер, и может использоваться для выполнения различных задач, таких как логирование, аутентификация, обработка ошибок и т.д. В данном случае, мы можем использовать эту функцию для выполнения определенных действий перед обработкой каждого HTTP-запроса. Ограничить количество запросов, например, можно с помощью счетчика и проверки его значения в функции my_middleware. Если количество запросов превышает определенный порог, можно возвращать ошибку или блокировать дальнейшие запросы от клиента. Это может быть полезно для предотвращения злоупотреблений и обеспечения стабильности сервера.
# async def my_middleware(request, call_next): 
#     ...
  
app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static",
)  

@app.get("/", response_class=HTMLResponse) # Декоратор @app.get("/") указывает, что функция root() будет обрабатывать GET-запросы на корневой URL ("/"). Параметр response_class=HTMLResponse указывает, что ответ от этой функции будет возвращаться в виде HTML. Это позволяет нам возвращать HTML-контент, который может быть отображен в браузере при обращении к корневому URL нашего приложения.
async def root():
    return Path("templates/auth.html").read_text()

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    return Path("templates/dashboard.html").read_text()

app.include_router(main_router) # Включаем основной роутер для API, который объединяет все маршруты в одном месте. Это позволяет организовать маршруты в отдельные модули и легко управлять ими.

if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True) #reload=True - это параметр, который указывает Uvicorn автоматически перезагружать сервер при изменении кода.
