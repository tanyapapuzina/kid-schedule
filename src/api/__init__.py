from fastapi import APIRouter
from src.api.auth_router import router as auth_router
from src.api.family_router import router as family_router
from src.api.family_join_code_router import router as family_join_code_router
from src.api.event_router import router as event_router
from src.api.mobile_auth_router import router as mobile_auth_router

main_router = APIRouter()
main_router.include_router(auth_router)
main_router.include_router(family_router)
main_router.include_router(family_join_code_router)
main_router.include_router(event_router)
main_router.include_router(mobile_auth_router)
