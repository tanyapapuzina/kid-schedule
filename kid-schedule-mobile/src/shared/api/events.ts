import { apiRequest } from '@/shared/api/client';
import type {
  CalendarEvent,
  EventCreatePayload,
  EventStats,
  EventUpdatePayload,
} from '@/shared/types/event';

type EventPeriodParams = {
  start: string;
  end: string;
};

function toQueryParams(params: EventPeriodParams): string {
  const searchParams = new URLSearchParams({
    start: params.start,
    end: params.end,
  });

  return searchParams.toString();
}

export async function listEvents(params: EventPeriodParams): Promise<CalendarEvent[]> {
  return apiRequest<CalendarEvent[]>(`/events/?${toQueryParams(params)}`);
}

export async function getEvent(eventId: number): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>(`/events/${eventId}`);
}

export async function createEvent(payload: EventCreatePayload): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>('/events/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateEvent(
  eventId: number,
  payload: EventUpdatePayload,
): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>(`/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteEvent(eventId: number): Promise<void> {
  return apiRequest<void>(`/events/${eventId}`, {
    method: 'DELETE',
  });
}

export async function getEventStats(params: EventPeriodParams): Promise<EventStats> {
  return apiRequest<EventStats>(`/events/stats?${toQueryParams(params)}`);
}
