export type EventCategory =
  | 'school'
  | 'sport'
  | 'doctor'
  | 'homework'
  | 'rest'
  | 'family'
  | 'other';

export type EventStatus = 'planned' | 'done' | 'canceled';

export type CalendarEvent = {
  id: number;
  occurrence_id: string | null;
  is_recurring_instance: boolean;
  family_id: number;
  child_member_id: number;
  created_by_member_id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  category: EventCategory;
  status: EventStatus;
  created_at: string;
  updated_at: string;
  location: string | null;
  recurrence_rule: string | null;
  recurrence_until: string | null;
};

export type EventCreatePayload = {
  child_member_id: number;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  category?: EventCategory;
  location?: string | null;
  recurrence_rule?: string | null;
  recurrence_until?: string | null;
};

export type EventUpdatePayload = Partial<EventCreatePayload> & {
  status?: EventStatus;
};

export type EventCategoryStats = {
  category: EventCategory;
  events_count: number;
  minutes: number;
};

export type EventChildStats = {
  child_member_id: number;
  nickname: string;
  events_count: number;
  minutes: number;
};

export type EventDayStats = {
  date: string;
  events_count: number;
  minutes: number;
};

export type EventStats = {
  total_events: number;
  total_minutes: number;
  by_category: EventCategoryStats[];
  by_child: EventChildStats[];
  by_day: EventDayStats[];
};
