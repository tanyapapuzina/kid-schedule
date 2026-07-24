from fastapi import FastAPI
import uvicorn
from src.api import main_router
from fastapi.middleware.cors import CORSMiddleware # CORS (Cross-Origin Resource Sharing) - это механизм безопасности, который позволяет ограничить 
#доступ к ресурсам на веб-сервере из других доменов. В FastAPI, CORS middleware используется для настройки правил доступа к ресурсам API из других доменов.
# Это особенно важно при разработке фронтенд-приложений, которые могут находиться на другом домене, чем API. CORS middleware позволяет указать, какие домены 
#могут обращаться к API, какие HTTP-методы разрешены и какие заголовки могут быть использованы при запросах к API.
app = FastAPI(title="Kid Schedule API") # Создаем экземпляр FastAPI 


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False, # указывает, разрешено ли использование учетных данных (например, cookies или заголовков авторизации) при запросах к API из других доменов. Если установлено в True, браузер будет отправлять учетные данные вместе с запросами к API. Если установлено в False, учетные данные не будут отправляться.
)
app.get("/") 
async def root():
    return {"message": "Kid Schedule API is running."} 



app.include_router(main_router) # Включаем основной роутер для API, который объединяет все маршруты в одном месте. Это позволяет организовать маршруты в отдельные модули и легко управлять ими.

if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True) #reload=True - это параметр, который указывает Uvicorn автоматически перезагружать сервер при изменении кода.
