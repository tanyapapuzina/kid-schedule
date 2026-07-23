import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createEvent, deleteEvent, getEvent, listEvents, updateEvent } from '@/shared/api/events';
import { listFamilies, listFamilyMembers } from '@/shared/api/family';
import { AppTextInput } from '@/shared/components/AppTextInput';
import {
  EVENT_CATEGORIES,
  EVENT_PALETTE,
  toDisplayEvent,
  type DisplayCalendarEvent,
} from '@/shared/lib/calendarEvents';
import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';
import type { CalendarEvent, EventCategory } from '@/shared/types/event';
import type { FamilyMember } from '@/shared/types/family';

type CalendarView = 'schedule' | 'day' | 'threeDays' | 'week' | 'month';
type CalendarFabEdge = 'left' | 'right';
type CalendarFabPosition = {
  bottom: number;
  edge: CalendarFabEdge;
};
type PickerMode = 'startDate' | 'startTime' | 'endDate' | 'endTime' | 'repeat' | null;
type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
type StatsBucket = {
  label: string;
  eventsCount: number;
  minutes: number;
};
type ChildStatsBucket = {
  childMemberId: number;
  color: string;
  eventsCount: number;
  minutes: number;
  nickname: string;
};
type CalendarDrawerStats = {
  averageMinutesPerDay: number;
  busiestLabel: string;
  childStats: ChildStatsBucket[];
  dayStats: StatsBucket[];
  maxChildMinutes: number;
  maxDayMinutes: number;
  periodLabel: string;
  totalEvents: number;
  totalMinutes: number;
};
type PositionedDisplayCalendarEvent = DisplayCalendarEvent & {
  overlapColumnCount: number;
  overlapColumnIndex: number;
};

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const MONTHS_SHORT = ['янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
const WEEKDAY_PICKER_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, '0')}:00`);
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const HOUR_ROW_HEIGHT = 34;
const CALENDAR_FAB_SIZE = 52;
const CALENDAR_FAB_EDGE_GAP = 18;
const CALENDAR_FAB_BOTTOM = 24;
const TIME_WHEEL_REPEAT_COUNT = 7;
const TIME_WHEEL_CENTER_BLOCK = Math.floor(TIME_WHEEL_REPEAT_COUNT / 2);
const TIME_WHEEL_ITEM_HEIGHT = 38;
const REPEAT_OPTIONS: Array<{ value: RepeatMode; label: string; helper: string }> = [
  { value: 'none', label: 'Не повторяется', helper: 'Одно событие' },
  { value: 'daily', label: 'Каждый день', helper: 'Для регулярных событий' },
  { value: 'weekly', label: 'Каждую неделю', helper: 'Можно выбрать дни: пн, ср...' },
  { value: 'monthly', label: 'Каждый месяц', helper: 'В этот день месяца' },
  { value: 'yearly', label: 'Каждый год', helper: 'Дни рождения и традиции' },
];

const LOAD_COLORS = {
  low: '#54C88A',
  medium: '#F0C84B',
  high: '#F29B4B',
  extreme: '#D85C5C',
};

const VIEW_OPTIONS: Array<{ value: CalendarView; label: string; icon: string }> = [
  { value: 'schedule', label: 'Расписание', icon: '≡' },
  { value: 'day', label: 'День', icon: '▭' },
  { value: 'threeDays', label: '3 дня', icon: '▥' },
  { value: 'week', label: 'Неделя', icon: '▥' },
  { value: 'month', label: 'Месяц', icon: '▦' },
];

export default function CalendarScreen() {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [shouldHighlightSelectedDate, setShouldHighlightSelectedDate] = useState(true);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(visibleMonth.getFullYear());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDate, setDraftDate] = useState(selectedDate);
  const [draftEndDate, setDraftEndDate] = useState(selectedDate);
  const [draftStartTime, setDraftStartTime] = useState('09:00');
  const [draftEndTime, setDraftEndTime] = useState('10:00');
  const [draftPlace, setDraftPlace] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftAllDay, setDraftAllDay] = useState(false);
  const [draftCategory, setDraftCategory] = useState<EventCategory>('school');
  const [draftRepeat, setDraftRepeat] = useState<RepeatMode>('none');
  const [draftRepeatDays, setDraftRepeatDays] = useState<string[]>(['MO']);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [visibleChildIds, setVisibleChildIds] = useState<number[]>([]);
  const [familyId, setFamilyId] = useState<number | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DisplayCalendarEvent | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPlace, setEditPlace] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<EventCategory>('school');
  const [editDate, setEditDate] = useState(selectedDate);
  const [editEndDate, setEditEndDate] = useState(selectedDate);
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('10:00');
  const [editAllDay, setEditAllDay] = useState(false);
  const [editRepeat, setEditRepeat] = useState<RepeatMode>('none');
  const [editRepeatDays, setEditRepeatDays] = useState<string[]>(['MO']);
  const [editChildId, setEditChildId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEventActionLoading, setIsEventActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [eventActionError, setEventActionError] = useState<string | null>(null);
  const [fabPosition, setFabPosition] = useState<CalendarFabPosition>({
    bottom: CALENDAR_FAB_BOTTOM,
    edge: 'right',
  });
  const monthPickerScrollRef = useRef<ScrollView | null>(null);
  const fabPositionRef = useRef(fabPosition);
  const fabDragStartRef = useRef(fabPosition);
  const didDragFabRef = useRef(false);

  const monthDays = useMemo(() => getMonthGrid(visibleMonth), [visibleMonth]);
  const visibleDates = useMemo(
    () => getVisibleDates(calendarView, selectedDate),
    [calendarView, selectedDate],
  );
  const children = useMemo(() => members.filter((member) => member.role === 'child'), [members]);
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.nickname])),
    [members],
  );
  const memberColors = useMemo(
    () => new Map(members.map((member) => [member.id, getMemberColor(member)])),
    [members],
  );
  const displayEvents = useMemo(
    () => events.map((event) => toDisplayEvent(event, memberNames, memberColors)),
    [events, memberColors, memberNames],
  );
  const childFilteredEvents = useMemo(() => {
    if (visibleChildIds.length === 0) {
      return displayEvents;
    }

    return displayEvents.filter((event) => visibleChildIds.includes(event.child_member_id));
  }, [displayEvents, visibleChildIds]);
  const filteredEvents = useMemo(
    () => [...childFilteredEvents].sort(sortEventsByDateAndTime),
    [childFilteredEvents],
  );
  const calendarStats = useMemo(
    () => buildCalendarDrawerStats(filteredEvents, children, calendarView, selectedDate, visibleMonth),
    [calendarView, children, filteredEvents, selectedDate, visibleMonth],
  );
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return filteredEvents.filter((event) =>
      [event.title, event.child, event.place, event.category].some((value) =>
        String(value).toLowerCase().includes(query),
      ),
    );
  }, [filteredEvents, searchQuery]);

  useEffect(() => {
    fabPositionRef.current = fabPosition;
  }, [fabPosition]);

  useEffect(() => {
    const maxBottom = Math.max(CALENDAR_FAB_BOTTOM, screenHeight - CALENDAR_FAB_SIZE - 170);

    setFabPosition((currentPosition) => ({
      ...currentPosition,
      bottom: clamp(currentPosition.bottom, CALENDAR_FAB_BOTTOM, maxBottom),
    }));
  }, [screenHeight]);

  const fabPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6,
        onPanResponderGrant: () => {
          didDragFabRef.current = false;
          fabDragStartRef.current = fabPositionRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const maxBottom = Math.max(CALENDAR_FAB_BOTTOM, screenHeight - CALENDAR_FAB_SIZE - 170);
          const nextBottom = clamp(
            fabDragStartRef.current.bottom - gestureState.dy,
            CALENDAR_FAB_BOTTOM,
            maxBottom,
          );

          if (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6) {
            didDragFabRef.current = true;
          }

          setFabPosition((currentPosition) => ({
            ...currentPosition,
            bottom: nextBottom,
          }));
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextEdge: CalendarFabEdge = gestureState.moveX < screenWidth / 2 ? 'left' : 'right';

          setFabPosition((currentPosition) => ({
            ...currentPosition,
            edge: nextEdge,
          }));

          setTimeout(() => {
            didDragFabRef.current = false;
          }, 0);
        },
        onPanResponderTerminate: () => {
          setTimeout(() => {
            didDragFabRef.current = false;
          }, 0);
        },
      }),
    [screenHeight, screenWidth],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadFamilyData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const families = await listFamilies();
        const currentFamily = families[0];

        if (!currentFamily) {
          if (!isCancelled) {
            setFamilyId(null);
            setMembers([]);
            setEvents([]);
            setLoadError('Сначала создайте семью, чтобы вести расписание.');
          }
          return;
        }

        const familyMembers = await listFamilyMembers(currentFamily.id);
        const firstChild = familyMembers.find((member) => member.role === 'child');

        if (!isCancelled) {
          setFamilyId(currentFamily.id);
          setMembers(familyMembers);
          setSelectedChildId((currentChildId) => currentChildId ?? firstChild?.id ?? null);
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setLoadError(caughtError instanceof Error ? caughtError.message : 'Не удалось загрузить семью.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFamilyData();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadCalendarEvents() {
      if (familyId === null) {
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const period = getMonthPeriod(visibleMonth);
        const periodParams = {
          start: toLocalApiDateTime(period.start),
          end: toLocalApiDateTime(period.end),
        };
        const loadedEvents = await listEvents(periodParams);

        if (!isCancelled) {
          setEvents(loadedEvents);
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setLoadError(caughtError instanceof Error ? caughtError.message : 'Не удалось загрузить события.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCalendarEvents();

    return () => {
      isCancelled = true;
    };
  }, [familyId, visibleMonth]);

  useEffect(() => {
    if (!isMonthPickerOpen) {
      return;
    }

    setMonthPickerYear(visibleMonth.getFullYear());

    requestAnimationFrame(() => {
      monthPickerScrollRef.current?.scrollTo({
        animated: false,
        x: Math.max(0, visibleMonth.getMonth() * 76 - 116),
      });
    });
  }, [isMonthPickerOpen, visibleMonth]);

  function changeView(nextView: CalendarView) {
    setCalendarView(nextView);
  }

  function toggleVisibleChild(childId: number) {
    setVisibleChildIds((currentIds) => {
      if (currentIds.includes(childId)) {
        return currentIds.filter((id) => id !== childId);
      }

      return [...currentIds, childId];
    });
  }

  function handleTodayPress() {
    setSelectedDate(today);
    setVisibleMonth(startOfMonth(today));
    setShouldHighlightSelectedDate(true);
  }

  function handleMonthPress(monthIndex: number) {
    const nextDate = new Date(monthPickerYear, monthIndex, 1);

    setVisibleMonth(nextDate);
    setSelectedDate(nextDate);
    setShouldHighlightSelectedDate(true);
    setIsMonthPickerOpen(false);
  }

  function shiftPeriod(direction: -1 | 1) {
    const days = calendarView === 'day' ? 1 : calendarView === 'threeDays' ? 3 : calendarView === 'week' ? 7 : 0;

    if (calendarView === 'month') {
      const nextMonth = new Date(visibleMonth);
      nextMonth.setMonth(nextMonth.getMonth() + direction);
      setVisibleMonth(startOfMonth(nextMonth));
      setSelectedDate(startOfMonth(nextMonth));
      setShouldHighlightSelectedDate(false);
      return;
    }

    if (calendarView === 'schedule') {
      const nextMonth = new Date(visibleMonth);
      nextMonth.setMonth(nextMonth.getMonth() + direction);
      setVisibleMonth(startOfMonth(nextMonth));
      setSelectedDate(startOfMonth(nextMonth));
      setShouldHighlightSelectedDate(false);
      return;
    }

    const nextDate = addDays(selectedDate, direction * days);
    setSelectedDate(nextDate);
    setVisibleMonth(startOfMonth(nextDate));
    setShouldHighlightSelectedDate(false);
  }

  function handleDayPress(date: Date) {
    setSelectedDate(date);
    setVisibleMonth(startOfMonth(date));
    setShouldHighlightSelectedDate(true);
  }

  function togglePickerMode(nextMode: PickerMode) {
    setPickerMode((currentMode) => (currentMode === nextMode ? null : nextMode));
  }

  function openCreateEvent(date: Date, startTime = getDefaultDraftStartTime(new Date())) {
    const normalizedDate = startOfDay(date);
    const endTime = ensureEndTimeAfterStart(startTime, startTime);

    setFormError(null);
    setPickerMode(null);
    setDraftDate(normalizedDate);
    setDraftEndDate(normalizedDate);
    setDraftStartTime(startTime);
    setDraftEndTime(endTime);
    setSelectedChildId((currentChildId) =>
      visibleChildIds.length === 1 ? visibleChildIds[0] : currentChildId,
    );
    setIsCreateOpen(true);
  }

  async function handleCreateEvent() {
    const title = draftTitle.trim();

    if (!title) {
      setFormError('Введите название события.');
      return;
    }

    if (selectedChildId === null) {
      setFormError('Сначала добавьте ребенка в семью.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const startsAt = draftAllDay ? draftDate : dateWithTime(draftDate, draftStartTime.trim() || '09:00');
      let endsAt = draftAllDay ? addDays(draftEndDate, 1) : dateWithTime(draftEndDate, draftEndTime.trim() || '10:00');

      if (endsAt <= startsAt) {
        endsAt = draftAllDay ? addDays(startsAt, 1) : addMinutes(startsAt, 60);
      }

      const recurrenceRule = buildRecurrenceRule(draftRepeat, draftRepeatDays);
      const payload = {
        child_member_id: selectedChildId,
        title,
        description: draftDescription.trim() || null,
        starts_at: toLocalApiDateTime(startsAt),
        ends_at: toLocalApiDateTime(endsAt),
        all_day: draftAllDay,
        category: draftCategory,
        location: draftPlace.trim() || null,
        recurrence_rule: recurrenceRule,
        recurrence_until: null,
      };

      console.log('Creating event payload:', payload);
      await createEvent(payload);

      const targetMonth = startOfMonth(draftDate);
      const period = getMonthPeriod(targetMonth);
      const periodParams = {
        start: toLocalApiDateTime(period.start),
        end: toLocalApiDateTime(period.end),
      };
      const loadedEvents = await listEvents(periodParams);

      setSelectedDate(draftDate);
      setVisibleMonth(targetMonth);
      setEvents(loadedEvents);
      resetDraft();
      setIsCreateOpen(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Не удалось создать событие.';
      console.log('Create event error:', message);
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenEvent(eventId: number) {
    setEventActionError(null);
    setIsEditingEvent(false);

    try {
      const loadedEvent = await getEvent(eventId);
      setSelectedEvent(toDisplayEvent(loadedEvent, memberNames, memberColors));
    } catch (caughtError) {
      setEventActionError(caughtError instanceof Error ? caughtError.message : 'Не удалось открыть событие.');
    }
  }

  function handleCloseSelectedEvent() {
    setSelectedEvent(null);
    setIsEditingEvent(false);
    setEventActionError(null);
  }

  function handleStartEditEvent() {
    if (!selectedEvent) {
      return;
    }

    const startsAt = new Date(selectedEvent.starts_at);
    const endsAt = new Date(selectedEvent.ends_at);

    setEditTitle(selectedEvent.title);
    setEditPlace(selectedEvent.location ?? '');
    setEditDescription(selectedEvent.description ?? '');
    setEditCategory(selectedEvent.category);
    setEditDate(startOfDay(startsAt));
    setEditEndDate(startOfDay(selectedEvent.all_day ? addDays(endsAt, -1) : endsAt));
    setEditStartTime(minutesToTime(startsAt.getHours() * 60 + startsAt.getMinutes()));
    setEditEndTime(minutesToTime(endsAt.getHours() * 60 + endsAt.getMinutes()));
    setEditAllDay(selectedEvent.all_day);
    setEditRepeat(parseRepeatMode(selectedEvent.recurrence_rule));
    setEditRepeatDays(parseRepeatDays(selectedEvent.recurrence_rule));
    setEditChildId(selectedEvent.child_member_id);
    setPickerMode(null);
    setEventActionError(null);
    setIsEditingEvent(true);
  }

  function handleCancelEditEvent() {
    setIsEditingEvent(false);
    setEventActionError(null);
  }

  async function handleSaveEventEdit() {
    if (!selectedEvent) {
      return;
    }

    const title = editTitle.trim();

    if (!title) {
      setEventActionError('Введите название события.');
      return;
    }

    if (editChildId === null) {
      setEventActionError('Выберите ребенка для события.');
      return;
    }

    setIsEventActionLoading(true);
    setEventActionError(null);

    try {
      const startsAt = editAllDay ? editDate : dateWithTime(editDate, editStartTime.trim() || '09:00');
      let endsAt = editAllDay ? addDays(editEndDate, 1) : dateWithTime(editEndDate, editEndTime.trim() || '10:00');

      if (endsAt <= startsAt) {
        endsAt = editAllDay ? addDays(startsAt, 1) : addMinutes(startsAt, 60);
      }

      const updated = await updateEvent(selectedEvent.id, {
        title,
        child_member_id: editChildId,
        location: editPlace.trim() || null,
        description: editDescription.trim() || null,
        category: editCategory,
        starts_at: toLocalApiDateTime(startsAt),
        ends_at: toLocalApiDateTime(endsAt),
        all_day: editAllDay,
        recurrence_rule: buildRecurrenceRule(editRepeat, editRepeatDays),
        recurrence_until: null,
      });

      setEvents((currentEvents) =>
        currentEvents.map((event) => (event.id === updated.id ? updated : event)),
      );
      setSelectedEvent(toDisplayEvent(updated, memberNames, memberColors));
      setIsEditingEvent(false);
    } catch (caughtError) {
      setEventActionError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить событие.');
    } finally {
      setIsEventActionLoading(false);
    }
  }

  async function handleDeleteSelectedEvent() {
    if (!selectedEvent) {
      return;
    }

    setIsEventActionLoading(true);
    setEventActionError(null);

    try {
      await deleteEvent(selectedEvent.id);
      setEvents((currentEvents) => currentEvents.filter((event) => event.id !== selectedEvent.id));
      setSelectedEvent(null);
      setIsEditingEvent(false);
    } catch (caughtError) {
      setEventActionError(caughtError instanceof Error ? caughtError.message : 'Не удалось удалить событие.');
    } finally {
      setIsEventActionLoading(false);
    }
  }

  function resetDraft() {
    setDraftTitle('');
    setDraftDate(selectedDate);
    setDraftEndDate(selectedDate);
    setDraftStartTime('09:00');
    setDraftEndTime('10:00');
    setDraftPlace('');
    setDraftDescription('');
    setDraftAllDay(false);
    setDraftCategory('school');
    setDraftRepeat('none');
    setDraftRepeatDays(['MO']);
    setPickerMode(null);
  }

  const isGridView = calendarView === 'day' || calendarView === 'threeDays' || calendarView === 'week';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.googleShell}>
        <View style={styles.appBar}>
          <Pressable accessibilityRole="button" onPress={() => setIsDrawerOpen(true)} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>☰</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setIsMonthPickerOpen((isOpen) => !isOpen)}
            style={styles.monthButton}>
            <Text style={styles.monthButtonText}>{MONTHS[visibleMonth.getMonth()].toLowerCase()}</Text>
            <Text style={styles.monthChevron}>{isMonthPickerOpen ? '⌃' : '⌄'}</Text>
          </Pressable>

          <View style={styles.appBarSpacer} />

          <Pressable accessibilityRole="button" onPress={() => setIsSearchOpen(true)} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>⌕</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleTodayPress} style={styles.todayIconButton}>
            <Text style={styles.todayIconText}>{today.getDate()}</Text>
          </Pressable>
          <View style={styles.accountCircle}>
            <Text style={styles.accountText}>T</Text>
          </View>
        </View>

        {isMonthPickerOpen ? (
          <View style={styles.monthPickerPanel}>
            <View style={styles.monthPickerYearRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMonthPickerYear((currentYear) => currentYear - 1)}
                style={styles.monthPickerYearButton}>
                <Text style={styles.monthPickerYearButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.monthPickerYearText}>{monthPickerYear}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMonthPickerYear((currentYear) => currentYear + 1)}
                style={styles.monthPickerYearButton}>
                <Text style={styles.monthPickerYearButtonText}>›</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={monthPickerScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.monthStripScroll}
              contentContainerStyle={styles.monthStrip}>
              {MONTHS_SHORT.map((month, index) => {
                const isActive = index === visibleMonth.getMonth() && monthPickerYear === visibleMonth.getFullYear();

                return (
                  <Pressable
                    key={month}
                    accessibilityRole="button"
                    onPress={() => handleMonthPress(index)}
                    style={[styles.monthStripChip, isActive && styles.monthStripChipActive]}>
                    <Text style={[styles.monthStripText, isActive && styles.monthStripTextActive]}>{month}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {isLoading && !loadError ? (
          <View style={styles.loadingLine}>
            <Text style={styles.loadingText}>Загружаем расписание...</Text>
          </View>
        ) : null}

        {!isGridView ? (
          <View style={styles.periodControls}>
            <Pressable accessibilityRole="button" onPress={() => shiftPeriod(-1)} style={styles.periodButton}>
              <Text style={styles.periodButtonText}>‹</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleTodayPress} style={styles.periodTodayButton}>
              <Text style={styles.periodTodayText}>Сегодня</Text>
              <Text style={styles.periodTodayDate}>{formatHeaderPeriod(calendarView, selectedDate, visibleMonth)}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => shiftPeriod(1)} style={styles.periodButton}>
              <Text style={styles.periodButtonText}>›</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.calendarBody}>
          {calendarView === 'month' ? (
            <MonthView
              dates={monthDays}
              displayEvents={filteredEvents}
              selectedDate={selectedDate}
              today={today}
              visibleMonth={visibleMonth}
              onDayPress={handleDayPress}
              onDayLongPress={(date) => openCreateEvent(date)}
              onEventPress={handleOpenEvent}
              onSwipe={shiftPeriod}
            />
          ) : null}

          {calendarView === 'schedule' ? (
            <ScheduleView
              emptyText={
                visibleChildIds.length
                  ? 'Для выбранных детей в этом периоде событий нет.'
                  : 'Нажмите +, чтобы добавить первое событие.'
              }
              events={filteredEvents}
              onEventPress={handleOpenEvent}
            />
          ) : null}

          {calendarView === 'day' || calendarView === 'threeDays' || calendarView === 'week' ? (
            <TimeGridView
              dates={visibleDates}
              events={filteredEvents}
              onDayPress={handleDayPress}
              onEventPress={handleOpenEvent}
              onSlotPress={openCreateEvent}
              onSwipe={shiftPeriod}
              selectedDate={selectedDate}
              shouldHighlightSelectedDate={shouldHighlightSelectedDate}
              today={today}
            />
          ) : null}
        </View>

        {eventActionError ? <Text style={styles.errorText}>{eventActionError}</Text> : null}

        <View
          {...fabPanResponder.panHandlers}
          style={[
            styles.googleFabWrapper,
            fabPosition.edge === 'left'
              ? { bottom: fabPosition.bottom, left: CALENDAR_FAB_EDGE_GAP }
              : { bottom: fabPosition.bottom, right: CALENDAR_FAB_EDGE_GAP },
          ]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (didDragFabRef.current) {
                return;
              }

              openCreateEvent(selectedDate);
            }}
            style={({ pressed }) => [styles.googleFab, pressed ? styles.googleFabPressed : null]}>
            <Text style={styles.googleFabText}>＋</Text>
          </Pressable>
        </View>
      </View>

      <Modal animationType="fade" transparent visible={isDrawerOpen}>
        <View style={styles.drawerOverlay}>
          <Pressable
            accessibilityLabel="Закрыть меню календаря"
            accessibilityRole="button"
            onPress={() => setIsDrawerOpen(false)}
            style={styles.drawerBackdrop}
          />

          <SafeAreaView edges={['top']} style={styles.drawer}>
            <ScrollView
              bounces
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.drawerScroll}
              contentContainerStyle={styles.drawerContent}>
              <View>
                <Text style={styles.drawerBrand}>Kid Schedule</Text>

                <View style={styles.drawerSection}>
                  {VIEW_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      onPress={() => changeView(option.value)}
                      style={[styles.drawerItem, calendarView === option.value && styles.drawerItemActive]}>
                      <Text style={styles.drawerIcon}>{option.icon}</Text>
                      <Text style={[styles.drawerItemText, calendarView === option.value && styles.drawerItemTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.drawerSection}>
                  <Text style={styles.drawerProfile}>Дети</Text>
                  <ChildFilterToggle
                    color={colors.mint}
                    isActive={visibleChildIds.length === 0}
                    label="Все дети"
                    onPress={() => setVisibleChildIds([])}
                  />
                  {children.map((child) => {
                    const color = getMemberColor(child);

                    return (
                      <ChildFilterToggle
                        key={child.id}
                        color={color}
                        isActive={visibleChildIds.includes(child.id)}
                        label={child.nickname}
                        onPress={() => toggleVisibleChild(child.id)}
                      />
                    );
                  })}
                  {!children.length ? (
                    <Text style={styles.drawerEmptyText}>Сначала добавьте ребенка во вкладке Семья.</Text>
                  ) : null}
                </View>

                <View style={styles.drawerSection}>
                  <Text style={styles.drawerProfile}>Семейный календарь</Text>
                  <DrawerStatsCard stats={calendarStats} />
                </View>

                <View style={styles.drawerSection}>
                  <DrawerPlainItem icon="⚙" label="Настройки" />
                  <DrawerPlainItem icon="?" label="Справка" />
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={isSearchOpen}>
        <View style={styles.modalOverlay}>
          <View style={styles.searchSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Поиск</Text>
              <Pressable accessibilityRole="button" onPress={() => setIsSearchOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <AppTextInput
              autoFocus
              label="Название, ребенок или место"
              onChangeText={setSearchQuery}
              placeholder="Название события"
              value={searchQuery}
            />

            <ScheduleView
              emptyText="По текущему фильтру ничего не найдено."
              events={searchResults}
              onEventPress={handleOpenEvent}
            />
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={isCreateOpen}>
        <View style={styles.modalOverlay}>
          <View style={styles.eventEditor}>
            <View style={styles.editorHandle} />
            <View style={styles.editorTopBar}>
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => {
                  setIsCreateOpen(false);
                  setFormError(null);
                }}
                style={styles.editorTopActionButton}>
                <Text style={styles.editorAction}>Отменить</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={handleCreateEvent}
                disabled={isSaving}
                style={styles.editorTopActionButton}>
                <Text style={styles.editorAction}>{isSaving ? 'Сохраняем...' : 'Сохранить'}</Text>
              </Pressable>
            </View>

            {formError ? <Text style={styles.editorTopError}>{formError}</Text> : null}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.editorScroll}
              contentContainerStyle={styles.editorScrollContent}>
              <AppTextInput
                label=""
                onChangeText={setDraftTitle}
                placeholder="Добавьте название"
                value={draftTitle}
              />

              <View style={styles.categoryPickerBlock}>
                <Text style={styles.fieldCaption}>Категория</Text>
                <View style={styles.eventKindRow}>
                  {EVENT_CATEGORIES.map((category) => {
                    const palette = EVENT_PALETTE[category];

                    return (
                      <CategoryChip
                        key={category}
                        color={palette.color}
                        isActive={draftCategory === category}
                        label={palette.label}
                        softColor={palette.softColor}
                        onPress={() => setDraftCategory(category)}
                      />
                    );
                  })}
                </View>
              </View>

              <View style={styles.editorRows}>
                <EditorRow icon="◷">
                  <View style={styles.rowBetween}>
                    <Text style={styles.editorRowText}>Весь день</Text>
                    <Pressable
                      accessibilityRole="switch"
                      onPress={() => setDraftAllDay((current) => !current)}
                      style={[styles.switchTrack, draftAllDay && styles.switchTrackActive]}>
                      <View style={[styles.switchThumb, draftAllDay && styles.switchThumbActive]} />
                    </Pressable>
                  </View>
                </EditorRow>

                <EditorRow icon="📅">
                  <View style={styles.timeRow}>
                    <Pressable accessibilityRole="button" onPress={() => togglePickerMode('startDate')} style={styles.valueButton}>
                      <Text style={styles.valueButtonText}>{formatLongDate(draftDate)}</Text>
                    </Pressable>
                    {!draftAllDay ? (
                      <Pressable accessibilityRole="button" onPress={() => togglePickerMode('startTime')} style={styles.timeValueButton}>
                        <Text style={styles.valueButtonText}>{draftStartTime}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </EditorRow>

                {pickerMode === 'startDate' ? (
                  <InlinePicker>
                    <DatePickerSheet
                      selectedDate={draftDate}
                      visibleMonth={startOfMonth(draftDate)}
                      onSelect={(date) => {
                        setDraftDate(date);
                        if (draftEndDate < date) {
                          setDraftEndDate(date);
                        }
                      }}
                    />
                  </InlinePicker>
                ) : null}

                {pickerMode === 'startTime' ? (
                  <InlinePicker>
                    <TimePickerSheet
                      selectedTime={draftStartTime}
                      title="Начало"
                      onSelect={(time) => {
                        setDraftStartTime(time);
                        setDraftEndTime(ensureEndTimeAfterStart(time, draftEndTime));
                      }}
                    />
                  </InlinePicker>
                ) : null}

                {!draftAllDay ? (
                  <EditorRow icon=" ">
                    <View style={styles.timeRow}>
                      <Pressable accessibilityRole="button" onPress={() => togglePickerMode('endDate')} style={styles.valueButton}>
                        <Text style={styles.valueButtonText}>{formatLongDate(draftEndDate)}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => togglePickerMode('endTime')} style={styles.timeValueButton}>
                        <Text style={styles.valueButtonText}>{draftEndTime}</Text>
                      </Pressable>
                    </View>
                  </EditorRow>
                ) : null}

                {pickerMode === 'endDate' ? (
                  <InlinePicker>
                    <DatePickerSheet
                      selectedDate={draftEndDate}
                      visibleMonth={startOfMonth(draftEndDate)}
                      onSelect={(date) => {
                        setDraftEndDate(date);
                      }}
                    />
                  </InlinePicker>
                ) : null}

                {pickerMode === 'endTime' ? (
                  <InlinePicker>
                    <TimePickerSheet
                      selectedTime={draftEndTime}
                      title="Окончание"
                      onSelect={(time) => {
                        setDraftEndTime(time);
                      }}
                    />
                  </InlinePicker>
                ) : null}

                <EditorRow icon="↻">
                  <Pressable accessibilityRole="button" onPress={() => togglePickerMode('repeat')} style={styles.valueButtonWide}>
                    <Text style={styles.valueButtonText}>{formatRepeatLabel(draftRepeat, draftRepeatDays)}</Text>
                  </Pressable>
                </EditorRow>

                {pickerMode === 'repeat' ? (
                  <InlinePicker>
                    <RepeatPickerSheet
                      repeatMode={draftRepeat}
                      repeatDays={draftRepeatDays}
                      onChangeMode={setDraftRepeat}
                      onToggleDay={(dayCode) => {
                        setDraftRepeatDays((currentDays) => {
                          if (currentDays.includes(dayCode)) {
                            return currentDays.length === 1 ? currentDays : currentDays.filter((day) => day !== dayCode);
                          }

                          return [...currentDays, dayCode];
                        });
                      }}
                    />
                  </InlinePicker>
                ) : null}

                <EditorRow icon="👥">
                  <View style={styles.choiceRow}>
                    {children.map((child) => (
                      <Pressable
                        key={child.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedChildId(child.id)}
                        style={[styles.choiceChip, selectedChildId === child.id && styles.choiceChipActive]}>
                        <Text style={[styles.choiceChipText, selectedChildId === child.id && styles.choiceChipTextActive]}>
                          {child.nickname}
                        </Text>
                      </Pressable>
                    ))}
                    {!children.length ? <Text style={styles.editorMutedText}>Сначала добавьте ребенка</Text> : null}
                  </View>
                </EditorRow>

                <EditorRow icon="📍">
                  <AppTextInput
                    label=""
                    onChangeText={setDraftPlace}
                    placeholder="Укажите место"
                    value={draftPlace}
                  />
                </EditorRow>

                <EditorRow icon="🔔">
                  <Text style={styles.editorMutedText}>За 30 минут</Text>
                </EditorRow>

                <EditorRow icon="☰">
                  <AppTextInput
                    label=""
                    onChangeText={setDraftDescription}
                    placeholder="Добавьте описание"
                    value={draftDescription}
                  />
                </EditorRow>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={selectedEvent !== null}>
        <View style={styles.modalOverlay}>
          <View style={styles.eventEditor}>
            <View style={styles.editorHandle} />
            <View style={styles.editorTopBar}>
              <Pressable
                accessibilityRole="button"
                onPress={isEditingEvent ? handleCancelEditEvent : handleCloseSelectedEvent}>
                <Text style={styles.editorAction}>{isEditingEvent ? 'Отмена' : 'Закрыть'}</Text>
              </Pressable>
              {isEditingEvent ? (
                <Pressable accessibilityRole="button" onPress={handleSaveEventEdit}>
                  <Text style={styles.editorAction}>{isEventActionLoading ? 'Сохраняем...' : 'Сохранить'}</Text>
                </Pressable>
              ) : (
                <View style={styles.detailTopActions}>
                  <Pressable accessibilityRole="button" onPress={handleStartEditEvent}>
                    <Text style={styles.editorAction}>Изменить</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={handleDeleteSelectedEvent}>
                    <Text style={styles.editorDanger}>{isEventActionLoading ? 'Удаляем...' : 'Удалить'}</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {selectedEvent ? (
              <ScrollView contentContainerStyle={styles.eventDetails} showsVerticalScrollIndicator={false}>
                {isEditingEvent ? (
                  <>
                    <AppTextInput
                      label="Название"
                      onChangeText={setEditTitle}
                      placeholder="Название события"
                      value={editTitle}
                    />

                    <View style={styles.categoryPickerBlock}>
                      <Text style={styles.fieldCaption}>Категория</Text>
                      <View style={styles.eventKindRow}>
                        {EVENT_CATEGORIES.map((category) => (
                          <CategoryChip
                            color={EVENT_PALETTE[category].color}
                            isActive={editCategory === category}
                            key={category}
                            label={EVENT_PALETTE[category].label}
                            softColor={EVENT_PALETTE[category].softColor}
                            onPress={() => setEditCategory(category)}
                          />
                        ))}
                      </View>
                    </View>

                    <AppTextInput
                      label="Место"
                      onChangeText={setEditPlace}
                      placeholder="Кабинет, адрес или секция"
                      value={editPlace}
                    />

                    <AppTextInput
                      label="Описание"
                      multiline
                      onChangeText={setEditDescription}
                      placeholder="Заметки для семьи"
                      style={styles.detailDescriptionInput}
                      textAlignVertical="top"
                      value={editDescription}
                    />

                    <View style={styles.editorRows}>
                      <EditorRow icon="◷">
                        <View style={styles.rowBetween}>
                          <Text style={styles.editorRowText}>Весь день</Text>
                          <Pressable
                            accessibilityRole="switch"
                            onPress={() => setEditAllDay((current) => !current)}
                            style={[styles.switchTrack, editAllDay && styles.switchTrackActive]}>
                            <View style={[styles.switchThumb, editAllDay && styles.switchThumbActive]} />
                          </Pressable>
                        </View>
                      </EditorRow>

                      <EditorRow icon="📅">
                        <View style={styles.timeRow}>
                          <Pressable accessibilityRole="button" onPress={() => togglePickerMode('startDate')} style={styles.valueButton}>
                            <Text style={styles.valueButtonText}>{formatLongDate(editDate)}</Text>
                          </Pressable>
                          {!editAllDay ? (
                            <Pressable accessibilityRole="button" onPress={() => togglePickerMode('startTime')} style={styles.timeValueButton}>
                              <Text style={styles.valueButtonText}>{editStartTime}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </EditorRow>

                      {pickerMode === 'startDate' ? (
                        <InlinePicker>
                          <DatePickerSheet
                            selectedDate={editDate}
                            visibleMonth={startOfMonth(editDate)}
                            onSelect={(date) => {
                              setEditDate(date);
                              if (editEndDate < date) {
                                setEditEndDate(date);
                              }
                            }}
                          />
                        </InlinePicker>
                      ) : null}

                      {pickerMode === 'startTime' ? (
                        <InlinePicker>
                          <TimePickerSheet
                            selectedTime={editStartTime}
                            title="Начало"
                            onSelect={(time) => {
                              setEditStartTime(time);
                              setEditEndTime(ensureEndTimeAfterStart(time, editEndTime));
                            }}
                          />
                        </InlinePicker>
                      ) : null}

                      {!editAllDay ? (
                        <EditorRow icon=" ">
                          <View style={styles.timeRow}>
                            <Pressable accessibilityRole="button" onPress={() => togglePickerMode('endDate')} style={styles.valueButton}>
                              <Text style={styles.valueButtonText}>{formatLongDate(editEndDate)}</Text>
                            </Pressable>
                            <Pressable accessibilityRole="button" onPress={() => togglePickerMode('endTime')} style={styles.timeValueButton}>
                              <Text style={styles.valueButtonText}>{editEndTime}</Text>
                            </Pressable>
                          </View>
                        </EditorRow>
                      ) : null}

                      {pickerMode === 'endDate' ? (
                        <InlinePicker>
                          <DatePickerSheet
                            selectedDate={editEndDate}
                            visibleMonth={startOfMonth(editEndDate)}
                            onSelect={setEditEndDate}
                          />
                        </InlinePicker>
                      ) : null}

                      {pickerMode === 'endTime' ? (
                        <InlinePicker>
                          <TimePickerSheet
                            selectedTime={editEndTime}
                            title="Окончание"
                            onSelect={setEditEndTime}
                          />
                        </InlinePicker>
                      ) : null}

                      <EditorRow icon="↻">
                        <Pressable accessibilityRole="button" onPress={() => togglePickerMode('repeat')} style={styles.valueButtonWide}>
                          <Text style={styles.valueButtonText}>{formatRepeatLabel(editRepeat, editRepeatDays)}</Text>
                        </Pressable>
                      </EditorRow>

                      {pickerMode === 'repeat' ? (
                        <InlinePicker>
                          <RepeatPickerSheet
                            repeatMode={editRepeat}
                            repeatDays={editRepeatDays}
                            onChangeMode={setEditRepeat}
                            onToggleDay={(dayCode) => {
                              setEditRepeatDays((currentDays) => {
                                if (currentDays.includes(dayCode)) {
                                  return currentDays.length === 1 ? currentDays : currentDays.filter((day) => day !== dayCode);
                                }

                                return [...currentDays, dayCode];
                              });
                            }}
                          />
                        </InlinePicker>
                      ) : null}

                      <EditorRow icon="👥">
                        <View style={styles.choiceRow}>
                          {children.map((child) => (
                            <Pressable
                              key={child.id}
                              accessibilityRole="button"
                              onPress={() => setEditChildId(child.id)}
                              style={[styles.choiceChip, editChildId === child.id && styles.choiceChipActive]}>
                              <Text style={[styles.choiceChipText, editChildId === child.id && styles.choiceChipTextActive]}>
                                {child.nickname}
                              </Text>
                            </Pressable>
                          ))}
                          {!children.length ? <Text style={styles.editorMutedText}>Сначала добавьте ребенка</Text> : null}
                        </View>
                      </EditorRow>
                    </View>

                    {selectedEvent.recurrence_rule ? (
                      <Text style={styles.detailHint}>
                        Это повторяющееся событие. Сейчас изменение сохранится для всей серии.
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <View style={[styles.detailHero, { backgroundColor: selectedEvent.softColor }]}>
                      <View style={[styles.detailIcon, { backgroundColor: selectedEvent.color }]}>
                        <Text style={styles.detailIconText}>{selectedEvent.child.slice(0, 1)}</Text>
                      </View>
                      <View style={styles.detailBody}>
                        <Text style={styles.detailTime}>{formatEventRange(selectedEvent)}</Text>
                        <Text style={styles.detailTitle}>{selectedEvent.title}</Text>
                        <Text style={styles.detailMeta}>
                          {selectedEvent.child} · {selectedEvent.place}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailInfoList}>
                      <DetailInfoRow icon="●" label="Категория" value={EVENT_PALETTE[selectedEvent.category].label} />
                      <DetailInfoRow icon="📍" label="Место" value={selectedEvent.place} />
                      <DetailInfoRow icon="↻" label="Повтор" value={formatRecurrenceLabel(selectedEvent.recurrence_rule)} />
                      {selectedEvent.description ? (
                        <DetailInfoRow icon="☰" label="Описание" value={selectedEvent.description} />
                      ) : null}
                    </View>

                    {selectedEvent.recurrence_rule ? (
                      <Text style={styles.detailHint}>
                        Если удалить событие, удалится вся повторяющаяся серия.
                      </Text>
                    ) : null}
                  </>
                )}

                {eventActionError ? <Text style={styles.errorText}>{eventActionError}</Text> : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailInfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailInfoRow}>
      <Text style={styles.detailInfoIcon}>{icon}</Text>
      <View style={styles.detailInfoBody}>
        <Text style={styles.detailInfoLabel}>{label}</Text>
        <Text style={styles.detailInfoValue}>{value}</Text>
      </View>
    </View>
  );
}

function formatEventRange(event: CalendarEvent) {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);

  if (event.all_day) {
    return `${formatLongDate(start)} · весь день`;
  }

  return `${formatLongDate(start)} · ${formatTimeLabel(start)}-${formatTimeLabel(end)}`;
}

function formatRecurrenceLabel(rule: string | null) {
  if (!rule) {
    return 'Не повторяется';
  }

  if (rule.includes('FREQ=DAILY')) {
    return 'Каждый день';
  }

  if (rule.includes('FREQ=WEEKLY')) {
    const daysPart = rule
      .split(';')
      .find((part) => part.startsWith('BYDAY='))
      ?.replace('BYDAY=', '');

    if (!daysPart) {
      return 'Каждую неделю';
    }

    const labels = daysPart
      .split(',')
      .map((code) => WEEKDAY_CODES.indexOf(code as (typeof WEEKDAY_CODES)[number]))
      .filter((index) => index >= 0)
      .map((index) => WEEKDAY_PICKER_LABELS[index].toLowerCase());

    return labels.length ? `Каждую неделю: ${labels.join(', ')}` : 'Каждую неделю';
  }

  if (rule.includes('FREQ=MONTHLY')) {
    return 'Каждый месяц';
  }

  if (rule.includes('FREQ=YEARLY')) {
    return 'Каждый год';
  }

  return 'Повторяется';
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MonthView({
  dates,
  displayEvents,
  selectedDate,
  today,
  visibleMonth,
  onDayPress,
  onDayLongPress,
  onEventPress,
  onSwipe,
}: {
  dates: Date[];
  displayEvents: DisplayCalendarEvent[];
  selectedDate: Date;
  today: Date;
  visibleMonth: Date;
  onDayPress: (date: Date) => void;
  onDayLongPress: (date: Date) => void;
  onEventPress: (eventId: number) => void;
  onSwipe: (direction: -1 | 1) => void;
}) {
  const touchStartX = useRef<number | null>(null);

  function handleTouchEnd(pageX: number) {
    if (touchStartX.current === null) {
      return;
    }

    const deltaX = pageX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 56) {
      return;
    }

    onSwipe(deltaX > 0 ? -1 : 1);
  }

  return (
    <ScrollView
      style={styles.monthGridScroll}
      contentContainerStyle={styles.monthGridContent}
      onTouchStart={(event) => {
        touchStartX.current = event.nativeEvent.pageX;
      }}
      onTouchEnd={(event) => handleTouchEnd(event.nativeEvent.pageX)}>
      <View style={styles.monthWeekHeader}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.monthWeekLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.monthGrid}>
        {dates.map((date) => {
          const key = formatDateKey(date);
          const dayEvents = displayEvents.filter((event) => isSameDay(new Date(event.starts_at), date));
          const visibleEvents = dayEvents.slice(0, 3);
          const hiddenEventsCount = Math.max(dayEvents.length - visibleEvents.length, 0);
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => onDayPress(date)}
              onLongPress={() => onDayLongPress(date)}
              style={[styles.monthCell, !isCurrentMonth && styles.monthCellMuted]}>
              <View style={[styles.monthDatePill, isSelected && styles.monthDatePillSelected, isToday && styles.monthDatePillToday]}>
                <Text style={[styles.monthDateText, isSelected && styles.monthDateTextSelected]}>{date.getDate()}</Text>
              </View>

              {visibleEvents.map((event) => (
                <Pressable
                  key={event.occurrence_id ?? event.id}
                  accessibilityRole="button"
                  onPress={() => onEventPress(event.id)}
                  style={[styles.monthEventBar, { backgroundColor: event.color }]}>
                  <View style={[styles.monthEventChildStripe, { backgroundColor: event.childColor }]} />
                  <Text numberOfLines={1} style={styles.monthEventText}>
                    {event.title}
                  </Text>
                </Pressable>
              ))}

              {hiddenEventsCount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onDayPress(date)}
                  style={styles.monthMoreButton}>
                  <Text style={styles.monthMoreText}>+{hiddenEventsCount} еще</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ScheduleView({
  emptyText,
  events,
  onEventPress,
}: {
  emptyText: string;
  events: DisplayCalendarEvent[];
  onEventPress: (eventId: number) => void;
}) {
  if (!events.length) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Событий нет</Text>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scheduleContent}>
      {events.map((event, index) => {
        const previousEvent = events[index - 1];
        const shouldShowDate =
          !previousEvent || !isSameDay(new Date(previousEvent.starts_at), new Date(event.starts_at));

        return (
          <View key={event.occurrence_id ?? event.id} style={styles.scheduleGroup}>
            {shouldShowDate ? (
              <Text style={styles.scheduleDate}>{formatLongDate(new Date(event.starts_at))}</Text>
            ) : null}
            <EventCard event={event} onPress={() => onEventPress(event.id)} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function TimeGridView({
  dates,
  events,
  onDayPress,
  onEventPress,
  onSlotPress,
  onSwipe,
  selectedDate,
  shouldHighlightSelectedDate,
  today,
}: {
  dates: Date[];
  events: DisplayCalendarEvent[];
  onDayPress: (date: Date) => void;
  onEventPress: (eventId: number) => void;
  onSlotPress: (date: Date, startTime: string) => void;
  onSwipe: (direction: -1 | 1) => void;
  selectedDate: Date;
  shouldHighlightSelectedDate: boolean;
  today: Date;
}) {
  const { width } = useWindowDimensions();
  const touchStartX = useRef<number | null>(null);
  const hourColumnWidth = dates.length === 7 ? 58 : 62;
  const columnWidth =
    dates.length === 1
      ? Math.max(width - hourColumnWidth, 240)
      : dates.length === 3
        ? Math.max((width - hourColumnWidth) / 3, 108)
        : Math.max((width - hourColumnWidth) / 7, 42);
  const timelineHeight = HOUR_ROW_HEIGHT * HOURS.length;

  function handleTouchEnd(pageX: number) {
    if (touchStartX.current === null) {
      return;
    }

    const deltaX = pageX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 56) {
      return;
    }

    onSwipe(deltaX > 0 ? -1 : 1);
  }

  return (
    <View
      style={styles.timeGridContainer}
      onTouchStart={(event) => {
        touchStartX.current = event.nativeEvent.pageX;
      }}
      onTouchEnd={(event) => handleTouchEnd(event.nativeEvent.pageX)}>
      <View style={styles.timeGridHeader}>
        <View style={[styles.timeColumnHeader, { width: hourColumnWidth }]} />
        {dates.map((date) => {
          const isSelected = shouldHighlightSelectedDate && isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);

          return (
            <Pressable
              key={formatDateKey(date)}
              accessibilityRole="button"
              onPress={() => onDayPress(date)}
              style={[styles.timeDayHeader, { width: columnWidth }]}>
              <Text style={[styles.timeDayWeekday, isToday && styles.timeDayWeekdayToday]}>
                {WEEKDAY_SHORT[date.getDay()]}
              </Text>
              <View style={[styles.timeDayNumberPill, isSelected && styles.timeDayNumberPillSelected, isToday && styles.timeDayNumberPillToday]}>
                <Text style={[styles.timeDayNumber, (isSelected || isToday) && styles.timeDayNumberActive]}>
                  {date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.timeGridVertical}
        contentContainerStyle={styles.timeGrid}>
        <View style={[styles.timeGridTimeline, { height: timelineHeight }]}>
          <View style={[styles.timeLabelsColumn, { width: hourColumnWidth }]}>
            {HOURS.map((hour) => (
              <Text key={hour} style={styles.timeHour}>
                {hour}
              </Text>
            ))}
          </View>

          <View style={[styles.timeColumnsLayer, { left: hourColumnWidth, width: columnWidth * dates.length }]}>
            {dates.map((date, dayIndex) => (
              <View
                key={formatDateKey(date)}
                style={[
                  styles.timeDayColumn,
                  {
                    left: dayIndex * columnWidth,
                    width: columnWidth,
                  },
                ]}>
                {HOURS.map((hour) => (
                  <Pressable
                    key={`${formatDateKey(date)}-${hour}`}
                    accessibilityRole="button"
                    onPress={() => onSlotPress(date, hour)}
                    onLongPress={() => onSlotPress(date, hour)}
                    style={styles.timeSlot}
                  />
                ))}

                {calculateOverlappingLayout(
                  events.filter((event) => isSameDay(new Date(event.starts_at), date)),
                ).map((event) => {
                    const layout = getTimedEventLayout(event);
                    const isCompactGrid = dates.length > 3;
                    const horizontalInset = 2;
                    const overlapGap = 2;
                    const availableWidth = Math.max(columnWidth - horizontalInset * 2, 32);
                    const eventWidth = Math.max(
                      (availableWidth - (event.overlapColumnCount - 1) * overlapGap) / event.overlapColumnCount,
                      10,
                    );
                    const eventLeft = horizontalInset + event.overlapColumnIndex * (eventWidth + overlapGap);
                    const shouldShowChildBadge = eventWidth >= 58 && layout.height >= 38;
                    const shouldShowChildMeta = eventWidth >= 70 && layout.height >= 48;
                    const titleLines = layout.height >= 52 ? 3 : layout.height >= 24 ? 2 : 1;

                    return (
                      <Pressable
                        key={event.occurrence_id ?? event.id}
                        accessibilityRole="button"
                        hitSlop={4}
                        onPress={() => onEventPress(event.id)}
                        style={[
                          styles.timeEventBlock,
                          isCompactGrid && styles.timeEventBlockCompact,
                          {
                            backgroundColor: event.color,
                            height: layout.height,
                            left: eventLeft,
                            top: layout.top,
                            width: eventWidth,
                          },
                        ]}>
                        <View style={[styles.timeEventChildStripe, { backgroundColor: event.childColor }]} />
                        <View style={styles.timeEventChildDivider} />
                        <View style={styles.timeEventTitleRow}>
                          {shouldShowChildBadge ? (
                            <View style={[styles.timeEventChildBadge, { backgroundColor: event.childColor }]}>
                              <Text style={styles.timeEventChildBadgeText}>{event.child.slice(0, 1)}</Text>
                            </View>
                          ) : null}
                          <Text
                            ellipsizeMode="tail"
                            numberOfLines={titleLines}
                            style={[styles.timeEventText, isCompactGrid && styles.timeEventTextCompact]}>
                            {event.title}
                          </Text>
                        </View>
                        {shouldShowChildMeta ? (
                          <Text numberOfLines={1} style={styles.timeEventMeta}>
                            {event.child}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function EventCard({ event, onPress }: { event: DisplayCalendarEvent; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.eventCard, { backgroundColor: event.softColor }]}>
      <View style={[styles.eventChildStripe, { backgroundColor: event.childColor }]} />
      <View style={[styles.eventIcon, { backgroundColor: event.childSoftColor }]}>
        <Text style={styles.eventIconText}>{event.child.slice(0, 1)}</Text>
      </View>
      <View style={styles.eventCardBody}>
        <View style={styles.eventCardTopLine}>
          <Text style={styles.eventCardTime}>{event.time}</Text>
          <View style={[styles.eventCategoryDot, { backgroundColor: event.color }]} />
        </View>
        <Text style={styles.eventCardTitle}>{event.title}</Text>
        <Text style={styles.eventCardMeta}>
          {event.child} · {event.place}
        </Text>
      </View>
      <Text style={styles.eventArrow}>›</Text>
    </Pressable>
  );
}

function ChildFilterToggle({
  color,
  isActive,
  label,
  onPress,
}: {
  color: string;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isActive }}
      onPress={onPress}
      style={[styles.childFilterToggle, isActive && { backgroundColor: withAlpha(color, 0.18) }]}>
      <View style={[styles.childFilterBox, { backgroundColor: isActive ? withAlpha(color, 0.78) : 'transparent', borderColor: color }]}>
        {isActive ? <Text style={styles.childFilterCheck}>✓</Text> : null}
      </View>
      <Text style={[styles.childFilterText, isActive && styles.childFilterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DrawerPlainItem({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.drawerPlainItem}>
      <Text style={styles.drawerIcon}>{icon}</Text>
      <Text style={styles.drawerItemText}>{label}</Text>
    </View>
  );
}

function DrawerStatsCard({ stats }: { stats: CalendarDrawerStats }) {
  const hasEvents = stats.totalEvents > 0;

  return (
    <View style={styles.drawerStats}>
      <Text style={styles.drawerStatsPeriod}>{stats.periodLabel}</Text>

      <View style={styles.drawerMetricsGrid}>
        <DrawerMetric label="событий" value={stats.totalEvents} />
        <DrawerMetric label="занято" value={formatMinutesCompact(stats.totalMinutes)} />
        <DrawerMetric label="в среднем" value={formatMinutesCompact(stats.averageMinutesPerDay)} />
        <DrawerMetric label="больше всего" value={stats.busiestLabel} />
      </View>

      <View style={styles.drawerChartBlock}>
        <View style={styles.drawerChartHeader}>
          <Text style={styles.drawerChartTitle}>Нагрузка</Text>
          <Text style={styles.drawerChartHint}>по периоду</Text>
        </View>
        <View style={styles.drawerBars}>
          {stats.dayStats.map((bucket) => {
            const height = hasEvents && bucket.minutes > 0
              ? Math.max(12, (bucket.minutes / stats.maxDayMinutes) * 46)
              : 7;
            const loadColor = getLoadColor(bucket.minutes);

            return (
              <View key={bucket.label} style={styles.drawerBarItem}>
                <View style={styles.drawerBarTrack}>
                  <View
                    style={[
                      styles.drawerBarFill,
                      {
                        backgroundColor: bucket.minutes > 0 ? loadColor : colors.sageSoft,
                        height,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.drawerBarLabel}>{bucket.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.drawerChartBlock}>
        <View style={styles.drawerChartHeader}>
          <Text style={styles.drawerChartTitle}>По детям</Text>
          <Text style={styles.drawerChartHint}>{hasEvents ? `${stats.totalEvents} событий` : 'пусто'}</Text>
        </View>

        {stats.childStats.length ? (
          <View style={styles.drawerChildStatsList}>
            {stats.childStats.map((childStat) => {
              const childLoad = stats.totalMinutes > 0
                ? childStat.minutes / stats.totalMinutes
                : childStat.eventsCount / Math.max(stats.totalEvents, 1);
              const width = Math.max(8, childLoad * 100);
              const percent = Math.round(childLoad * 100);

              return (
                <View key={childStat.childMemberId} style={styles.drawerChildStatRow}>
                  <View style={styles.drawerChildStatTop}>
                    <Text numberOfLines={1} style={styles.drawerChildStatName}>
                      {childStat.nickname}
                    </Text>
                    <Text style={styles.drawerChildStatMeta}>
                      {percent}% · {childStat.eventsCount} · {formatMinutesCompact(childStat.minutes)}
                    </Text>
                  </View>
                  <View style={styles.drawerChildTrack}>
                    <View
                      style={[
                        styles.drawerChildFill,
                        {
                          backgroundColor: withAlpha(childStat.color, 0.82),
                          width: `${width}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.drawerEmptyStats}>За выбранный период событий нет.</Text>
        )}
      </View>
    </View>
  );
}

function DrawerMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.drawerMetric}>
      <Text numberOfLines={1} style={styles.drawerMetricValue}>
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.drawerMetricLabel}>
        {label}
      </Text>
    </View>
  );
}

function CategoryChip({
  color,
  isActive,
  label,
  softColor,
  onPress,
}: {
  color: string;
  isActive: boolean;
  label: string;
  softColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.kindChip,
        isActive && styles.kindChipActive,
        isActive && { backgroundColor: softColor, borderColor: color },
      ]}>
      <View style={[styles.kindDot, { backgroundColor: color }]} />
      <Text style={[styles.kindChipText, isActive && styles.kindChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function InlinePicker({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.inlinePicker}>
      {children}
    </View>
  );
}

function DatePickerSheet({
  selectedDate,
  visibleMonth,
  onSelect,
}: {
  selectedDate: Date;
  visibleMonth: Date;
  onSelect: (date: Date) => void;
}) {
  const [displayMonth, setDisplayMonth] = useState(visibleMonth);
  const touchStartX = useRef<number | null>(null);
  const monthDates = getMonthGrid(displayMonth);

  function shiftDisplayMonth(direction: -1 | 1) {
    const nextMonth = new Date(displayMonth);
    nextMonth.setMonth(nextMonth.getMonth() + direction);
    setDisplayMonth(startOfMonth(nextMonth));
  }

  function handleTouchEnd(pageX: number) {
    if (touchStartX.current === null) {
      return;
    }

    const deltaX = pageX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 42) {
      return;
    }

    shiftDisplayMonth(deltaX > 0 ? -1 : 1);
  }

  return (
    <View
      style={styles.datePickerContent}
      onTouchStart={(event) => {
        touchStartX.current = event.nativeEvent.pageX;
      }}
      onTouchEnd={(event) => handleTouchEnd(event.nativeEvent.pageX)}>
      <View style={styles.pickerHeaderRow}>
        <Pressable accessibilityRole="button" onPress={() => shiftDisplayMonth(-1)} style={styles.pickerArrowButton}>
          <Text style={styles.pickerArrowText}>‹</Text>
        </Pressable>
        <View style={styles.pickerHeaderCenter}>
          <Text style={styles.pickerTitle}>{formatLongDate(selectedDate)}</Text>
          <Text style={styles.pickerSubtitle}>
            {MONTHS[displayMonth.getMonth()]} {displayMonth.getFullYear()}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => shiftDisplayMonth(1)} style={styles.pickerArrowButton}>
          <Text style={styles.pickerArrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.compactMonthGrid}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.compactWeekday}>
            {label}
          </Text>
        ))}

        {monthDates.map((date) => {
          const isActive = isSameDay(date, selectedDate);
          const isCurrentMonth = date.getMonth() === displayMonth.getMonth();

          return (
            <Pressable
              key={formatDateKey(date)}
              accessibilityRole="button"
              onPress={() => onSelect(date)}
              style={[styles.compactDay, !isCurrentMonth && styles.compactDayMuted, isActive && styles.compactDayActive]}>
              <Text style={[styles.compactDayText, !isCurrentMonth && styles.compactDayTextMuted, isActive && styles.compactDayTextActive]}>
                {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TimePickerSheet({
  selectedTime,
  title,
  onSelect,
}: {
  selectedTime: string;
  title: string;
  onSelect: (time: string) => void;
}) {
  const [selectedHourFromProps, selectedMinuteFromProps] = selectedTime.split(':');
  const [localHour, setLocalHour] = useState(selectedHourFromProps);
  const [localMinute, setLocalMinute] = useState(selectedMinuteFromProps);
  const hourScrollRef = useRef<ScrollView | null>(null);
  const minuteScrollRef = useRef<ScrollView | null>(null);
  const repeatedHours = useMemo(() => repeatTimeOptions(HOUR_OPTIONS), []);
  const repeatedMinutes = useMemo(() => repeatTimeOptions(MINUTE_OPTIONS), []);

  useEffect(() => {
    setLocalHour(selectedHourFromProps);
    setLocalMinute(selectedMinuteFromProps);

    const hourIndex = getCenteredTimeIndex(HOUR_OPTIONS, selectedHourFromProps);
    const minuteIndex = getCenteredTimeIndex(MINUTE_OPTIONS, selectedMinuteFromProps);

    requestAnimationFrame(() => {
      hourScrollRef.current?.scrollTo({ y: hourIndex * TIME_WHEEL_ITEM_HEIGHT, animated: false });
      minuteScrollRef.current?.scrollTo({ y: minuteIndex * TIME_WHEEL_ITEM_HEIGHT, animated: false });
    });
  }, [selectedHourFromProps, selectedMinuteFromProps]);

  function selectPart(nextHour: string, nextMinute: string) {
    setLocalHour(nextHour);
    setLocalMinute(nextMinute);
    onSelect(`${nextHour}:${nextMinute}`);
  }

  function selectScrolledHour(offsetY: number) {
    const rawIndex = Math.round(offsetY / TIME_WHEEL_ITEM_HEIGHT);
    const nextHour = getCircularTimeValue(HOUR_OPTIONS, rawIndex);
    const centeredIndex = getCenteredTimeIndex(HOUR_OPTIONS, nextHour);

    selectPart(nextHour, localMinute);
    requestAnimationFrame(() => {
      hourScrollRef.current?.scrollTo({ y: centeredIndex * TIME_WHEEL_ITEM_HEIGHT, animated: false });
    });
  }

  function selectScrolledMinute(offsetY: number) {
    const rawIndex = Math.round(offsetY / TIME_WHEEL_ITEM_HEIGHT);
    const nextMinute = getCircularTimeValue(MINUTE_OPTIONS, rawIndex);
    const centeredIndex = getCenteredTimeIndex(MINUTE_OPTIONS, nextMinute);

    selectPart(localHour, nextMinute);
    requestAnimationFrame(() => {
      minuteScrollRef.current?.scrollTo({ y: centeredIndex * TIME_WHEEL_ITEM_HEIGHT, animated: false });
    });
  }

  return (
    <View style={styles.timePickerContent}>
      <View style={[styles.pickerHeaderRow, styles.timePickerHeaderRow]}>
        <View style={styles.timePickerHeaderText}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <Text style={styles.pickerSubtitle}>Часы и минуты крутятся по кругу</Text>
        </View>
        <Text style={styles.timePickerCurrent}>{selectedTime}</Text>
      </View>

      <View style={styles.wheelShell}>
        <View pointerEvents="none" style={styles.wheelSelectionBand} />
        <ScrollView
          ref={hourScrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => selectScrolledHour(event.nativeEvent.contentOffset.y)}
          style={styles.wheelColumn}
          contentContainerStyle={styles.wheelColumnContent}>
          {repeatedHours.map((hour, index) => {
            const isActive = hour === localHour;

            return (
              <Pressable
                key={`${hour}-${index}`}
                accessibilityRole="button"
                onPress={() => selectPart(hour, localMinute)}
                style={styles.wheelItem}>
                <Text style={[styles.wheelItemText, isActive && styles.wheelItemTextActive]}>{hour}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.wheelDivider}>:</Text>

        <ScrollView
          ref={minuteScrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => selectScrolledMinute(event.nativeEvent.contentOffset.y)}
          style={styles.wheelColumn}
          contentContainerStyle={styles.wheelColumnContent}>
          {repeatedMinutes.map((minute, index) => {
            const isActive = minute === localMinute;

            return (
              <Pressable
                key={`${minute}-${index}`}
                accessibilityRole="button"
                onPress={() => selectPart(localHour, minute)}
                style={styles.wheelItem}>
                <Text style={[styles.wheelItemText, isActive && styles.wheelItemTextActive]}>{minute}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function RepeatPickerSheet({
  repeatMode,
  repeatDays,
  onChangeMode,
  onToggleDay,
}: {
  repeatMode: RepeatMode;
  repeatDays: string[];
  onChangeMode: (repeatMode: RepeatMode) => void;
  onToggleDay: (dayCode: string) => void;
}) {
  return (
    <View style={styles.pickerContent}>
      <Text style={styles.pickerTitle}>Повтор</Text>

      <View style={styles.repeatOptionList}>
        {REPEAT_OPTIONS.map((option) => {
          const isActive = option.value === repeatMode;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => onChangeMode(option.value)}
              style={[styles.repeatOption, isActive && styles.repeatOptionActive]}>
              <View>
                <Text style={[styles.repeatOptionTitle, isActive && styles.repeatOptionTitleActive]}>{option.label}</Text>
                <Text style={styles.repeatOptionHelper}>{option.helper}</Text>
              </View>
              <Text style={[styles.repeatCheck, isActive && styles.repeatCheckActive]}>{isActive ? '✓' : ''}</Text>
            </Pressable>
          );
        })}
      </View>

      {repeatMode === 'weekly' ? (
        <View style={styles.weekdayPicker}>
          <Text style={styles.fieldCaption}>Дни недели</Text>
          <View style={styles.weekdayPickerRow}>
            {WEEKDAY_CODES.map((dayCode, index) => {
              const isActive = repeatDays.includes(dayCode);

              return (
                <Pressable
                  key={dayCode}
                  accessibilityRole="checkbox"
                  onPress={() => onToggleDay(dayCode)}
                  style={[styles.weekdayChip, isActive && styles.weekdayChipActive]}>
                  <Text style={[styles.weekdayChipText, isActive && styles.weekdayChipTextActive]}>
                    {WEEKDAY_PICKER_LABELS[index]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function EditorRow({ children, icon }: { children: React.ReactNode; icon: string }) {
  return (
    <View style={styles.editorRow}>
      <Text style={styles.editorRowIcon}>{icon}</Text>
      <View style={styles.editorRowContent}>{children}</View>
    </View>
  );
}

function getVisibleDates(calendarView: CalendarView, selectedDate: Date): Date[] {
  if (calendarView === 'day') {
    return [selectedDate];
  }

  if (calendarView === 'threeDays') {
    return [selectedDate, addDays(selectedDate, 1), addDays(selectedDate, 2)];
  }

  if (calendarView === 'week') {
    const monday = getWeekStart(selectedDate);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }

  return [selectedDate];
}

function getMonthGrid(monthDate: Date): Date[] {
  const firstDay = startOfMonth(monthDate);
  const mondayIndex = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -mondayIndex);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getMonthPeriod(monthDate: Date): { start: Date; end: Date } {
  const grid = getMonthGrid(monthDate);
  const start = grid[0];
  const end = addDays(grid[grid.length - 1], 1);

  return { start, end };
}

function getWeekStart(date: Date): Date {
  const mondayIndex = (date.getDay() + 6) % 7;
  return addDays(date, -mondayIndex);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return startOfDay(nextDate);
}

function addMinutes(date: Date, minutes: number): Date {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return nextDate;
}

function repeatTimeOptions(options: string[]): string[] {
  return Array.from({ length: TIME_WHEEL_REPEAT_COUNT }, () => options).flat();
}

function getCenteredTimeIndex(options: string[], value: string): number {
  const valueIndex = Math.max(0, options.indexOf(value));

  return options.length * TIME_WHEEL_CENTER_BLOCK + valueIndex;
}

function getCircularTimeValue(options: string[], rawIndex: number): string {
  const normalizedIndex = ((rawIndex % options.length) + options.length) % options.length;

  return options[normalizedIndex];
}

function dateWithTime(date: Date, time: string): Date {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const nextDate = new Date(date);

  nextDate.setHours(Number.isFinite(hours) ? hours : 9);
  nextDate.setMinutes(Number.isFinite(minutes) ? minutes : 0);
  nextDate.setSeconds(0);
  nextDate.setMilliseconds(0);

  return nextDate;
}

function toLocalApiDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function sortEventsByDateAndTime(first: DisplayCalendarEvent, second: DisplayCalendarEvent): number {
  return first.starts_at === second.starts_at
    ? first.title.localeCompare(second.title)
    : first.starts_at.localeCompare(second.starts_at);
}

function getEventDurationMinutes(event: DisplayCalendarEvent): number {
  const startsAt = new Date(event.starts_at).getTime();
  const endsAt = new Date(event.ends_at).getTime();
  const duration = Math.max(0, endsAt - startsAt);

  return Math.round(duration / 60000);
}

function calculateOverlappingLayout(eventsForDay: DisplayCalendarEvent[]): PositionedDisplayCalendarEvent[] {
  const timedEvents = eventsForDay
    .filter((event) => !event.all_day)
    .sort((first, second) => {
      const startsCompare = first.starts_at.localeCompare(second.starts_at);

      if (startsCompare !== 0) {
        return startsCompare;
      }

      const endsCompare = first.ends_at.localeCompare(second.ends_at);

      if (endsCompare !== 0) {
        return endsCompare;
      }

      return first.id - second.id;
    });

  const positionedEvents: PositionedDisplayCalendarEvent[] = [];
  let currentGroup: DisplayCalendarEvent[] = [];
  let currentGroupEnd = 0;

  function flushGroup() {
    if (currentGroup.length === 0) {
      return;
    }

    positionedEvents.push(...positionOverlapGroup(currentGroup));
    currentGroup = [];
    currentGroupEnd = 0;
  }

  timedEvents.forEach((event) => {
    const startsAt = new Date(event.starts_at).getTime();
    const endsAt = new Date(event.ends_at).getTime();

    if (currentGroup.length === 0 || startsAt < currentGroupEnd) {
      currentGroup.push(event);
      currentGroupEnd = Math.max(currentGroupEnd, endsAt);
      return;
    }

    flushGroup();
    currentGroup.push(event);
    currentGroupEnd = endsAt;
  });

  flushGroup();

  return positionedEvents;
}

function positionOverlapGroup(group: DisplayCalendarEvent[]): PositionedDisplayCalendarEvent[] {
  const columnEndTimes: number[] = [];
  const positionedGroup = group.map((event) => {
    const startsAt = new Date(event.starts_at).getTime();
    const endsAt = new Date(event.ends_at).getTime();
    let columnIndex = columnEndTimes.findIndex((columnEndTime) => columnEndTime <= startsAt);

    if (columnIndex === -1) {
      columnIndex = columnEndTimes.length;
      columnEndTimes.push(endsAt);
    } else {
      columnEndTimes[columnIndex] = endsAt;
    }

    return {
      ...event,
      overlapColumnCount: 1,
      overlapColumnIndex: columnIndex,
    };
  });
  const overlapColumnCount = Math.max(columnEndTimes.length, 1);

  return positionedGroup.map((event) => ({
    ...event,
    overlapColumnCount,
  }));
}

function buildCalendarDrawerStats(
  events: DisplayCalendarEvent[],
  children: FamilyMember[],
  calendarView: CalendarView,
  selectedDate: Date,
  visibleMonth: Date,
): CalendarDrawerStats {
  const period = getStatsPeriod(calendarView, selectedDate, visibleMonth);
  const periodEvents = events.filter((event) => isEventInsidePeriod(event, period.start, period.end));
  const totalMinutes = periodEvents.reduce(
    (currentTotal, event) => currentTotal + getEventDurationMinutes(event),
    0,
  );
  const dayStats = period.buckets.map((bucket) => {
    const bucketEvents = periodEvents.filter((event) => isEventInsidePeriod(event, bucket.start, bucket.end));
    const minutes = bucketEvents.reduce(
      (currentTotal, event) => currentTotal + getEventDurationMinutes(event),
      0,
    );

    return {
      label: bucket.label,
      eventsCount: bucketEvents.length,
      minutes,
    };
  });
  const busiestDay = [...dayStats].sort((first, second) => {
    if (second.minutes === first.minutes) {
      return second.eventsCount - first.eventsCount;
    }

    return second.minutes - first.minutes;
  })[0];
  const childStats = children
    .map((child) => {
      const childEvents = periodEvents.filter((event) => event.child_member_id === child.id);
      const minutes = childEvents.reduce(
        (currentTotal, event) => currentTotal + getEventDurationMinutes(event),
        0,
      );

      return {
        childMemberId: child.id,
        color: getMemberColor(child),
        eventsCount: childEvents.length,
        minutes,
        nickname: child.nickname,
      };
    })
    .filter((childStat) => childStat.eventsCount > 0)
    .sort((first, second) => second.minutes - first.minutes || second.eventsCount - first.eventsCount);

  return {
    averageMinutesPerDay: totalMinutes / Math.max(period.daysCount, 1),
    busiestLabel: busiestDay && (busiestDay.minutes > 0 || busiestDay.eventsCount > 0) ? busiestDay.label : 'нет',
    childStats,
    dayStats,
    maxChildMinutes: Math.max(...childStats.map((childStat) => childStat.minutes), 1),
    maxDayMinutes: Math.max(...dayStats.map((bucket) => bucket.minutes), 1),
    periodLabel: period.label,
    totalEvents: periodEvents.length,
    totalMinutes,
  };
}

function getStatsPeriod(
  calendarView: CalendarView,
  selectedDate: Date,
  visibleMonth: Date,
): {
  buckets: Array<{ end: Date; label: string; start: Date }>;
  daysCount: number;
  end: Date;
  label: string;
  start: Date;
} {
  if (calendarView === 'day') {
    const start = startOfDay(selectedDate);
    const end = addDays(start, 1);

    return {
      buckets: [{ start, end, label: 'День' }],
      daysCount: 1,
      end,
      label: 'Выбранный день',
      start,
    };
  }

  if (calendarView === 'threeDays') {
    const start = startOfDay(selectedDate);
    const buckets = Array.from({ length: 3 }, (_, index) => {
      const bucketStart = addDays(start, index);

      return {
        start: bucketStart,
        end: addDays(bucketStart, 1),
        label: WEEKDAY_LABELS[(bucketStart.getDay() + 6) % 7],
      };
    });

    return {
      buckets,
      daysCount: 3,
      end: addDays(start, 3),
      label: '3 дня',
      start,
    };
  }

  if (calendarView === 'week') {
    const start = getWeekStart(selectedDate);
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const bucketStart = addDays(start, index);

      return {
        start: bucketStart,
        end: addDays(bucketStart, 1),
        label: WEEKDAY_LABELS[index],
      };
    });

    return {
      buckets,
      daysCount: 7,
      end: addDays(start, 7),
      label: 'Неделя',
      start,
    };
  }

  const start = startOfMonth(visibleMonth);
  const end = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const buckets = getMonthStatBuckets(start, end);

  return {
    buckets,
    daysCount: Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)),
    end,
    label: calendarView === 'month' ? 'Месяц' : 'Расписание',
    start,
  };
}

function getMonthStatBuckets(monthStart: Date, monthEnd: Date): Array<{ end: Date; label: string; start: Date }> {
  const buckets: Array<{ end: Date; label: string; start: Date }> = [];
  let cursor = monthStart;
  let weekNumber = 1;

  while (cursor < monthEnd) {
    const nextWeek = addDays(cursor, 7);
    const bucketEnd = nextWeek < monthEnd ? nextWeek : monthEnd;

    buckets.push({
      start: cursor,
      end: bucketEnd,
      label: `${weekNumber}н`,
    });

    cursor = bucketEnd;
    weekNumber += 1;
  }

  return buckets;
}

function isEventInsidePeriod(event: DisplayCalendarEvent, start: Date, end: Date): boolean {
  const startsAt = new Date(event.starts_at);
  const endsAt = new Date(event.ends_at);

  return startsAt < end && endsAt > start;
}

function formatMinutesCompact(minutes: number): string {
  const roundedMinutes = Math.round(minutes);

  if (roundedMinutes <= 0) {
    return '0 ч';
  }

  if (roundedMinutes < 60) {
    return `${roundedMinutes} мин`;
  }

  const hours = roundedMinutes / 60;

  if (Number.isInteger(hours)) {
    return `${hours} ч`;
  }

  return `${hours.toFixed(1).replace('.', ',')} ч`;
}

function getLoadColor(minutes: number): string {
  const hours = minutes / 60;

  if (hours <= 1.5) {
    return LOAD_COLORS.low;
  }

  if (hours <= 3.5) {
    return LOAD_COLORS.medium;
  }

  if (hours <= 5.5) {
    return LOAD_COLORS.high;
  }

  return LOAD_COLORS.extreme;
}

function buildRecurrenceRule(repeatMode: RepeatMode, repeatDays: string[]): string | null {
  if (repeatMode === 'none') {
    return null;
  }

  if (repeatMode === 'daily') {
    return 'FREQ=DAILY';
  }

  if (repeatMode === 'weekly') {
    const days = repeatDays.length ? repeatDays : ['MO'];
    return `FREQ=WEEKLY;BYDAY=${days.join(',')}`;
  }

  if (repeatMode === 'monthly') {
    return 'FREQ=MONTHLY';
  }

  return 'FREQ=YEARLY';
}

function parseRepeatMode(rule: string | null): RepeatMode {
  if (!rule) {
    return 'none';
  }

  if (rule.includes('FREQ=DAILY')) {
    return 'daily';
  }

  if (rule.includes('FREQ=WEEKLY')) {
    return 'weekly';
  }

  if (rule.includes('FREQ=MONTHLY')) {
    return 'monthly';
  }

  if (rule.includes('FREQ=YEARLY')) {
    return 'yearly';
  }

  return 'none';
}

function parseRepeatDays(rule: string | null): string[] {
  if (!rule) {
    return ['MO'];
  }

  const daysPart = rule
    .split(';')
    .find((part) => part.startsWith('BYDAY='))
    ?.replace('BYDAY=', '');

  if (!daysPart) {
    return ['MO'];
  }

  const days = daysPart
    .split(',')
    .filter((dayCode) => WEEKDAY_CODES.includes(dayCode as (typeof WEEKDAY_CODES)[number]));

  return days.length ? days : ['MO'];
}

function formatRepeatLabel(repeatMode: RepeatMode, repeatDays: string[]): string {
  if (repeatMode === 'none') {
    return 'Не повторяется';
  }

  if (repeatMode === 'daily') {
    return 'Каждый день';
  }

  if (repeatMode === 'weekly') {
    const labels = repeatDays
      .map((dayCode) => WEEKDAY_PICKER_LABELS[WEEKDAY_CODES.indexOf(dayCode as (typeof WEEKDAY_CODES)[number])])
      .filter(Boolean)
      .join(', ');

    return labels ? `Каждую неделю: ${labels}` : 'Каждую неделю';
  }

  if (repeatMode === 'monthly') {
    return 'Каждый месяц';
  }

  return 'Каждый год';
}

function ensureEndTimeAfterStart(startTime: string, currentEndTime: string): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(currentEndTime);

  if (endMinutes > startMinutes) {
    return currentEndTime;
  }

  const nextMinutes = Math.min(startMinutes + 60, 23 * 60 + 45);
  return minutesToTime(nextMinutes);
}

function getTimedEventLayout(event: DisplayCalendarEvent): { top: number; height: number } {
  const startsAt = new Date(event.starts_at);
  const endsAt = new Date(event.ends_at);
  const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const rawEndMinutes = isSameDay(startsAt, endsAt)
    ? endsAt.getHours() * 60 + endsAt.getMinutes()
    : 24 * 60;
  const endMinutes = Math.max(rawEndMinutes, startMinutes + 15);
  const minuteHeight = HOUR_ROW_HEIGHT / 60;

  return {
    top: startMinutes * minuteHeight + 1,
    height: Math.max((endMinutes - startMinutes) * minuteHeight - 2, 10),
  };
}

function getDefaultDraftStartTime(date: Date): string {
  const nextDate = new Date(date);

  nextDate.setMinutes(0, 0, 0);

  if (date.getMinutes() > 0) {
    nextDate.setHours(nextDate.getHours() + 1);
  }

  return minutesToTime(Math.min(nextDate.getHours() * 60, 23 * 60));
}

function timeToMinutes(time: string): number {
  const [hoursRaw, minutesRaw] = time.split(':');
  return Number(hoursRaw) * 60 + Number(minutesRaw);
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function isSameDay(firstDate: Date, secondDate: Date): boolean {
  return formatDateKey(firstDate) === formatDateKey(secondDate);
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatLongDate(date: Date): string {
  return `${WEEKDAY_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

function formatHeaderPeriod(calendarView: CalendarView, selectedDate: Date, visibleMonth: Date): string {
  if (calendarView === 'month' || calendarView === 'schedule') {
    return `${MONTHS[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;
  }

  if (calendarView === 'week') {
    const start = getWeekStart(selectedDate);
    const end = addDays(start, 6);
    return `${start.getDate()}-${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`;
  }

  return `${selectedDate.getDate()} ${MONTHS_GENITIVE[selectedDate.getMonth()]}`;
}

function withAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace('#', '');

  if (normalized.length !== 6) {
    return hexColor;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getMemberColor(member: FamilyMember): string {
  if (member.color && /^#[0-9A-Fa-f]{6}$/.test(member.color)) {
    return member.color;
  }

  return member.role === 'child' ? colors.lavender : colors.sage;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  googleShell: {
    backgroundColor: colors.background,
    flex: 1,
  },
  appBar: {
    alignItems: 'center',
    borderBottomColor: 'rgba(150, 167, 168, 0.24)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 54,
    paddingHorizontal: spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  iconButtonText: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '700',
  },
  monthButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  monthButtonText: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  monthChevron: {
    color: colors.muted,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  appBarSpacer: {
    flex: 1,
  },
  todayIconButton: {
    alignItems: 'center',
    borderColor: colors.muted,
    borderRadius: 8,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  todayIconText: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  accountCircle: {
    alignItems: 'center',
    backgroundColor: colors.sageSoft,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  accountText: {
    color: colors.plum,
    fontSize: typography.md,
    fontWeight: '900',
  },
  monthPickerPanel: {
    backgroundColor: colors.surface,
    borderBottomColor: 'rgba(150, 167, 168, 0.20)',
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    paddingTop: spacing.xs,
  },
  monthPickerYearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 30,
  },
  monthPickerYearButton: {
    alignItems: 'center',
    borderColor: 'rgba(150, 167, 168, 0.24)',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 36,
  },
  monthPickerYearButtonText: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
    lineHeight: typography.lg,
  },
  monthPickerYearText: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
    minWidth: 90,
    textAlign: 'center',
  },
  monthStripScroll: {
    flexGrow: 0,
    maxHeight: 42,
  },
  monthStrip: {
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  monthStripChip: {
    borderColor: 'rgba(150, 167, 168, 0.32)',
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    minWidth: 68,
    paddingHorizontal: spacing.sm,
  },
  monthStripChipActive: {
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavender,
  },
  monthStripText: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '900',
    textAlign: 'center',
  },
  monthStripTextActive: {
    color: colors.plum,
  },
  dateRail: {
    borderBottomColor: 'rgba(150, 167, 168, 0.24)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dateRailItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  dateRailWeekday: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dateRailTodayText: {
    color: colors.plum,
  },
  dateRailCircle: {
    alignItems: 'center',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  dateRailCircleActive: {
    backgroundColor: colors.sageSoft,
  },
  dateRailDay: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '800',
  },
  dateRailDayActive: {
    color: colors.plum,
    fontWeight: '900',
  },
  periodControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  periodButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.24)',
    borderRadius: 18,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  periodButtonText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  periodTodayButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.24)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  periodTodayText: {
    color: colors.plum,
    fontSize: typography.md,
    fontWeight: '900',
  },
  periodTodayDate: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '800',
    marginTop: 2,
  },
  calendarBody: {
    flex: 1,
  },
  loadingLine: {
    paddingHorizontal: spacing.md,
  },
  loadingText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  noticeCard: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.20)',
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.xs,
    margin: spacing.md,
    padding: spacing.md,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
  },
  noticeText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  drawerOverlay: {
    backgroundColor: 'rgba(45, 42, 59, 0.26)',
    flex: 1,
  },
  drawerBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  drawer: {
    backgroundColor: colors.surface,
    borderBottomRightRadius: 30,
    borderTopRightRadius: 30,
    flex: 1,
    maxWidth: 326,
    overflow: 'hidden',
  },
  drawerScroll: {
    flex: 1,
  },
  drawerContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  drawerBrand: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
    paddingHorizontal: spacing.lg,
  },
  drawerSection: {
    borderTopColor: 'rgba(150, 167, 168, 0.20)',
    borderTopWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  drawerItem: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  drawerItemActive: {
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavender,
    borderWidth: 1,
  },
  drawerIcon: {
    color: colors.sage,
    fontSize: typography.xl,
    fontWeight: '800',
    width: 34,
  },
  drawerItemText: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '800',
  },
  drawerItemTextActive: {
    color: colors.plum,
    fontWeight: '900',
  },
  drawerProfile: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '900',
    paddingHorizontal: spacing.lg,
  },
  drawerStats: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.24)',
    borderWidth: 1,
    borderRadius: 22,
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
  },
  drawerStatsPeriod: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  drawerMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  drawerMetric: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 16,
    flexBasis: '47%',
    flexGrow: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  drawerMetricValue: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  drawerMetricLabel: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '800',
    marginTop: 2,
  },
  drawerChartBlock: {
    gap: spacing.sm,
  },
  drawerChartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drawerChartTitle: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  drawerChartHint: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '800',
  },
  drawerBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    minHeight: 66,
  },
  drawerBarItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  drawerBarTrack: {
    alignItems: 'center',
    backgroundColor: 'rgba(150, 167, 168, 0.18)',
    borderRadius: 999,
    height: 52,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 14,
  },
  drawerBarFill: {
    borderRadius: 999,
    minHeight: 6,
    width: 14,
  },
  drawerBarLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  drawerChildStatsList: {
    gap: spacing.sm,
  },
  drawerChildStatRow: {
    gap: 6,
  },
  drawerChildStatTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  drawerChildStatName: {
    color: colors.text,
    flex: 1,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  drawerChildStatMeta: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '800',
  },
  drawerChildTrack: {
    backgroundColor: 'rgba(150, 167, 168, 0.16)',
    borderRadius: 999,
    height: 9,
    overflow: 'hidden',
  },
  drawerChildFill: {
    borderRadius: 999,
    height: 9,
  },
  drawerEmptyStats: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 20,
  },
  drawerPlainItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  childFilterToggle: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  childFilterBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  childFilterCheck: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  childFilterText: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.md,
    fontWeight: '800',
  },
  childFilterTextActive: {
    color: colors.text,
    fontWeight: '900',
  },
  drawerEmptyText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  monthGridScroll: {
    flex: 1,
  },
  monthGridContent: {
    flexGrow: 1,
  },
  monthWeekHeader: {
    borderBottomColor: 'rgba(150, 167, 168, 0.24)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  monthWeekLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.xs,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  monthGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    borderColor: 'rgba(150, 167, 168, 0.20)',
    borderRightWidth: 1,
    borderTopWidth: 1,
    height: `${100 / 6}%`,
    paddingHorizontal: 3,
    paddingVertical: 4,
    width: `${100 / 7}%`,
  },
  monthCellMuted: {
    opacity: 0.42,
  },
  monthDatePill: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  monthDatePillToday: {
    borderColor: colors.brandDark,
    borderWidth: 1,
  },
  monthDatePillSelected: {
    backgroundColor: colors.sageSoft,
  },
  monthDateText: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  monthDateTextSelected: {
    color: colors.plum,
    fontWeight: '900',
  },
  monthEventBar: {
    borderRadius: 4,
    marginTop: 2,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingLeft: 7,
    paddingVertical: 1,
  },
  monthEventChildStripe: {
    borderRightColor: 'rgba(41, 37, 54, 0.34)',
    borderRightWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 3,
  },
  monthEventText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
  },
  monthMoreButton: {
    marginTop: 2,
    paddingHorizontal: 2,
  },
  monthMoreText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '900',
  },
  scheduleContent: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  scheduleGroup: {
    gap: spacing.sm,
  },
  scheduleDate: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  eventCard: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 88,
    overflow: 'hidden',
    padding: spacing.md,
  },
  eventChildStripe: {
    borderRightColor: 'rgba(41, 37, 54, 0.34)',
    borderRightWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 5,
  },
  eventIcon: {
    alignItems: 'center',
    borderColor: 'rgba(41, 37, 54, 0.20)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  eventIconText: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  eventCardBody: {
    flex: 1,
    gap: 2,
  },
  eventCardTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  eventCardTime: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
  },
  eventCategoryDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  eventCardTitle: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  eventCardMeta: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  eventArrow: {
    color: colors.muted,
    fontSize: 28,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.20)',
    borderRadius: 26,
    borderWidth: 1,
    gap: spacing.xs,
    margin: spacing.md,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  timeGrid: {
    paddingBottom: 0,
  },
  timeGridContainer: {
    flex: 1,
  },
  timeGridHorizontal: {
    flex: 1,
  },
  timeGridVertical: {
    flex: 1,
  },
  timeGridHeader: {
    backgroundColor: colors.background,
    borderBottomColor: 'rgba(150, 167, 168, 0.24)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    position: 'relative',
    zIndex: 10,
  },
  timeColumnHeader: {
    borderRightColor: 'rgba(150, 167, 168, 0.22)',
    borderRightWidth: 1,
  },
  timeDayHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  timeDayWeekday: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  timeDayWeekdayToday: {
    color: colors.plum,
  },
  timeDayNumberPill: {
    alignItems: 'center',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    minWidth: 30,
    paddingHorizontal: spacing.xs,
  },
  timeDayNumberPillSelected: {
    backgroundColor: 'rgba(221, 166, 252, 0.34)',
  },
  timeDayNumberPillToday: {
    borderColor: colors.brandDark,
    borderWidth: 1,
  },
  timeDayNumber: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '800',
  },
  timeDayNumberActive: {
    color: colors.plum,
    fontWeight: '900',
  },
  timeGridTimeline: {
    position: 'relative',
  },
  timeLabelsColumn: {
    borderRightColor: 'rgba(150, 167, 168, 0.22)',
    borderRightWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  timeHour: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    height: HOUR_ROW_HEIGHT,
    paddingRight: 4,
    paddingTop: 2,
    textAlign: 'right',
  },
  timeColumnsLayer: {
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  timeDayColumn: {
    borderRightColor: 'rgba(150, 167, 168, 0.20)',
    borderRightWidth: 1,
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  timeSlot: {
    borderTopColor: 'rgba(150, 167, 168, 0.24)',
    borderTopWidth: 1,
    height: HOUR_ROW_HEIGHT,
  },
  timeEventBlock: {
    borderColor: 'rgba(45, 42, 59, 0.14)',
    borderRadius: 5,
    borderWidth: 1,
    overflow: 'hidden',
    paddingLeft: 7,
    paddingRight: 2,
    paddingVertical: 1,
    position: 'absolute',
  },
  timeEventBlockCompact: {
    paddingLeft: 5,
    paddingRight: 1,
  },
  timeEventChildStripe: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 4,
  },
  timeEventChildDivider: {
    backgroundColor: 'rgba(41, 37, 54, 0.36)',
    bottom: 0,
    left: 4,
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
  },
  timeEventTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    width: '100%',
  },
  timeEventChildBadge: {
    alignItems: 'center',
    borderColor: 'rgba(41, 37, 54, 0.24)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  timeEventChildBadgeText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 10,
  },
  timeEventText: {
    color: colors.text,
    flex: 1,
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 10,
  },
  timeEventTextCompact: {
    fontSize: 8,
    lineHeight: 9,
  },
  timeEventMeta: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    marginTop: 1,
  },
  googleFabWrapper: {
    position: 'absolute',
    zIndex: 30,
  },
  googleFab: {
    alignItems: 'center',
    backgroundColor: colors.lemon,
    borderColor: 'rgba(127, 135, 109, 0.18)',
    borderWidth: 1,
    borderRadius: 999,
    height: CALENDAR_FAB_SIZE,
    justifyContent: 'center',
    shadowColor: colors.plum,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    width: CALENDAR_FAB_SIZE,
  },
  googleFabPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  googleFabText: {
    color: colors.plum,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  modalOverlay: {
    backgroundColor: 'rgba(45, 42, 59, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  searchSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    gap: spacing.lg,
    maxHeight: '86%',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  eventEditor: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: spacing.md,
    maxHeight: '88%',
    overflow: 'hidden',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    position: 'relative',
  },
  editorScroll: {
    flexGrow: 0,
  },
  editorScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  editorHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(150, 167, 168, 0.28)',
    borderRadius: 999,
    height: 5,
    width: 54,
  },
  editorTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editorTopActionButton: {
    borderRadius: 14,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  editorAction: {
    color: colors.sage,
    fontSize: typography.md,
    fontWeight: '900',
  },
  editorDanger: {
    color: colors.danger,
    fontSize: typography.md,
    fontWeight: '900',
  },
  editorTopError: {
    backgroundColor: 'rgba(143, 74, 92, 0.10)',
    borderColor: 'rgba(143, 74, 92, 0.20)',
    borderRadius: 16,
    borderWidth: 1,
    color: colors.danger,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  eventKindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryPickerBlock: {
    gap: spacing.sm,
  },
  fieldCaption: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  kindChip: {
    alignItems: 'center',
    borderColor: 'rgba(150, 167, 168, 0.24)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  kindChipActive: {
    borderWidth: 2,
  },
  kindDot: {
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  kindChipText: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  kindChipTextActive: {
    color: colors.text,
  },
  editorRows: {
    gap: spacing.xs,
  },
  valueButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  valueButtonWide: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  timeValueButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 92,
    paddingHorizontal: spacing.md,
  },
  valueButtonText: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
  },
  inlinePicker: {
    backgroundColor: colors.mintSoft,
    borderColor: colors.mint,
    borderRadius: 20,
    borderWidth: 1,
    marginLeft: 46,
    overflow: 'hidden',
    padding: spacing.md,
  },
  editorRow: {
    alignItems: 'center',
    borderTopColor: 'rgba(150, 167, 168, 0.20)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  editorRowIcon: {
    color: colors.muted,
    fontSize: typography.lg,
    fontWeight: '800',
    textAlign: 'center',
    width: 30,
  },
  editorRowContent: {
    flex: 1,
  },
  editorRowText: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '800',
  },
  editorMutedText: {
    color: colors.muted,
    fontSize: typography.md,
    fontWeight: '800',
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  timeInput: {
    maxWidth: 110,
  },
  switchTrack: {
    alignItems: 'center',
    backgroundColor: 'rgba(150, 167, 168, 0.24)',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 58,
  },
  switchTrackActive: {
    backgroundColor: colors.lavenderSoft,
  },
  switchThumb: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 28,
    width: 28,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: colors.lavender,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.24)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  choiceChipActive: {
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavender,
  },
  choiceChipText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  choiceChipTextActive: {
    color: colors.plum,
  },
  categoryRow: {
    gap: spacing.sm,
  },
  categoryChip: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryChipActive: {
    borderColor: colors.lavender,
  },
  categoryDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  categoryText: {
    color: colors.text,
    fontSize: typography.xs,
    fontWeight: '900',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.xxl,
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  closeText: {
    color: colors.muted,
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 32,
  },
  eventDetails: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  detailTopActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailHero: {
    alignItems: 'center',
    borderRadius: 26,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  detailIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  detailIconText: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  detailBody: {
    flex: 1,
    gap: 2,
  },
  detailTime: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
  },
  detailTitle: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
  },
  detailMeta: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  detailInfoList: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.20)',
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  detailInfoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailInfoIcon: {
    color: colors.sage,
    fontSize: typography.md,
    fontWeight: '900',
    textAlign: 'center',
    width: 24,
  },
  detailInfoBody: {
    flex: 1,
    gap: 2,
  },
  detailInfoLabel: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  detailInfoValue: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '800',
    lineHeight: 22,
  },
  detailDescriptionInput: {
    minHeight: 112,
    paddingTop: spacing.md,
  },
  detailHint: {
    backgroundColor: colors.mintSoft,
    borderColor: colors.mint,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 20,
    padding: spacing.md,
  },
  pickerContent: {
    gap: spacing.md,
  },
  datePickerContent: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  timePickerContent: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  timePickerHeaderRow: {
    alignItems: 'flex-start',
  },
  timePickerHeaderText: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  pickerHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  pickerHeaderCenter: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  pickerArrowButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.20)',
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pickerArrowText: {
    color: colors.sage,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 28,
  },
  pickerTitle: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  pickerSubtitle: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  compactMonthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xs,
  },
  compactWeekday: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    width: `${100 / 7}%`,
  },
  compactDay: {
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  compactDayMuted: {
    opacity: 0.28,
  },
  compactDayActive: {
    backgroundColor: colors.lavender,
  },
  compactDayText: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  compactDayTextMuted: {
    color: colors.muted,
  },
  compactDayTextActive: {
    color: colors.plum,
  },
  timePickerCurrent: {
    color: colors.sage,
    flexShrink: 0,
    fontSize: typography.md,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: 3,
    minWidth: 48,
    textAlign: 'right',
  },
  wheelShell: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 150,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  wheelSelectionBand: {
    backgroundColor: 'rgba(150, 167, 168, 0.16)',
    borderRadius: 14,
    height: 40,
    left: spacing.xl,
    position: 'absolute',
    right: spacing.xl,
    top: 54,
  },
  wheelColumn: {
    maxHeight: 150,
    width: 74,
  },
  wheelColumnContent: {
    paddingVertical: 56,
  },
  wheelItem: {
    alignItems: 'center',
    height: TIME_WHEEL_ITEM_HEIGHT,
    justifyContent: 'center',
  },
  wheelItemText: {
    color: 'rgba(45, 42, 59, 0.32)',
    fontSize: 19,
    fontWeight: '700',
  },
  wheelItemTextActive: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  wheelDivider: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: '800',
    paddingBottom: 2,
    width: 18,
    textAlign: 'center',
  },
  repeatOptionList: {
    gap: spacing.sm,
  },
  repeatOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.20)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  repeatOptionActive: {
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavender,
  },
  repeatOptionTitle: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
  },
  repeatOptionTitleActive: {
    color: colors.plum,
  },
  repeatOptionHelper: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  repeatCheck: {
    color: colors.muted,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  repeatCheckActive: {
    color: colors.lavender,
  },
  weekdayPicker: {
    gap: spacing.sm,
  },
  weekdayPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weekdayChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.20)',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  weekdayChipActive: {
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavender,
  },
  weekdayChipText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  weekdayChipTextActive: {
    color: colors.plum,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
});
