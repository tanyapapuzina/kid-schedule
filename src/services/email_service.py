from typing import Protocol # Protocol позволяет описать "форму" объекта.


class EmailProvider(Protocol): #Любой объект с таким методом подходит как EmailProvider.
    async def send_email(
        self,
        *,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: str,
    ) -> None:
        ...
        
class EmailService:
    # Метод-конструктор. Он вызывается, когда мы создаем объект
    def __init__(self, provider: EmailProvider):
        self.provider = provider

    async def send_registration_pin(self, email: str, pin_code: str) -> None:
        subject = "Код подтверждения Kid Schedule"

        text_content = (
            "Ваш код подтверждения Kid Schedule: "
            f"{pin_code}\n\n"
            "Код действует несколько минут. "
            "Если вы не регистрировались в Kid Schedule, просто проигнорируйте это письмо."
        )

        html_content = f"""
<div style="font-family: Arial, sans-serif; color: #292536;">
  <h2>Код подтверждения Kid Schedule</h2>
  <p>Введите этот код в приложении:</p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">{pin_code}</p>
  <p style="color: #72786A;">
    Код действует несколько минут. Если вы не регистрировались в Kid Schedule,
    просто проигнорируйте это письмо.
  </p>
</div>
"""

        await self.provider.send_email(
            to_email=email,
            subject=subject,
            text_content=text_content,
            html_content=html_content,
        )

    async def send_password_reset_pin(self, email: str, pin_code: str) -> None:
        subject = "Код восстановления пароля Kid Schedule"

        text_content = (
            "Ваш код восстановления пароля Kid Schedule: "
            f"{pin_code}\n\n"
            "Код действует несколько минут. "
            "Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо."
        )

        html_content = f"""
<div style="font-family: Arial, sans-serif; color: #292536;">
  <h2>Код восстановления пароля</h2>
  <p>Введите этот код в приложении:</p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">{pin_code}</p>
  <p style="color: #72786A;">
    Код действует несколько минут. Если вы не запрашивали сброс пароля,
    просто проигнорируйте это письмо.
  </p>
</div>
"""
        
        await self.provider.send_email(
            to_email=email,
            subject=subject,
            text_content=text_content,
            html_content=html_content,
        )