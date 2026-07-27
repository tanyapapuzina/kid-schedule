import os 
import httpx
from dotenv import load_dotenv

load_dotenv()

# эта ссылка используется для отправки электронных писем через API Brevo. Она указывает на конечную точку (endpoint) API, которая обрабатывает запросы на отправку писем. Когда вы отправляете POST-запрос на этот URL с необходимыми данными (например, адресами получателей, темой письма и содержимым), Brevo обрабатывает запрос и отправляет электронные письма указанным получателям.
BREVO_SEND_EMAIL_URL = "https://api.brevo.com/v3/smtp/email" 


class BrevoEmailProvider: # Создает класс. Класс - это шаблон объекта. В нашем случае объект умеет отправлять email через Brevo.
    
    def __init__(self):
        self.api_key = os.getenv("BREVO_API_KEY")
        self.sender_name = os.getenv("EMAIL_FROM_NAME")
        self.sender_email = os.getenv("EMAIL_FROM_ADDRESS")

        if not self.api_key:
            raise RuntimeError("BREVO_API_KEY is not set")

        if not self.sender_name:
            raise RuntimeError("EMAIL_FROM_NAME is not set")

        if not self.sender_email:
            raise RuntimeError("EMAIL_FROM_ADDRESS is not set")


    # Создает асинхронный метод.
    # Он будет делать внешний HTTP-запрос, поэтому должен быть async
    async def send_email(
            self, # Ссылка на текущий объект класса.
            *, # Звездочка означает: все параметры после нее нужно передавать только по имени.
            to_email: str,
            subject:  str,
            text_content: str,
            html_content: str,
    ) -> None:  # Метод ничего не возвращает. Если письмо отправлено успешно, он просто завершается. Если не отправлено - выбрасывает ошибку.
        
        # Headers - служебные данные HTTP-запроса.
        headers = { 
            "accept": "application/json",
            "api-key": self.api_key,
            "content-type": "application/json",
        }

        # Payload - тело POST-запроса. Мы отправляем JSON.
        payload = {
            # Отправитель письма
            "sender": {
                "name": self.sender_name,
                "email": self.sender_email,
            },
            # Список получателей. Даже если получатель один, Brevo ожидает список.
            "to": [
                {
                    "email": to_email,
                }
            ],
            "subject": subject, # Тема письма
            "textContent": text_content, # Текстовая версия письма. Нужна для клиентов, которые не показывают HTML.
            "htmlContent": html_content # HTML-версия письма. Нужна для красивого письма.
        }

        # Открывает асинхронный контекст. httpx.AsyncClient создает HTTP-клиент, 
        # а после блока аккуратно закрывает сетевые ресурсы.
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    BREVO_SEND_EMAIL_URL,
                    headers=headers,
                    json=payload, # Говорит httpx: преврати Python-словарь в JSON и отправь его как тело запроса.
                )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError("Email provider rejected the request") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError("Email provider is unavailable") from exc
        