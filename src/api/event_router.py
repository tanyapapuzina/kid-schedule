from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status

from src.api.dependencies import CurrentActorDep, SessionDep
from src.repositories.event_repository import EventRepository
from src.repositories.family_member_repository import FamilyMemberRepository
from src.schemas.events_schems import (
    EventCreateSchema,
    EventSchema,
    EventStatsSchema,
    EventUpdateSchema,
)
from src.services.event_service import EventService


router = APIRouter(prefix="/events", tags=["events"])


def get_event_service(session: SessionDep) -> EventService:
    event_repo = EventRepository(session)
    member_repo = FamilyMemberRepository(session)
    return EventService(event_repo, member_repo)


@router.post(
    "/",
    response_model=EventSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Создать событие календаря",
)
async def create_event(
    data: EventCreateSchema,
    session: SessionDep,
    actor: CurrentActorDep,
):
    service = get_event_service(session)

    try:
        return await service.create_event(actor=actor, data=data)
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.get(
    "/",
    response_model=list[EventSchema],
    summary="Получить события за период",
)
async def list_events(
    session: SessionDep,
    actor: CurrentActorDep,
    start: datetime = Query(...),
    end: datetime = Query(...),
):
    service = get_event_service(session)

    try:
        return await service.list_events(
            actor=actor,
            starts_at=start,
            ends_at=end,
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.get(
    "/stats",
    response_model=EventStatsSchema,
    summary="Получить статистику событий за период",
)
async def get_event_stats(
    session: SessionDep,
    actor: CurrentActorDep,
    start: datetime = Query(...),
    end: datetime = Query(...),
):
    service = get_event_service(session)

    try:
        return await service.get_stats(
            actor=actor,
            starts_at=start,
            ends_at=end,
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.get(
    "/{event_id}",
    response_model=EventSchema,
    summary="Получить событие по id",
)
async def get_event(
    event_id: int,
    session: SessionDep,
    actor: CurrentActorDep,
):
    service = get_event_service(session)

    try:
        return await service.get_event_for_actor(actor=actor, event_id=event_id)
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@router.patch(
    "/{event_id}",
    response_model=EventSchema,
    summary="Изменить событие",
)
async def update_event(
    event_id: int,
    data: EventUpdateSchema,
    session: SessionDep,
    actor: CurrentActorDep,
):
    service = get_event_service(session)

    try:
        return await service.update_event(
            actor=actor,
            event_id=event_id,
            data=data,
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить событие",
)
async def delete_event(
    event_id: int,
    session: SessionDep,
    actor: CurrentActorDep,
):
    service = get_event_service(session)

    try:
        await service.delete_event(actor=actor, event_id=event_id)
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))