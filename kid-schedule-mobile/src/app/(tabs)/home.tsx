import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentSession } from '@/shared/api/auth';
import { listEvents } from '@/shared/api/events';
import { listFamilies, listFamilyMembers } from '@/shared/api/family';
import { EVENT_PALETTE, toDisplayEvent, type DisplayCalendarEvent } from '@/shared/lib/calendarEvents';
import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';
import type { CurrentSession } from '@/shared/types/auth';
import type { CalendarEvent } from '@/shared/types/event';
import type { FamilyMember } from '@/shared/types/family';

const MONTHS = [
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

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WEEKDAY_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const DAY_CAPACITY_MINUTES = 8 * 60;
const DAY_CHART_HOURS = Array.from({ length: 17 }, (_, index) => index + 6);
const MAX_BAR_HEIGHT = 104;
const DAY_CHIP_WIDTH = 43;
const DAY_CHIP_GAP = 8;

const LOAD_COLORS = {
  empty: '#EEF2EC',
  low: '#8ED7A5',
  medium: '#F0D36A',
  high: '#F2A65A',
  extreme: '#D96B6B',
} as const;

type ChildDaySummary = {
  member: FamilyMember;
  eventsCount: number;
  minutes: number;
};

type LoadChartMode = 'day' | 'week';

type LoadBucket = {
  key: string;
  label: string;
  minutes: number;
  eventsCount: number;
  allDayCount: number;
  date?: Date;
};

export default function HomeScreen() {
  const router = useRouter();
  const today = useMemo(() => startOfDay(new Date()), []);
  const weekStripRef = useRef<ScrollView | null>(null);
  const [weekStripWidth, setWeekStripWidth] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(today));
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [familyId, setFamilyId] = useState<number | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [loadChartMode, setLoadChartMode] = useState<LoadChartMode>('day');
  const [selectedLoadBucketKey, setSelectedLoadBucketKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const visibleDays = useMemo(() => {
    const start = getWeekStart(selectedDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [selectedDate]);

  const dateStripDays = useMemo(() => buildMonthDays(selectedMonth), [selectedMonth]);

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.nickname])),
    [members],
  );

  const children = useMemo(() => members.filter((member) => member.role === 'child'), [members]);

  const displayEvents = useMemo(
    () => events.map((event) => toDisplayEvent(event, memberNames)),
    [events, memberNames],
  );

  const selectedDayEvents = useMemo(
    () =>
      displayEvents
        .filter((event) => eventOverlapsDay(event, selectedDate))
        .filter((event) => selectedChildId === null || event.child_member_id === selectedChildId)
        .sort((first, second) => first.starts_at.localeCompare(second.starts_at)),
    [displayEvents, selectedDate, selectedChildId],
  );

  const selectedDayMinutes = useMemo(
    () => selectedDayEvents.reduce((sum, event) => sum + getEventDurationMinutes(event), 0),
    [selectedDayEvents],
  );

  const nextEvent = useMemo(
    () => getNextEventForDay(selectedDayEvents, selectedDate, today),
    [selectedDayEvents, selectedDate, today],
  );

  const childSummaries = useMemo(
    () =>
      children.map((member) => {
        const childEvents = displayEvents.filter(
          (event) => event.child_member_id === member.id && eventOverlapsDay(event, selectedDate),
        );

        return {
          member,
          eventsCount: childEvents.length,
          minutes: childEvents.reduce((sum, event) => sum + getEventDurationMinutes(event), 0),
        };
      }),
    [children, displayEvents, selectedDate],
  );

  const chartEvents = useMemo(
    () =>
      displayEvents.filter(
        (event) => selectedChildId === null || event.child_member_id === selectedChildId,
      ),
    [displayEvents, selectedChildId],
  );

  const dayLoadBuckets = useMemo(
    () => buildDayLoadBuckets(selectedDayEvents, selectedDate),
    [selectedDayEvents, selectedDate],
  );

  const weekLoadBuckets = useMemo(
    () => buildWeekLoadBuckets(chartEvents, visibleDays),
    [chartEvents, visibleDays],
  );

  const activeLoadBuckets = loadChartMode === 'day' ? dayLoadBuckets : weekLoadBuckets;
  const activeLoadBucket = activeLoadBuckets.find((bucket) => bucket.key === selectedLoadBucketKey) ?? null;
  const selectedDayAllDayCount = selectedDayEvents.filter((event) => event.all_day).length;

  const loadData = useCallback(
    async ({ refreshing = false }: { refreshing?: boolean } = {}) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setLoadError(null);

      try {
        const currentSession = await getCurrentSession();
        const families = await listFamilies();
        const currentFamily = families[0];

        if (!currentFamily) {
          setSession(currentSession);
          setFamilyId(null);
          setMembers([]);
          setEvents([]);
          setLoadError('Сначала создайте семью, чтобы видеть расписание.');
          return;
        }

        const familyMembers = await listFamilyMembers(currentFamily.id);
        const periodStart = selectedMonth;
        const periodEnd = addMonths(selectedMonth, 1);
        const loadedEvents = await listEvents({
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        });

        setSession(currentSession);
        setFamilyId(currentFamily.id);
        setMembers(familyMembers);
        setEvents(loadedEvents);

        if (currentSession.actor_type === 'family_member' && currentSession.role === 'child') {
          setSelectedChildId(currentSession.id);
        }
      } catch (caughtError) {
        setLoadError(caughtError instanceof Error ? caughtError.message : 'Не удалось загрузить данные.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedMonth],
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    setSelectedLoadBucketKey(null);
  }, [loadChartMode, selectedChildId]);

  useEffect(() => {
    scrollWeekStripToDate(selectedDate, false);
  }, [dateStripDays, selectedDate, weekStripWidth]);

  function getCenteredWeekStripOffset(targetDate: Date): number | null {
    if (!weekStripWidth) {
      return null;
    }

    const targetDateKey = formatDateKey(targetDate);
    const targetIndex = dateStripDays.findIndex((date) => formatDateKey(date) === targetDateKey);

    if (targetIndex < 0) {
      return null;
    }

    const chipStep = DAY_CHIP_WIDTH + DAY_CHIP_GAP;

    return Math.max(0, targetIndex * chipStep - (weekStripWidth - DAY_CHIP_WIDTH) / 2);
  }

  function scrollWeekStripToDate(targetDate: Date, animated: boolean) {
    const scrollOffset = getCenteredWeekStripOffset(targetDate);

    if (scrollOffset === null) {
      return;
    }

    requestAnimationFrame(() => {
      weekStripRef.current?.scrollTo({ animated, x: scrollOffset });
    });
  }

  function handleTodayPress() {
    setSelectedMonth(startOfMonth(today));
    setSelectedDate(today);
    scrollWeekStripToDate(today, true);
  }

  function handleMonthChange(direction: -1 | 1) {
    const nextMonth = addMonths(selectedMonth, direction);

    setSelectedMonth(nextMonth);
    setSelectedDate(nextMonth);
    setSelectedLoadBucketKey(null);

    requestAnimationFrame(() => {
      weekStripRef.current?.scrollTo({ animated: false, x: 0 });
    });
  }

  function openCalendar() {
    router.push('/calendar');
  }

  function openFamily() {
    router.push('/family');
  }

  function toggleChildFilter(memberId: number) {
    setSelectedChildId((currentId) => (currentId === memberId ? null : memberId));
  }

  function toggleLoadBucket(bucket: LoadBucket) {
    setSelectedLoadBucketKey((currentKey) => (currentKey === bucket.key ? null : bucket.key));

    if (loadChartMode === 'week' && bucket.date) {
      selectDate(bucket.date);
    }
  }

  function selectDate(date: Date) {
    setSelectedMonth(startOfMonth(date));
    setSelectedDate(date);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.plum}
            onRefresh={() => loadData({ refreshing: true })}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{getGreeting(session)}</Text>
            <Text style={styles.dateTitle}>{formatReadableDate(selectedDate)}</Text>
          </View>

          <Pressable accessibilityRole="button" onPress={openCalendar} style={styles.headerFab}>
            <Text style={styles.headerFabText}>+</Text>
          </Pressable>
        </View>

        {loadError ? (
          <Pressable
            accessibilityRole="button"
            onPress={openFamily}
            style={({ pressed }) => [styles.noticeCard, pressed && styles.noticeCardPressed]}>
            <Text style={styles.noticeTitle}>Нужна настройка</Text>
            <Text style={styles.noticeText}>{loadError}</Text>
            <Text style={styles.noticeAction}>Перейти в семью</Text>
          </Pressable>
        ) : null}

        <View style={styles.planCard}>
          <View style={styles.planContent}>
            <Text style={styles.planLabel}>План дня</Text>
            <Text style={styles.planTitle}>
              {selectedDayEvents.length ? `${selectedDayEvents.length} событий` : 'Сегодня свободно'}
            </Text>
            <Text style={styles.planMeta}>
              {nextEvent
                ? `следующее в ${formatTime(new Date(nextEvent.starts_at))}`
                : selectedDayEvents.length
                  ? 'на сегодня все'
                  : 'можно добавить событие'}
            </Text>
          </View>

          <View style={styles.loadRingOuter}>
            <View style={styles.loadRingInner}>
              <Text style={styles.loadRingValue}>{formatMinutesCompact(selectedDayMinutes)}</Text>
              <Text style={styles.loadRingLabel}>занято</Text>
            </View>
          </View>
        </View>

        <View style={styles.weekStrip}>
          <View style={styles.weekHeader}>
            <View style={styles.monthNav}>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleMonthChange(-1)}
                hitSlop={8}
                style={styles.monthArrowButton}>
                <Text style={styles.monthArrowText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{formatMonthYear(selectedMonth)}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleMonthChange(1)}
                hitSlop={8}
                style={styles.monthArrowButton}>
                <Text style={styles.monthArrowText}>›</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" onPress={handleTodayPress}>
              <Text style={styles.todayLink}>Сегодня</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={weekStripRef}
            horizontal
            bounces
            decelerationRate="normal"
            onLayout={(event) => setWeekStripWidth(event.nativeEvent.layout.width)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekRow}>
            {dateStripDays.map((date) => {
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              const hasEvents = displayEvents.some((event) => eventOverlapsDay(event, date));

              return (
                <Pressable
                  key={formatDateKey(date)}
                  accessibilityRole="button"
                  onPress={() => selectDate(date)}
                  style={[
                    styles.dayChip,
                    isSelected && styles.dayChipActive,
                    isToday && !isSelected && styles.dayChipToday,
                  ]}>
                  <Text style={[styles.dayLabel, isSelected && styles.dayTextActive]}>
                    {WEEKDAY_SHORT[date.getDay()]}
                  </Text>
                  <Text style={[styles.dayNumber, isSelected && styles.dayTextActive]}>
                    {date.getDate()}
                  </Text>
                  <View
                    style={[
                      styles.eventDot,
                      hasEvents && styles.eventDotVisible,
                      isSelected && styles.eventDotActive,
                    ]}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ближайшее</Text>
          <Text style={styles.sectionHint}>{selectedDayEvents.length} событий</Text>
        </View>

        {selectedDayEvents.length ? (
          <ScrollView
            horizontal
            contentContainerStyle={styles.featuredRow}
            showsHorizontalScrollIndicator={false}>
            {selectedDayEvents.slice(0, 3).map((event) => (
              <Pressable
                key={event.occurrence_id ?? event.id}
                accessibilityRole="button"
                onPress={openCalendar}
                style={[styles.eventCard, { backgroundColor: event.softColor }]}>
                <View style={[styles.eventAvatar, { backgroundColor: event.color }]}>
                  <Text style={styles.eventAvatarText}>{event.child.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.eventTime}>{event.all_day ? 'весь день' : formatTime(new Date(event.starts_at))}</Text>
                <View style={styles.eventCategoryBadge}>
                  <View style={[styles.eventCategoryDot, { backgroundColor: event.color }]} />
                  <Text numberOfLines={1} style={styles.eventCategoryText}>
                    {EVENT_PALETTE[event.category].label}
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.eventTitle}>
                  {event.title}
                </Text>
                <Text numberOfLines={1} style={styles.eventMeta}>
                  {event.child} · {event.place}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Pressable accessibilityRole="button" onPress={openCalendar} style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Нет событий</Text>
            <Text style={styles.emptyText}>Оставить день свободным или добавить занятие в календаре.</Text>
          </Pressable>
        )}

        {selectedDayEvents.length > 3 ? (
          <Pressable accessibilityRole="button" onPress={openCalendar} style={styles.showAllButton}>
            <Text style={styles.showAllText}>Показать все в календаре</Text>
          </Pressable>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Дети сегодня</Text>
          {selectedChildId ? (
            <Pressable accessibilityRole="button" onPress={() => setSelectedChildId(null)}>
              <Text style={styles.resetFilterText}>Все дети</Text>
            </Pressable>
          ) : null}
        </View>

        {childSummaries.length ? (
          <ScrollView
            horizontal
            contentContainerStyle={styles.childrenRow}
            showsHorizontalScrollIndicator={false}>
            {childSummaries.map((summary) => {
              const isSelected = selectedChildId === summary.member.id;
              const percent = Math.min(100, Math.round((summary.minutes / DAY_CAPACITY_MINUTES) * 100));

              return (
                <Pressable
                  key={summary.member.id}
                  accessibilityRole="button"
                  onPress={() => toggleChildFilter(summary.member.id)}
                  style={[styles.childCard, isSelected && styles.childCardActive]}>
                  <View style={styles.childTopRow}>
                    <View style={styles.childAvatar}>
                      <Text style={styles.childAvatarText}>
                        {summary.member.nickname.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={styles.childName}>
                    {summary.member.nickname}
                  </Text>
                  <Text numberOfLines={1} style={styles.childMeta}>{formatChildMeta(summary)}</Text>
                  <View style={styles.childProgressTrack}>
                    <View style={[styles.childProgressFill, { width: `${percent}%` }]} />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Детей пока нет</Text>
            <Text style={styles.emptyText}>Добавьте ребенка во вкладке “Семья”, чтобы вести его расписание.</Text>
          </View>
        )}

        <View style={styles.loadChartCard}>
          <View style={styles.loadChartHeader}>
            <Text style={styles.loadChartTitle}>Нагрузка</Text>
            <View style={styles.loadModeSwitch}>
              {(['day', 'week'] as LoadChartMode[]).map((mode) => {
                const isActive = loadChartMode === mode;

                return (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    onPress={() => setLoadChartMode(mode)}
                    style={[styles.loadModeButton, isActive && styles.loadModeButtonActive]}>
                    <Text style={[styles.loadModeText, isActive && styles.loadModeTextActive]}>
                      {mode === 'day' ? 'День' : 'Неделя'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={styles.loadFilterRow}
            showsHorizontalScrollIndicator={false}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedChildId(null)}
              style={[styles.loadFilterChip, selectedChildId === null && styles.loadFilterChipActive]}>
              <Text
                style={[
                  styles.loadFilterText,
                  selectedChildId === null && styles.loadFilterTextActive,
                ]}>
                Все
              </Text>
            </Pressable>

            {children.map((child) => {
              const isActive = selectedChildId === child.id;

              return (
                <Pressable
                  key={child.id}
                  accessibilityRole="button"
                  onPress={() => toggleChildFilter(child.id)}
                  style={[styles.loadFilterChip, isActive && styles.loadFilterChipActive]}>
                  <Text style={[styles.loadFilterText, isActive && styles.loadFilterTextActive]}>
                    {child.nickname}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedDayAllDayCount > 0 && loadChartMode === 'day' ? (
            <View style={styles.allDayChip}>
              <Text style={styles.allDayChipText}>Весь день: {selectedDayAllDayCount}</Text>
            </View>
          ) : null}

          {activeLoadBucket ? (
            <View style={styles.loadTooltip}>
              <Text style={styles.loadTooltipText}>
                {formatLoadTooltip(activeLoadBucket, loadChartMode)}
              </Text>
            </View>
          ) : null}

          <ScrollView
            horizontal
            contentContainerStyle={[
              styles.loadBarsRow,
              loadChartMode === 'week' && styles.loadBarsRowWeek,
            ]}
            showsHorizontalScrollIndicator={false}>
            {activeLoadBuckets.map((bucket) => {
              const isSelected = selectedLoadBucketKey === bucket.key;
              const isCurrentDay = bucket.date ? isSameDay(bucket.date, selectedDate) : false;
              const maxMinutes = loadChartMode === 'day' ? 60 : getMaxBucketMinutes(activeLoadBuckets);
              const barHeight = getBarHeight(bucket.minutes, maxMinutes);

              return (
                <Pressable
                  key={bucket.key}
                  accessibilityRole="button"
                  onPress={() => toggleLoadBucket(bucket)}
                  style={styles.loadBarItem}>
                  <View style={[styles.loadBarTrack, isSelected && styles.loadBarTrackSelected]}>
                    <View
                      style={[
                        styles.loadBarFill,
                        {
                          backgroundColor: getLoadColor(bucket.minutes, loadChartMode),
                          height: barHeight,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.loadBarLabel,
                      (isSelected || isCurrentDay) && styles.loadBarLabelActive,
                    ]}>
                    {bucket.label}
                  </Text>
                  {isCurrentDay && loadChartMode === 'week' ? <View style={styles.selectedDayMarker} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.loadSummaryText}>
            {formatLoadSummary(loadChartMode === 'day' ? selectedDayMinutes : sumBucketMinutes(weekLoadBuckets))}
          </Text>
        </View>

        {familyId === null && !isLoading ? (
          <Text style={styles.footerHint}>Создайте семью, чтобы главная страница наполнилась данными.</Text>
        ) : null}
      </ScrollView>

    </SafeAreaView>
  );
}

function getGreeting(session: CurrentSession | null): string {
  if (session?.actor_type === 'family_member' && session.nickname) {
    return `Привет, ${session.nickname}`;
  }

  return 'Сегодня';
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfDay(date: Date): Date {
  const end = startOfDay(date);
  end.setDate(end.getDate() + 1);
  return end;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return startOfDay(nextDate);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function buildMonthDays(month: Date): Date[] {
  const monthStart = startOfMonth(month);
  const nextMonthStart = addMonths(monthStart, 1);
  const days: Date[] = [];

  for (let currentDay = monthStart; currentDay < nextMonthStart; currentDay = addDays(currentDay, 1)) {
    days.push(currentDay);
  }

  return days;
}

function getWeekStart(date: Date): Date {
  const weekStart = startOfDay(date);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  return weekStart;
}

function isSameDay(firstDate: Date, secondDate: Date): boolean {
  return formatDateKey(firstDate) === formatDateKey(secondDate);
}

function eventOverlapsDay(event: CalendarEvent, date: Date): boolean {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const eventStart = new Date(event.starts_at);
  const eventEnd = new Date(event.ends_at);

  return eventStart < dayEnd && eventEnd > dayStart;
}

function getNextEventForDay(
  events: DisplayCalendarEvent[],
  selectedDate: Date,
  today: Date,
): DisplayCalendarEvent | null {
  if (!events.length) {
    return null;
  }

  if (!isSameDay(selectedDate, today)) {
    return events[0];
  }

  const now = new Date();
  return events.find((event) => new Date(event.ends_at) > now) ?? null;
}

function getEventDurationMinutes(event: CalendarEvent): number {
  if (event.all_day) {
    return DAY_CAPACITY_MINUTES;
  }

  const startsAt = new Date(event.starts_at).getTime();
  const endsAt = new Date(event.ends_at).getTime();

  return Math.max(0, Math.round((endsAt - startsAt) / 60000));
}

function buildDayLoadBuckets(events: CalendarEvent[], date: Date): LoadBucket[] {
  return DAY_CHART_HOURS.map((hour) => {
    const bucketStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
    const bucketEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour + 1);
    const bucketEvents = events.filter(
      (event) => !event.all_day && getOverlapMinutes(event, bucketStart, bucketEnd) > 0,
    );
    const minutes = bucketEvents.reduce(
      (sum, event) => sum + getOverlapMinutes(event, bucketStart, bucketEnd),
      0,
    );

    return {
      key: `hour-${hour}`,
      label: String(hour),
      minutes,
      eventsCount: bucketEvents.length,
      allDayCount: 0,
    };
  });
}

function buildWeekLoadBuckets(events: CalendarEvent[], days: Date[]): LoadBucket[] {
  return days.map((day) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const dayEvents = events.filter((event) => eventOverlapsDay(event, day));
    const allDayCount = dayEvents.filter((event) => event.all_day).length;
    const timedMinutes = dayEvents.reduce((sum, event) => {
      if (event.all_day) {
        return sum + DAY_CAPACITY_MINUTES;
      }

      return sum + getOverlapMinutes(event, dayStart, dayEnd);
    }, 0);

    return {
      key: `day-${formatDateKey(day)}`,
      label: WEEKDAY_SHORT[day.getDay()],
      minutes: timedMinutes,
      eventsCount: dayEvents.length,
      allDayCount,
      date: day,
    };
  });
}

function getOverlapMinutes(event: CalendarEvent, periodStart: Date, periodEnd: Date): number {
  const startsAt = new Date(event.starts_at).getTime();
  const endsAt = new Date(event.ends_at).getTime();
  const start = Math.max(startsAt, periodStart.getTime());
  const end = Math.min(endsAt, periodEnd.getTime());

  return Math.max(0, Math.round((end - start) / 60000));
}

function getMaxBucketMinutes(buckets: LoadBucket[]): number {
  return Math.max(60, ...buckets.map((bucket) => bucket.minutes));
}

function getBarHeight(minutes: number, maxMinutes: number): number {
  if (!minutes) {
    return 8;
  }

  const ratio = Math.min(1, minutes / maxMinutes);
  return Math.max(12, Math.round(ratio * MAX_BAR_HEIGHT));
}

function getLoadColor(minutes: number, mode: LoadChartMode): string {
  if (!minutes) {
    return LOAD_COLORS.empty;
  }

  if (mode === 'week') {
    if (minutes <= 2 * 60) {
      return LOAD_COLORS.low;
    }

    if (minutes <= 4 * 60) {
      return LOAD_COLORS.medium;
    }

    if (minutes <= 6 * 60) {
      return LOAD_COLORS.high;
    }

    return LOAD_COLORS.extreme;
  }

  if (minutes <= 20) {
    return LOAD_COLORS.low;
  }

  if (minutes <= 40) {
    return LOAD_COLORS.medium;
  }

  if (minutes <= 60) {
    return LOAD_COLORS.high;
  }

  return LOAD_COLORS.extreme;
}

function sumBucketMinutes(buckets: LoadBucket[]): number {
  return buckets.reduce((sum, bucket) => sum + bucket.minutes, 0);
}

function formatLoadSummary(minutes: number): string {
  if (!minutes) {
    return 'День свободен';
  }

  if (minutes <= 2 * 60) {
    return `Легкая нагрузка · ${formatMinutesCompact(minutes)}`;
  }

  if (minutes <= 5 * 60) {
    return `Средняя нагрузка · ${formatMinutesCompact(minutes)}`;
  }

  return `Много дел · ${formatMinutesCompact(minutes)}`;
}

function formatLoadTooltip(bucket: LoadBucket, mode: LoadChartMode): string {
  const eventPart = `${bucket.eventsCount} ${getEventWord(bucket.eventsCount)}`;
  const timePart = formatMinutesCompact(bucket.minutes);

  if (mode === 'day') {
    return `${bucket.label}:00 · ${eventPart} · ${timePart}`;
  }

  const dayName = bucket.date ? WEEKDAY_LONG[bucket.date.getDay()] : bucket.label;
  const allDayPart = bucket.allDayCount ? ` · весь день: ${bucket.allDayCount}` : '';
  return `${capitalizeFirstLetter(dayName)} · ${eventPart} · ${timePart}${allDayPart}`;
}

function capitalizeFirstLetter(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatReadableDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function formatMonthYear(date: Date): string {
  const formattedDate = date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  return formattedDate.slice(0, 1).toUpperCase() + formattedDate.slice(1);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatMinutesCompact(minutes: number): string {
  if (!minutes) {
    return '0 ч';
  }

  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace('.', ',')} ч`;
}

function formatChildMeta(summary: ChildDaySummary): string {
  return `${summary.eventsCount} ${getEventWord(summary.eventsCount)} · ${formatMinutesCompact(summary.minutes)}`;
}

function getEventWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'событие';
  }

  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return 'события';
  }

  return 'событий';
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  dateTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 38,
  },
  noticeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeCardPressed: {
    opacity: 0.78,
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
  noticeAction: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
    marginTop: 2,
  },
  planCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.lavender,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    minHeight: 152,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  planContent: {
    flex: 1,
    gap: spacing.xs,
  },
  planLabel: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  planTitle: {
    color: colors.text,
    fontSize: typography.xxl,
    fontWeight: '900',
    lineHeight: 31,
  },
  planMeta: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  loadRingOuter: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.lavender,
    borderRadius: 999,
    borderWidth: 9,
    height: 98,
    justifyContent: 'center',
    width: 98,
  },
  loadRingInner: {
    alignItems: 'center',
    backgroundColor: colors.lemonSoft,
    borderRadius: 999,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  loadRingValue: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  loadRingLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  weekStrip: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  weekHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthNav: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  monthArrowButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  monthArrowText: {
    color: colors.muted,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 30,
  },
  monthTitle: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  todayLink: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  weekRow: {
    gap: DAY_CHIP_GAP,
    flexDirection: 'row',
    paddingRight: spacing.xs,
  },
  dayChip: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 18,
    borderWidth: 1,
    gap: 2,
    height: 62,
    justifyContent: 'center',
    width: 43,
  },
  dayChipActive: {
    backgroundColor: colors.lavender,
  },
  dayChipToday: {
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavender,
  },
  dayLabel: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
  },
  dayNumber: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
  },
  dayTextActive: {
    color: colors.text,
  },
  eventDot: {
    backgroundColor: 'transparent',
    borderRadius: 999,
    height: 5,
    marginTop: 1,
    width: 5,
  },
  eventDotVisible: {
    backgroundColor: colors.sage,
  },
  eventDotActive: {
    backgroundColor: colors.plum,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
  },
  sectionHint: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
    paddingBottom: 2,
  },
  featuredRow: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  eventCard: {
    borderColor: 'rgba(41, 37, 54, 0.04)',
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.xs,
    height: 190,
    padding: spacing.md,
    width: 148,
  },
  eventAvatar: {
    alignItems: 'center',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  eventAvatarText: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
  },
  eventTime: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  eventCategoryBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderColor: 'rgba(41, 37, 54, 0.06)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventCategoryDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  eventCategoryText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  eventTitle: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
    lineHeight: 20,
    minHeight: 40,
  },
  eventMeta: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 'auto',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.xs,
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
  showAllButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  showAllText: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  resetFilterText: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
    paddingBottom: 2,
  },
  childrenRow: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  childCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.xs,
    height: 176,
    padding: spacing.md,
    width: 172,
  },
  childCardActive: {
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavender,
  },
  childTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  childAvatar: {
    alignItems: 'center',
    backgroundColor: colors.lavenderSoft,
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  childAvatarText: {
    color: colors.plum,
    fontSize: typography.md,
    fontWeight: '900',
  },
  childName: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  childMeta: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  childProgressTrack: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 999,
    height: 8,
    marginTop: 'auto',
    overflow: 'hidden',
  },
  childProgressFill: {
    backgroundColor: colors.lavender,
    borderRadius: 999,
    height: '100%',
  },
  loadChartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  loadChartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loadChartTitle: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  loadModeSwitch: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  loadModeButton: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  loadModeButtonActive: {
    backgroundColor: colors.lavenderSoft,
  },
  loadModeText: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
  },
  loadModeTextActive: {
    color: colors.plum,
  },
  loadFilterRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  loadFilterChip: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  loadFilterChipActive: {
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavender,
  },
  loadFilterText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  loadFilterTextActive: {
    color: colors.plum,
  },
  allDayChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lemonSoft,
    borderColor: colors.lemon,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  allDayChipText: {
    color: colors.text,
    fontSize: typography.xs,
    fontWeight: '900',
  },
  loadTooltip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadTooltipText: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  loadBarsRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
    height: 140,
    paddingTop: spacing.xs,
    paddingRight: spacing.xs,
  },
  loadBarsRowWeek: {
    flexGrow: 1,
    justifyContent: 'space-between',
    minWidth: '100%',
  },
  loadBarItem: {
    alignItems: 'center',
    gap: 7,
    justifyContent: 'flex-end',
    minWidth: 20,
  },
  loadBarTrack: {
    alignItems: 'center',
    backgroundColor: LOAD_COLORS.empty,
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    height: MAX_BAR_HEIGHT,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 11,
  },
  loadBarTrackSelected: {
    borderColor: colors.plum,
    width: 14,
  },
  loadBarFill: {
    borderRadius: 999,
    width: '100%',
  },
  loadBarLabel: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
  },
  loadBarLabelActive: {
    color: colors.text,
  },
  selectedDayMarker: {
    backgroundColor: colors.lavender,
    borderRadius: 999,
    height: 5,
    marginTop: -3,
    width: 5,
  },
  loadSummaryText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  headerFab: {
    alignItems: 'center',
    backgroundColor: colors.lemon,
    borderColor: 'rgba(127, 135, 109, 0.18)',
    borderWidth: 1,
    borderRadius: 999,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  headerFabText: {
    color: colors.plum,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 32,
  },
  footerHint: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
  },
});
