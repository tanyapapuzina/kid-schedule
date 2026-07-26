import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCurrentSession, logout } from '@/shared/api/auth';
import { listFamilies, listFamilyMembers } from '@/shared/api/family';
import { AppButton } from '@/shared/components/AppButton';
import { Screen } from '@/shared/components/Screen';
import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';
import type { CurrentSession } from '@/shared/types/auth';
import type { Family, FamilyMember } from '@/shared/types/family';

type SettingsRowTone = 'default' | 'disabled' | 'danger';

type SettingsRowProps = {
  mark: string;
  title: string;
  subtitle?: string;
  tone?: SettingsRowTone;
  onPress?: () => void;
};

export default function ProfileScreen() {
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const childrenCount = useMemo(() => members.filter((member) => member.role === 'child').length, [members]);
  const adultsCount = useMemo(() => members.filter((member) => member.role === 'parent').length, [members]);
  const isParent = session?.actor_type === 'parent';
  const displayName = getDisplayName(session);
  const displayRole = getRoleLabel(session);
  const avatarLetter = displayName.slice(0, 1).toUpperCase();
  const avatarBackground = getAvatarBackground(session, members);
  const avatarTextColor = isParent ? colors.parentText : colors.plum;
  const familyName = family?.name ?? (session?.family_id ? 'Семья активна' : null);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, []),
  );

  async function loadProfile() {
    setIsLoading(true);
    setError(null);

    try {
      const currentSession = await getCurrentSession();
      const families = await listFamilies();
      const currentFamily = families[0] ?? null;
      const familyMembers = currentFamily ? await listFamilyMembers(currentFamily.id) : [];

      setSession(currentSession);
      setFamily(currentFamily);
      setMembers(familyMembers);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось загрузить профиль.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    setIsLogoutConfirmOpen(false);
    router.replace('/auth');
  }

  function openSoonNotice(sectionName: string) {
    setNoticeText(`${sectionName} появится позже.`);
  }

  if (isLoading) {
    return (
      <Screen scroll>
        <View style={styles.headerSkeleton}>
          <View style={styles.skeletonLineSmall} />
          <View style={styles.skeletonLineLarge} />
        </View>
        <View style={styles.profileCardSkeleton} />
        <View style={styles.rowSkeleton} />
        <View style={styles.rowSkeleton} />
        <View style={styles.rowSkeleton} />
      </Screen>
    );
  }

  if (error && !session) {
    return (
      <Screen scroll>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Профиль</Text>
            <Text style={styles.title}>Мой профиль</Text>
          </View>
        </View>

        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Не удалось загрузить профиль</Text>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton title="Повторить" variant="accent" onPress={loadProfile} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Профиль</Text>
          <Text style={styles.title}>{displayName}</Text>
        </View>
        <View style={[styles.headerAvatar, { backgroundColor: avatarBackground }]}>
          <Text style={[styles.headerAvatarText, { color: avatarTextColor }]}>{avatarLetter}</Text>
        </View>
      </View>

      <View style={styles.profileCard}>
        <View style={[styles.profileAvatar, { backgroundColor: avatarBackground }]}>
          <Text style={[styles.profileAvatarText, { color: avatarTextColor }]}>{avatarLetter}</Text>
        </View>

        <View style={styles.profileBody}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>{displayRole}</Text>
            </View>
          </View>

          {session?.email ? <Text style={styles.profileMeta}>{session.email}</Text> : null}
          {familyName ? <Text style={styles.profileMeta}>{familyName}</Text> : null}
          <Text style={styles.profileLogin}>{isParent ? 'Вход по email и паролю' : 'Вход по семейному коду'}</Text>
        </View>
      </View>

      <View style={styles.statusGrid}>
        {isParent ? (
          <>
            {family ? <StatusPill label="Семья создана" /> : null}
            {members.length ? <StatusPill label={`Участников: ${members.length}`} /> : null}
            {childrenCount ? <StatusPill label={`Детей: ${childrenCount}`} /> : null}
          </>
        ) : (
          <>
            <StatusPill label="Доступ: просмотр" />
            {familyName ? <StatusPill label="Семья активна" /> : null}
            <StatusPill label={`Роль: ${displayRole.toLowerCase()}`} />
          </>
        )}
      </View>

      <ProfileSection title="Аккаунт">
        <SettingsRow
          mark="Л"
          title="Личные данные"
          subtitle={isParent ? 'Имя и email' : 'Имя в семье'}
          tone="disabled"
          onPress={() => openSoonNotice('Личные данные')}
        />
        <SettingsRow
          mark="Б"
          title="Безопасность"
          subtitle={isParent ? 'Пароль и вход' : 'Семейный код'}
          tone="disabled"
          onPress={() => openSoonNotice('Безопасность')}
        />
        <SettingsRow
          mark="У"
          title="Уведомления"
          subtitle="Напоминания о событиях"
          tone="disabled"
          onPress={() => openSoonNotice('Уведомления')}
        />
      </ProfileSection>

      <ProfileSection title="Семья">
        <SettingsRow mark="С" title="Открыть семью" subtitle={familyName ?? 'Семья пока не создана'} onPress={() => router.push('/family')} />
        {isParent ? (
          <SettingsRow mark="Д" title="Добавить участника" subtitle="Ребенок или взрослый" onPress={() => router.push('/family')} />
        ) : (
          <SettingsRow mark="У" title="Участники" subtitle="Состав семьи" onPress={() => router.push('/family')} />
        )}
      </ProfileSection>

      <ProfileSection title="Приложение">
        <SettingsRow mark="Т" title="Тема" subtitle="Оформление приложения" tone="disabled" onPress={() => openSoonNotice('Тема')} />
        <SettingsRow mark="Я" title="Язык" subtitle="Русский" tone="disabled" onPress={() => openSoonNotice('Язык')} />
        <SettingsRow mark="О" title="О приложении" subtitle="Kid Schedule" onPress={() => setNoticeText('Kid Schedule помогает семье видеть расписание без лишнего шума.')} />
        <SettingsRow mark="П" title="Поддержка" subtitle="Помощь и обратная связь" tone="disabled" onPress={() => openSoonNotice('Поддержка')} />
      </ProfileSection>

      <Pressable
        accessibilityRole="button"
        onPress={() => setIsLogoutConfirmOpen(true)}
        style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}>
        <Text style={styles.logoutButtonText}>Выйти</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={noticeText !== null}>
        <View style={styles.modalOverlay}>
          <View style={styles.noticeModal}>
            <Text style={styles.modalTitle}>Информация</Text>
            <Text style={styles.modalText}>{noticeText}</Text>
            <AppButton title="Понятно" variant="accent" onPress={() => setNoticeText(null)} />
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={isLogoutConfirmOpen}>
        <View style={styles.modalOverlay}>
          <View style={styles.noticeModal}>
            <Text style={styles.modalTitle}>Выйти из аккаунта?</Text>
            <Text style={styles.modalText}>Вы сможете войти снова по email и паролю или по семейному коду.</Text>
            <View style={styles.modalButtons}>
              <AppButton title="Отмена" variant="secondary" onPress={() => setIsLogoutConfirmOpen(false)} />
              <Pressable
                accessibilityRole="button"
                onPress={handleLogout}
                style={({ pressed }) => [styles.confirmLogoutButton, pressed && styles.buttonPressed]}>
                <Text style={styles.confirmLogoutText}>Выйти</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ProfileSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({ mark, onPress, subtitle, title, tone = 'default' }: SettingsRowProps) {
  const isDisabled = tone === 'disabled';
  const isDanger = tone === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        isDisabled && styles.settingsRowDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}>
      <View style={[styles.rowMark, isDisabled && styles.rowMarkDisabled, isDanger && styles.rowMarkDanger]}>
        <Text style={[styles.rowMarkText, isDanger && styles.rowMarkDangerText]}>{mark}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, isDisabled && styles.rowTitleDisabled, isDanger && styles.rowTitleDanger]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.rowArrow, isDisabled && styles.rowArrowDisabled]}>›</Text>
    </Pressable>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function getDisplayName(session: CurrentSession | null): string {
  if (!session) {
    return 'Мой профиль';
  }

  return session.name ?? session.nickname ?? 'Мой профиль';
}

function getRoleLabel(session: CurrentSession | null): string {
  if (!session) {
    return 'Профиль';
  }

  if (session.actor_type === 'parent') {
    return 'Родитель';
  }

  return session.role === 'child' ? 'Ребенок' : 'Взрослый';
}

function getAvatarBackground(session: CurrentSession | null, members: FamilyMember[]): string {
  if (!session || session.actor_type === 'parent') {
    return colors.parentSoft;
  }

  const currentMember = members.find((member) => member.id === session.id);

  return currentMember?.color ? hexToRgba(currentMember.color, 0.18) : colors.lavenderSoft;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalizedHex = hex.replace('#', '');

  if (normalizedHex.length !== 6) {
    return colors.lavenderSoft;
  }

  const red = parseInt(normalizedHex.slice(0, 2), 16);
  const green = parseInt(normalizedHex.slice(2, 4), 16);
  const blue = parseInt(normalizedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.xxxl,
    fontWeight: '900',
    lineHeight: 39,
  },
  headerAvatar: {
    alignItems: 'center',
    borderRadius: 20,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  headerAvatarText: {
    fontSize: typography.lg,
    fontWeight: '900',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  profileAvatar: {
    alignItems: 'center',
    borderRadius: 26,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  profileAvatarText: {
    fontSize: typography.xxl,
    fontWeight: '900',
  },
  profileBody: {
    flex: 1,
    gap: spacing.xs,
  },
  nameRow: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  profileName: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
    lineHeight: 26,
    maxWidth: '100%',
  },
  profileMeta: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 19,
  },
  profileLogin: {
    color: colors.plum,
    fontSize: typography.xs,
    fontWeight: '900',
    lineHeight: 17,
  },
  roleChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lavenderSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  roleChipText: {
    color: colors.plum,
    fontSize: typography.xs,
    fontWeight: '900',
    textTransform: 'lowercase',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusPill: {
    backgroundColor: colors.lemonSoft,
    borderColor: 'rgba(127, 135, 109, 0.16)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 66,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingsRowDisabled: {
    opacity: 0.72,
  },
  rowMark: {
    alignItems: 'center',
    backgroundColor: colors.sageSoft,
    borderRadius: 14,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  rowMarkDisabled: {
    backgroundColor: colors.surfaceSoft,
  },
  rowMarkDanger: {
    backgroundColor: 'rgba(160, 79, 97, 0.10)',
  },
  rowMarkText: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  rowMarkDangerText: {
    color: colors.danger,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
  },
  rowTitleDisabled: {
    color: colors.muted,
  },
  rowTitleDanger: {
    color: colors.danger,
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 19,
  },
  rowArrow: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: '700',
  },
  rowArrowDisabled: {
    opacity: 0.45,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(160, 79, 97, 0.24)',
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 54,
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: typography.md,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(41, 37, 54, 0.36)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  noticeModal: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    gap: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
  },
  modalText: {
    color: colors.muted,
    fontSize: typography.md,
    fontWeight: '700',
    lineHeight: 22,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  confirmLogoutButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(160, 79, 97, 0.10)',
    borderColor: 'rgba(160, 79, 97, 0.24)',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmLogoutText: {
    color: colors.danger,
    fontSize: typography.md,
    fontWeight: '900',
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorTitle: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
  },
  errorText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  headerSkeleton: {
    gap: spacing.sm,
  },
  skeletonLineSmall: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 999,
    height: 16,
    width: 90,
  },
  skeletonLineLarge: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 999,
    height: 38,
    width: 190,
  },
  profileCardSkeleton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 28,
    borderWidth: 1,
    height: 112,
  },
  rowSkeleton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    height: 66,
  },
});
