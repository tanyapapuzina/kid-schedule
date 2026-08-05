import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ColorPicker, { BrightnessSlider, Panel3, Preview } from 'reanimated-color-picker';

import { getCurrentSession } from '@/shared/api/auth';
import {
  archiveFamilyMember,
  createFamily,
  createFamilyMember,
  getFamily,
  listFamilies,
  listFamilyMembers,
  updateFamilyMember,
} from '@/shared/api/family';
import { createFamilyJoinCode } from '@/shared/api/familyCodes';
import { AppButton } from '@/shared/components/AppButton';
import { AppTextInput } from '@/shared/components/AppTextInput';
import { EmptyState } from '@/shared/components/EmptyState';
import { Screen } from '@/shared/components/Screen';
import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';
import type { CurrentSession } from '@/shared/types/auth';
import type { Family, FamilyJoinCode, FamilyMember, FamilyMemberRole } from '@/shared/types/family';

const ROLE_META: Record<
  FamilyMemberRole,
  { label: string; text: string; soft: string; accent: string; description: string }
> = {
  parent: {
    label: 'Родитель',
    text: '#536B8E',
    soft: '#EAF0F8',
    accent: '#536B8E',
    description: 'Взрослый',
  },
  child: {
    label: 'Ребенок',
    text: colors.plum,
    soft: colors.lavenderSoft,
    accent: colors.lavenderSoft,
    description: 'Ребенок',
  },
};

const PARENT_MEMBER_COLOR = '#536B8E';
const PARENT_MEMBER_SOFT_COLOR = '#EAF0F8';

export default function FamilyScreen() {
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFamilySaving, setIsFamilySaving] = useState(false);
  const [isCodeLoadingForMemberId, setIsCodeLoadingForMemberId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFamilyCreateOpen, setIsFamilyCreateOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isMemberEditOpen, setIsMemberEditOpen] = useState(false);
  const [isMemberDeleteConfirmOpen, setIsMemberDeleteConfirmOpen] = useState(false);
  const [isMemberSaving, setIsMemberSaving] = useState(false);
  const [isMemberArchiving, setIsMemberArchiving] = useState(false);
  const [draftNickname, setDraftNickname] = useState('');
  const [draftRole, setDraftRole] = useState<FamilyMemberRole>('child');
  const [draftColor, setDraftColor] = useState(() => getRandomMemberColor());
  const [memberDraftNickname, setMemberDraftNickname] = useState('');
  const [memberDraftColor, setMemberDraftColor] = useState(() => getRandomMemberColor());
  const [draftFamilyName, setDraftFamilyName] = useState('');
  const [draftOwnerNickname, setDraftOwnerNickname] = useState('');
  const [joinCode, setJoinCode] = useState<FamilyJoinCode | null>(null);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [copyCodeError, setCopyCodeError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [familyFormError, setFamilyFormError] = useState<string | null>(null);
  const codeCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const children = useMemo(() => members.filter((member) => member.role === 'child'), [members]);
  const adults = useMemo(() => members.filter((member) => member.role === 'parent'), [members]);
  const sortedMembers = useMemo(
    () =>
      [...members].sort((first, second) => {
        if (first.role !== second.role) {
          return first.role === 'parent' ? -1 : 1;
        }

        return first.created_at.localeCompare(second.created_at);
      }),
    [members],
  );

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      async function loadFamily() {
        setIsLoading(true);
        setLoadError(null);

        try {
          const currentSession = await getCurrentSession();
          const families = await listFamilies();
          const currentFamily = families[0];

          if (!currentFamily) {
            if (!isCancelled) {
              setSession(currentSession);
              setFamily(null);
              setMembers([]);
              setLoadError('Семья пока не создана.');
            }
            return;
          }

          const freshFamily = await getFamily(currentFamily.id);
          const familyMembers = await listFamilyMembers(currentFamily.id);

          if (!isCancelled) {
            setSession(currentSession);
            setFamily(freshFamily);
            setMembers(familyMembers);
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

      loadFamily();

      return () => {
        isCancelled = true;
      };
    }, []),
  );

  useEffect(
    () => () => {
      if (codeCopiedTimeoutRef.current) {
        clearTimeout(codeCopiedTimeoutRef.current);
      }
    },
    [],
  );

  async function handleCreateMember() {
    if (!family) {
      setFormError('Семья не найдена.');
      return;
    }

    const nickname = draftNickname.trim();

    if (!nickname) {
      setFormError('Введите имя участника.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const createdMember = await createFamilyMember(family.id, {
        nickname,
        role: draftRole,
        color: draftRole === 'parent' ? PARENT_MEMBER_COLOR : draftColor,
      });

      setMembers((currentMembers) => [...currentMembers, createdMember]);
      setDraftNickname('');
      setDraftRole('child');
      setDraftColor(getRandomMemberColor());
      setIsCreateOpen(false);
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : 'Не удалось добавить участника.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateFamily() {
    const familyName = draftFamilyName.trim();
    const ownerNickname = draftOwnerNickname.trim();

    if (!familyName || !ownerNickname) {
      setFamilyFormError('Введите название семьи и ваше имя внутри семьи.');
      return;
    }

    setIsFamilySaving(true);
    setFamilyFormError(null);
    setLoadError(null);

    try {
      const createdFamily = await createFamily({
        name: familyName,
        owner_nickname: ownerNickname,
      });
      const familyMembers = await listFamilyMembers(createdFamily.id);

      setFamily(createdFamily);
      setMembers(familyMembers);
      setDraftFamilyName('');
      setDraftOwnerNickname('');
      setIsFamilyCreateOpen(false);
    } catch (caughtError) {
      setFamilyFormError(caughtError instanceof Error ? caughtError.message : 'Не удалось создать семью.');
    } finally {
      setIsFamilySaving(false);
    }
  }

  async function handleCreateJoinCode(member: FamilyMember) {
    if (!family) {
      setFormError('Семья не найдена.');
      return;
    }

    setIsCodeLoadingForMemberId(member.id);
    setFormError(null);

    try {
      const createdCode = await createFamilyJoinCode(family.id, member.id);
      setIsCodeCopied(false);
      setCopyCodeError(null);
      setJoinCode(createdCode);
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : 'Не удалось создать код входа.');
    } finally {
      setIsCodeLoadingForMemberId(null);
    }
  }

  function openMemberDetails(member: FamilyMember) {
    setSelectedMember(member);
    setMemberDraftNickname(member.nickname);
    setMemberDraftColor(getMemberVisualColor(member));
    setMemberActionError(null);
    setIsMemberEditOpen(false);
    setIsMemberDeleteConfirmOpen(false);
  }

  function closeMemberDetails() {
    setSelectedMember(null);
    setMemberActionError(null);
    setIsMemberEditOpen(false);
    setIsMemberDeleteConfirmOpen(false);
  }

  function openCreateMemberModal() {
    setDraftNickname('');
    setDraftRole('child');
    setDraftColor(getRandomMemberColor());
    setFormError(null);
    setIsCreateOpen(true);
  }

  function closeJoinCodeModal() {
    if (codeCopiedTimeoutRef.current) {
      clearTimeout(codeCopiedTimeoutRef.current);
      codeCopiedTimeoutRef.current = null;
    }

    setIsCodeCopied(false);
    setCopyCodeError(null);
    setJoinCode(null);
  }

  async function handleCopyJoinCode() {
    if (!joinCode?.code) {
      return;
    }

    try {
      const Clipboard = await import('expo-clipboard');

      await Clipboard.setStringAsync(joinCode.code);
      setIsCodeCopied(true);
      setCopyCodeError(null);
    } catch {
      setCopyCodeError('Пересоберите iOS-приложение, чтобы включить копирование.');
      return;
    }

    if (codeCopiedTimeoutRef.current) {
      clearTimeout(codeCopiedTimeoutRef.current);
    }

    codeCopiedTimeoutRef.current = setTimeout(() => {
      setIsCodeCopied(false);
      codeCopiedTimeoutRef.current = null;
    }, 1800);
  }

  async function handleUpdateMember() {
    if (!family || !selectedMember) {
      setMemberActionError('Участник не найден.');
      return;
    }

    const nickname = memberDraftNickname.trim();

    if (!nickname) {
      setMemberActionError('Введите имя участника.');
      return;
    }

    setIsMemberSaving(true);
    setMemberActionError(null);

    try {
      const updatedMember = await updateFamilyMember(family.id, selectedMember.id, {
        nickname,
        ...(selectedMember.role === 'child' ? { color: memberDraftColor } : {}),
      });

      setMembers((currentMembers) =>
        currentMembers.map((member) => (member.id === updatedMember.id ? updatedMember : member)),
      );
      setSelectedMember(updatedMember);
      setIsMemberEditOpen(false);
    } catch (caughtError) {
      setMemberActionError(caughtError instanceof Error ? caughtError.message : 'Не удалось изменить участника.');
    } finally {
      setIsMemberSaving(false);
    }
  }

  async function handleArchiveMember() {
    if (!family || !selectedMember) {
      setMemberActionError('Участник не найден.');
      return;
    }

    setIsMemberArchiving(true);
    setMemberActionError(null);

    try {
      await archiveFamilyMember(family.id, selectedMember.id);
      setMembers((currentMembers) => currentMembers.filter((member) => member.id !== selectedMember.id));
      closeMemberDetails();
    } catch (caughtError) {
      setMemberActionError(caughtError instanceof Error ? caughtError.message : 'Не удалось убрать участника.');
    } finally {
      setIsMemberArchiving(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Семья</Text>
          <Text style={styles.title}>{family?.name ?? 'Моя семья'}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{family?.name.slice(0, 1).toUpperCase() ?? 'K'}</Text>
        </View>
      </View>

      {loadError ? (
        <Pressable
          accessibilityRole={session?.actor_type === 'parent' ? 'button' : undefined}
          disabled={session?.actor_type !== 'parent'}
          onPress={() => setIsFamilyCreateOpen(true)}
          style={({ pressed }) => [
            session?.actor_type === 'parent' && styles.emptyFamilyAction,
            pressed && styles.emptyFamilyActionPressed,
          ]}>
          <EmptyState
            title="Семья не загружена"
            text={`${loadError} Если вы родитель, создайте семью в кабинете. Если вы участник, войдите по коду.`}
          />
        </Pressable>
      ) : null}

      {!family && !isLoading && session?.actor_type === 'parent' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsFamilyCreateOpen(true)}
          style={styles.addFamilyCard}>
          <Text style={styles.addFamilyKicker}>Первый шаг</Text>
          <Text style={styles.addFamilyTitle}>Создать семью</Text>
          <Text style={styles.addFamilyText}>После этого можно добавить детей, взрослых и расписание.</Text>
        </Pressable>
      ) : null}

      {isLoading ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Подготавливаем данные</Text>
          <Text style={styles.noticeText}>Скоро все появится на экране.</Text>
        </View>
      ) : null}

      {family ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryMonogram}>
              <Text style={styles.summaryMonogramText}>{family.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>{members.length} участника</Text>
              <Text style={styles.summaryMeta}>
                {adults.length} взрослых · {children.length} детей
              </Text>
              <Text style={styles.summaryDate}>с {formatReadableDate(new Date(family.created_at))}</Text>
            </View>
          </View>

          <View style={styles.quickStatsRow}>
            <QuickStatPill label="Взрослый" value={adults.length} tone="parent" />
            <QuickStatPill label="Дети" value={children.length} tone="child" />
          </View>

          {children.length === 0 ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Нет детей</Text>
              <Text style={styles.noticeText}>
                Чтобы создавать события в календаре, нужен участник с ролью ребенок.
              </Text>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Участники</Text>
              <Text style={styles.sectionHint}>{members.length}</Text>
            </View>

            {session?.actor_type === 'parent' ? (
              <Pressable
                accessibilityRole="button"
                onPress={openCreateMemberModal}
                style={({ pressed }) => [styles.addMemberTopButton, pressed && styles.addMemberTopButtonPressed]}>
                <Text style={styles.addMemberTopButtonText}>+ Добавить</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.membersGrid}>
            {sortedMembers.map((member) => (
              <MemberCard
                key={member.id}
                canCreateCode={session?.actor_type === 'parent' && member.parent_id === null}
                isCodeLoading={isCodeLoadingForMemberId === member.id}
                member={member}
                onCreateCode={() => handleCreateJoinCode(member)}
                onPress={() => openMemberDetails(member)}
              />
            ))}
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        </>
      ) : null}

      <Modal animationType="slide" transparent visible={isCreateOpen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKeyboardView}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Новый участник</Text>
                <Text style={styles.modalTitle}>Добавить в семью</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsCreateOpen(false);
                  setFormError(null);
                  setDraftColor(getRandomMemberColor());
                }}
                style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalFormContent}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <AppTextInput
                label="Имя или никнейм"
                onChangeText={setDraftNickname}
                placeholder="Имя участника"
                value={draftNickname}
              />

              <View style={styles.choiceBlock}>
                <Text style={styles.choiceLabel}>Роль</Text>
                <View style={styles.choiceRow}>
                  <RoleChoice role="child" selectedRole={draftRole} onPress={setDraftRole} />
                  <RoleChoice role="parent" selectedRole={draftRole} onPress={setDraftRole} />
                </View>
              </View>

              {draftRole === 'child' ? (
                <View style={styles.choiceBlock}>
                  <View style={styles.colorHeader}>
                    <Text style={styles.choiceLabel}>Цвет ребенка</Text>
                    <View style={styles.colorValuePill}>
                      <View style={[styles.colorValueDot, { backgroundColor: draftColor }]} />
                      <Text style={styles.colorValueText}>{draftColor.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.colorPickerCard}>
                    <ColorPicker
                      boundedThumb
                      enableColorAnnouncements={false}
                      onChangeJS={(selectedColor) => setDraftColor(selectedColor.hex)}
                      sliderThickness={18}
                      thumbShape="ring"
                      thumbSize={24}
                      value={draftColor}>
                      <View style={styles.colorPickerTop}>
                        <Panel3
                          centerChannel="saturation"
                          renderCenterLine
                          style={styles.colorWheel}
                          thumbStyle={styles.colorThumb}
                        />
                        <Preview
                          hideText
                          style={styles.colorPreview}
                        />
                      </View>
                      <BrightnessSlider style={styles.colorBrightnessSlider} />
                    </ColorPicker>
                  </View>
                </View>
              ) : null}

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <AppButton
                disabled={isSaving}
                title={isSaving ? 'Добавляем...' : 'Добавить участника'}
                variant="accent"
                onPress={handleCreateMember}
              />
            </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal animationType="slide" transparent visible={isFamilyCreateOpen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKeyboardView}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Семья</Text>
                <Text style={styles.modalTitle}>Создать пространство</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsFamilyCreateOpen(false);
                  setFamilyFormError(null);
                }}
                style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalFormContent}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <AppTextInput
                label="Название семьи"
                onChangeText={setDraftFamilyName}
                placeholder="Название семьи"
                value={draftFamilyName}
              />
              <AppTextInput
                label="Ваше имя в семье"
                onChangeText={setDraftOwnerNickname}
                placeholder="Ваше имя в семье"
                value={draftOwnerNickname}
              />

              {familyFormError ? <Text style={styles.errorText}>{familyFormError}</Text> : null}

              <AppButton
                disabled={isFamilySaving}
                title={isFamilySaving ? 'Создаем...' : 'Создать семью'}
                variant="accent"
                onPress={handleCreateFamily}
              />
            </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal animationType="slide" transparent visible={selectedMember !== null}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKeyboardView}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
            {selectedMember ? (
              isMemberDeleteConfirmOpen ? (
                <View style={styles.form}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalEyebrow}>Подтверждение</Text>
                      <Text style={styles.modalTitle}>Убрать участника?</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setIsMemberDeleteConfirmOpen(false)}
                      style={styles.closeButton}>
                      <Text style={styles.closeText}>×</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.confirmText}>
                    {selectedMember.nickname} исчезнет из активного состава семьи. Его старые события останутся в календаре,
                    но новые события для него создавать нельзя.
                  </Text>

                  {memberActionError ? <Text style={styles.errorText}>{memberActionError}</Text> : null}

                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setIsMemberDeleteConfirmOpen(false)}
                      style={styles.secondaryActionButton}>
                      <Text style={styles.secondaryActionText}>Отмена</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isMemberArchiving}
                      onPress={handleArchiveMember}
                      style={[styles.dangerActionButton, isMemberArchiving && styles.disabledActionButton]}>
                      <Text style={styles.dangerActionText}>
                        {isMemberArchiving ? 'Убираем...' : 'Убрать'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : isMemberEditOpen ? (
                <ScrollView
                  contentContainerStyle={styles.modalFormContent}
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalEyebrow}>Редактирование</Text>
                      <Text style={styles.modalTitle}>{selectedMember.nickname}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setIsMemberEditOpen(false)}
                      style={styles.closeButton}>
                      <Text style={styles.closeText}>×</Text>
                    </Pressable>
                  </View>

                  <AppTextInput
                    label="Имя или никнейм"
                    onChangeText={setMemberDraftNickname}
                    placeholder="Имя участника"
                    value={memberDraftNickname}
                  />

                  {selectedMember.role === 'child' ? (
                    <View style={styles.choiceBlock}>
                      <View style={styles.colorHeader}>
                        <Text style={styles.choiceLabel}>Цвет ребенка</Text>
                        <View style={styles.colorValuePill}>
                          <View style={[styles.colorValueDot, { backgroundColor: memberDraftColor }]} />
                          <Text style={styles.colorValueText}>{memberDraftColor.toUpperCase()}</Text>
                        </View>
                      </View>

                      <View style={styles.colorPickerCard}>
                        <ColorPicker
                          boundedThumb
                          enableColorAnnouncements={false}
                          onChangeJS={(selectedColor) => setMemberDraftColor(selectedColor.hex)}
                          sliderThickness={18}
                          thumbShape="ring"
                          thumbSize={24}
                          value={memberDraftColor}>
                          <View style={styles.colorPickerTop}>
                            <Panel3
                              centerChannel="saturation"
                              renderCenterLine
                              style={styles.colorWheel}
                              thumbStyle={styles.colorThumb}
                            />
                            <Preview hideText style={styles.colorPreview} />
                          </View>
                          <BrightnessSlider style={styles.colorBrightnessSlider} />
                        </ColorPicker>
                      </View>
                    </View>
                  ) : null}

                  {memberActionError ? <Text style={styles.errorText}>{memberActionError}</Text> : null}

                  <AppButton
                    disabled={isMemberSaving}
                    title={isMemberSaving ? 'Сохраняем...' : 'Сохранить'}
                    variant="accent"
                    onPress={handleUpdateMember}
                  />
                </ScrollView>
              ) : (
                <View style={styles.form}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalEyebrow}>Участник</Text>
                      <Text style={styles.modalTitle}>{selectedMember.nickname}</Text>
                    </View>
                    <Pressable accessibilityRole="button" onPress={closeMemberDetails} style={styles.closeButton}>
                      <Text style={styles.closeText}>×</Text>
                    </Pressable>
                  </View>

                  <View style={styles.memberSheetHero}>
                    <View
                      style={[
                        styles.memberSheetAvatar,
                        { backgroundColor: hexToRgba(getMemberVisualColor(selectedMember), 0.18) },
                      ]}>
                      <Text style={[styles.memberSheetAvatarText, { color: getMemberVisualColor(selectedMember) }]}>
                        {selectedMember.nickname.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberBody}>
                      <Text style={styles.memberSheetName}>{selectedMember.nickname}</Text>
                      <Text style={styles.memberSheetDescription}>{ROLE_META[selectedMember.role].description}</Text>
                    </View>
                    <View style={[styles.colorPreviewPill, { backgroundColor: getMemberVisualColor(selectedMember) }]} />
                  </View>

                  {memberActionError ? <Text style={styles.errorText}>{memberActionError}</Text> : null}

                  {session?.actor_type === 'parent' ? (
                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setMemberActionError(null);
                          setIsMemberEditOpen(true);
                        }}
                        style={styles.primaryActionButton}>
                        <Text style={styles.primaryActionText}>Изменить</Text>
                      </Pressable>
                      {selectedMember.parent_id === null ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setIsMemberDeleteConfirmOpen(true)}
                          style={styles.dangerOutlineButton}>
                          <Text style={styles.dangerOutlineText}>Убрать</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.noticeText}>Участники по коду могут только просматривать состав семьи.</Text>
                  )}
                </View>
              )
            ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal animationType="fade" transparent visible={joinCode !== null}>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.codeCard}>
            <Text style={styles.modalEyebrow}>Код входа</Text>
            <Text style={styles.codeValue}>{joinCode?.code}</Text>
            <Text style={styles.codeText}>
              Передайте этот код участнику семьи. Новый код автоматически отменяет старый активный код.
            </Text>
            <Text style={styles.codeMeta}>
              Действует до {joinCode ? formatCodeDate(new Date(joinCode.expires_at)) : ''}
            </Text>
            {copyCodeError ? <Text style={styles.errorText}>{copyCodeError}</Text> : null}
            <AppButton
              disabled={!joinCode?.code}
              title={isCodeCopied ? 'Скопировано' : 'Скопировать'}
              variant="accent"
              onPress={handleCopyJoinCode}
            />
            <AppButton title="Понятно" variant="secondary" onPress={closeJoinCodeModal} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function MemberCard({
  canCreateCode,
  isCodeLoading,
  member,
  onCreateCode,
  onPress,
}: {
  canCreateCode: boolean;
  isCodeLoading: boolean;
  member: FamilyMember;
  onCreateCode: () => void;
  onPress: () => void;
}) {
  const meta = ROLE_META[member.role];
  const memberColor = getMemberVisualColor(member);
  const memberSoftColor = member.role === 'parent' ? colors.surface : hexToRgba(memberColor, 0.10);
  const badgeStyle =
    member.role === 'parent'
      ? {
          backgroundColor: PARENT_MEMBER_SOFT_COLOR,
          borderColor: 'rgba(83, 107, 142, 0.22)',
        }
      : {
          backgroundColor: hexToRgba(memberColor, 0.12),
          borderColor: 'rgba(221, 166, 252, 0.22)',
        };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.memberCard,
        { backgroundColor: memberSoftColor },
        pressed && styles.memberCardPressed,
      ]}>
      <View style={[styles.memberStripe, { backgroundColor: memberColor }]} />
      <View style={[styles.memberIcon, { backgroundColor: hexToRgba(memberColor, 0.20) }]}>
        <Text style={[styles.memberIconText, { color: memberColor }]}>
          {member.nickname.slice(0, 1).toUpperCase()}
        </Text>
      </View>

      <View style={styles.memberBody}>
        <Text style={styles.memberName}>{member.nickname}</Text>
        <Text style={styles.memberDescription}>{meta.description}</Text>
      </View>

      <View style={[styles.roleBadge, badgeStyle]}>
        <Text style={[styles.roleText, { color: meta.text }]}>{meta.label}</Text>
      </View>

      {canCreateCode ? (
        <Pressable
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            onCreateCode();
          }}
          style={styles.codeButton}>
          <Text style={styles.codeButtonText}>{isCodeLoading ? '...' : 'Код'}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function QuickStatPill({ label, value, tone }: { label: string; value: number; tone: FamilyMemberRole }) {
  const meta = ROLE_META[tone];

  return (
    <View style={[styles.quickStatPill, { backgroundColor: meta.soft }]}>
      <Text style={[styles.quickStatValue, { color: meta.text }]}>{value}</Text>
      <Text style={[styles.quickStatLabel, { color: meta.text }]}>{label}</Text>
    </View>
  );
}

function RoleChoice({
  role,
  selectedRole,
  onPress,
}: {
  role: FamilyMemberRole;
  selectedRole: FamilyMemberRole;
  onPress: (role: FamilyMemberRole) => void;
}) {
  const meta = ROLE_META[role];
  const isSelected = selectedRole === role;
  const selectedBackground = role === 'parent' ? PARENT_MEMBER_SOFT_COLOR : colors.lavenderSoft;
  const selectedBorder = role === 'parent' ? PARENT_MEMBER_COLOR : colors.lavender;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(role)}
      style={[
        styles.roleChoice,
        {
          backgroundColor: isSelected ? selectedBackground : colors.surface,
          borderColor: isSelected ? selectedBorder : colors.line,
        },
      ]}>
      <View style={[styles.roleChoiceDot, { backgroundColor: isSelected ? selectedBorder : colors.line }]} />
      <Text style={[styles.roleChoiceText, { color: isSelected ? meta.text : colors.muted }]}>{meta.label}</Text>
    </Pressable>
  );
}

function formatReadableDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
}

function formatCodeDate(date: Date): string {
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
  });
}

function getRandomMemberColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 58 + Math.floor(Math.random() * 18);
  const lightness = 74 + Math.floor(Math.random() * 9);

  return hslToHex(hue, saturation, lightness);
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const hueSegment = hue / 60;
  const secondComponent = chroma * (1 - Math.abs((hueSegment % 2) - 1));
  const lightnessMatch = normalizedLightness - chroma / 2;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSegment >= 0 && hueSegment < 1) {
    red = chroma;
    green = secondComponent;
  } else if (hueSegment >= 1 && hueSegment < 2) {
    red = secondComponent;
    green = chroma;
  } else if (hueSegment >= 2 && hueSegment < 3) {
    green = chroma;
    blue = secondComponent;
  } else if (hueSegment >= 3 && hueSegment < 4) {
    green = secondComponent;
    blue = chroma;
  } else if (hueSegment >= 4 && hueSegment < 5) {
    red = secondComponent;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondComponent;
  }

  return `#${toHexChannel(red + lightnessMatch)}${toHexChannel(green + lightnessMatch)}${toHexChannel(
    blue + lightnessMatch,
  )}`;
}

function toHexChannel(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

function getMemberVisualColor(member: FamilyMember): string {
  if (member.role === 'parent') {
    return PARENT_MEMBER_COLOR;
  }

  if (member.color && isHexColor(member.color)) {
    return member.color;
  }

  return colors.lavender;
}

function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function hexToRgba(hex: string, alpha: number): string {
  if (!isHexColor(hex)) {
    return `rgba(221, 166, 252, ${alpha})`;
  }

  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  eyebrow: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 37,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.lavenderSoft,
    borderColor: 'rgba(221, 166, 252, 0.48)',
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: colors.plum,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  noticeCard: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.20)',
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.xs,
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
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.lavenderSoft,
    borderColor: 'rgba(221, 166, 252, 0.38)',
    borderWidth: 1,
    borderRadius: 28,
    flexDirection: 'row',
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.md,
  },
  summaryMonogram: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  summaryMonogramText: {
    color: colors.plum,
    fontSize: typography.xl,
    fontWeight: '900',
  },
  summaryContent: {
    flex: 1,
    gap: 3,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
    lineHeight: 28,
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 20,
  },
  summaryDate: {
    color: colors.plum,
    fontSize: typography.xs,
    fontWeight: '900',
    marginTop: 2,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickStatPill: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    gap: spacing.xs,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  quickStatValue: {
    fontSize: typography.md,
    fontWeight: '900',
    lineHeight: 18,
  },
  quickStatLabel: {
    fontSize: typography.xs,
    fontWeight: '900',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
  },
  sectionHint: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  addMemberTopButton: {
    alignItems: 'center',
    backgroundColor: colors.lemon,
    borderColor: 'rgba(127, 135, 109, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  addMemberTopButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  addMemberTopButtonText: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  membersGrid: {
    gap: spacing.sm,
  },
  memberCard: {
    alignItems: 'center',
    borderColor: 'rgba(150, 167, 168, 0.18)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 74,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  memberCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  memberStripe: {
    alignSelf: 'stretch',
    borderRadius: 999,
    width: 5,
  },
  addMemberCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.24)',
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 74,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  addFamilyCard: {
    backgroundColor: colors.mintSoft,
    borderColor: colors.mint,
    borderWidth: 1,
    borderRadius: 30,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  addFamilyKicker: {
    color: colors.sage,
    fontSize: typography.sm,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  addFamilyTitle: {
    color: colors.text,
    fontSize: typography.xxl,
    fontWeight: '900',
  },
  addFamilyText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  addMemberIcon: {
    alignItems: 'center',
    backgroundColor: colors.lavenderSoft,
    borderRadius: 17,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  addMemberIconText: {
    color: colors.plum,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 32,
  },
  memberIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  memberIconText: {
    color: colors.plum,
    fontSize: typography.md,
    fontWeight: '900',
  },
  memberBody: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '900',
  },
  memberDescription: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  roleBadge: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  roleText: {
    fontSize: typography.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  codeButton: {
    backgroundColor: colors.surface,
    borderColor: colors.lavender,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  codeButtonText: {
    color: colors.plum,
    fontSize: typography.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalOverlay: {
    backgroundColor: 'rgba(45, 42, 59, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalOverlayCenter: {
    alignItems: 'center',
    backgroundColor: 'rgba(45, 42, 59, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    gap: spacing.lg,
    maxHeight: '92%',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalEyebrow: {
    color: colors.brandDark,
    fontSize: typography.sm,
    fontWeight: '900',
    textTransform: 'uppercase',
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
  codeCard: {
    backgroundColor: colors.background,
    borderRadius: 32,
    gap: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
  codeValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
  },
  codeText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  codeMeta: {
    color: colors.brandDark,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  confirmText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 21,
  },
  memberSheetHero: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: 'rgba(150, 167, 168, 0.18)',
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  memberSheetAvatar: {
    alignItems: 'center',
    borderRadius: 20,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  memberSheetAvatarText: {
    fontSize: typography.xl,
    fontWeight: '900',
  },
  memberSheetName: {
    color: colors.text,
    fontSize: typography.xl,
    fontWeight: '900',
    lineHeight: 27,
  },
  memberSheetDescription: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  colorPreviewPill: {
    borderColor: 'rgba(41, 37, 54, 0.10)',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    width: 34,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryActionButton: {
    alignItems: 'center',
    backgroundColor: colors.lavender,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryActionText: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  secondaryActionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryActionText: {
    color: colors.brandDark,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  dangerActionButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  dangerActionText: {
    color: colors.surface,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  dangerOutlineButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(160, 79, 97, 0.35)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  dangerOutlineText: {
    color: colors.danger,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  disabledActionButton: {
    opacity: 0.58,
  },
  emptyFamilyAction: {
    borderRadius: 26,
  },
  emptyFamilyActionPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  form: {
    gap: spacing.md,
  },
  modalFormContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  choiceBlock: {
    gap: spacing.xs,
  },
  choiceLabel: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  colorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorValuePill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  colorValueDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  colorValueText: {
    color: colors.muted,
    fontSize: typography.xs,
    fontWeight: '900',
  },
  colorPickerCard: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(150, 167, 168, 0.20)',
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.md,
  },
  colorPickerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  colorWheel: {
    borderRadius: 999,
    height: 176,
    width: 176,
  },
  colorThumb: {
    shadowColor: colors.text,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  colorPreview: {
    borderRadius: 18,
    height: 56,
    width: 56,
  },
  colorBrightnessSlider: {
    borderRadius: 999,
    height: 18,
    marginTop: spacing.md,
    width: '100%',
  },
  roleChoice: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roleChoiceDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  roleChoiceText: {
    fontSize: typography.sm,
    fontWeight: '900',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 20,
  },
});
