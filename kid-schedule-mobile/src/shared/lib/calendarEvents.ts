import type { CalendarEvent, EventCategory } from '@/shared/types/event';

export type DisplayCalendarEvent = CalendarEvent & {
  time: string;
  child: string;
  childColor: string;
  childSoftColor: string;
  place: string;
  color: string;
  softColor: string;
};

export const EVENT_PALETTE: Record<EventCategory, { label: string; color: string; softColor: string }> = {
  school: { label: 'Учеба', color: '#FCCCAD', softColor: '#FFF0E5' },
  sport: { label: 'Спорт', color: '#BDE875', softColor: '#F1FBCD' },
  doctor: { label: 'Врач', color: '#DDA6FC', softColor: '#F3E1FF' },
  homework: { label: 'Домашка', color: '#89F8FC', softColor: '#DDFBFB' },
  rest: { label: 'Отдых', color: '#F6E58A', softColor: '#FFF8D4' },
  family: { label: 'Семья', color: '#96A7A8', softColor: '#E8EEEE' },
  other: { label: 'Другое', color: '#C9B7FF', softColor: '#F0EAFF' },
};

export const EVENT_CATEGORIES = Object.keys(EVENT_PALETTE) as EventCategory[];

export function toDisplayEvent(
  event: CalendarEvent,
  memberNames: Map<number, string>,
  memberColors?: Map<number, string>,
): DisplayCalendarEvent {
  const palette = EVENT_PALETTE[event.category] ?? EVENT_PALETTE.other;
  const startsAt = new Date(event.starts_at);
  const childColor = memberColors?.get(event.child_member_id) ?? '#DDA6FC';

  return {
    ...event,
    time: formatTime(startsAt),
    child: memberNames.get(event.child_member_id) ?? 'Участник',
    childColor,
    childSoftColor: hexToRgba(childColor, 0.16),
    place: event.location || 'Без места',
    color: palette.color,
    softColor: palette.softColor,
  };
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hexToRgba(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace('#', '');

  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return `rgba(221, 166, 252, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
