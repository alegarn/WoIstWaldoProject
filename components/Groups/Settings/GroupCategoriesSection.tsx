import { View, Text, TextInput, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';

import _SettingsSection from './SettingsSection';
import { getSettingsTokens as _getSettingsTokens, settingsTokens } from './settingsTokens';
import { useGroupCategories } from '../../../hooks/useGroupCategories';

// SettingsSection.js is unmigrated; its destructured props (headerRight) are
// inferred as required by TS. settingsTokens.js infers `options = 'dark'` as a
// string parameter. Permissive casts mirror the App.tsx convention.
const SettingsSection = _SettingsSection as React.ComponentType<any>;
const getSettingsTokens = _getSettingsTokens as (options?: unknown) => any;

type GroupCategoriesSectionProps = {
  groupId: string;
  onRefresh?: () => void | Promise<void>;
  appearance?: 'dark' | 'light';
  primaryColor?: string;
  secondaryColor?: string;
  canPersonalize?: boolean;
  onUpsell?: () => void;
};

/**
 * Categories panel — add, rename, re-thumbnail, remove.
 *
 * Single Responsibility: the view over categories. All data logic lives in
 * useGroupCategories; this component only renders state and forwards intents.
 */
export default function GroupCategoriesSection({
  groupId,
  onRefresh,
  appearance = 'dark',
  primaryColor,
  secondaryColor,
  canPersonalize = true,
  onUpsell,
}: GroupCategoriesSectionProps) {
  const { t } = useTranslation();
  const tokens = getSettingsTokens({ appearance, primaryColor, secondaryColor });
  const {
    categories,
    drafts,
    setDraft,
    thumbnailUris,
    loading,
    error,
    newCategoryName,
    setNewCategoryName,
    isSwappingThumbnail,
    add,
    save,
    remove,
    swapThumbnail,
    reload,
  } = useGroupCategories({ groupId, onRefresh, onUpsell });

  return (
    <SettingsSection
      appearance={appearance}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      testID="group-settings.category.editor"
      title={t('groups.settings.categoriesTitle')}
      caption={t('groups.settings.categoriesCaption')}
      count={categories.length}
    >
      {!canPersonalize && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('groups.settings.personalizationLocked')}
          onPress={onUpsell}
          testID="group-settings.category.locked"
          style={({ pressed }) => [
            styles.lockedRow,
            { backgroundColor: tokens.inset, borderColor: tokens.hairline },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.lockedGlyph, { backgroundColor: tokens.accentWash }]}>
            <Ionicons name="lock-closed-outline" size={16} color={tokens.accentSoft} />
          </View>
          <Text style={[styles.lockedText, { color: tokens.text }]}>
            {t('groups.settings.personalizationLocked')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={tokens.muted} />
        </Pressable>
      )}

      {canPersonalize && (
      <View
        style={[styles.addComposer, { backgroundColor: tokens.inset, borderColor: tokens.hairlineInput }]}
        testID="group-settings.category.add-composer"
      >
        <View style={[styles.addGlyph, { backgroundColor: tokens.accent }]}>
          <Ionicons name="add" size={18} color={tokens.text} />
        </View>
        <TextInput
          accessibilityLabel={t('groups.settings.newCategoryLabel')}
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder={t('groups.settings.newCategoryLabel')}
          placeholderTextColor={tokens.mutedSoft}
          style={[styles.addInput, { color: tokens.text }]}
          testID="group-settings.category.add-input"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('groups.settings.addCategory')}
          onPress={add}
          testID="group-settings.category.add"
          style={({ pressed }) => [
            styles.addChip,
            { backgroundColor: tokens.accent },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add-circle-outline" size={16} color={tokens.text} />
          <Text style={[styles.addChipText, { color: tokens.accentText }]}>{t('groups.settings.add')}</Text>
        </Pressable>
      </View>
      )}

      {loading && <Text style={[styles.muted, { color: tokens.muted }]}>{t('groups.settings.loadingCategories')}</Text>}

      {error && (
        <View style={styles.errorRow}>
          <Text style={[styles.errorText, { color: tokens.warn }]}>{t('groups.settings.categoriesLoadFailed')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('groups.settings.retryCategoriesLabel')}
            onPress={reload}
            testID="group-settings.category.retry"
            style={({ pressed }) => [
              styles.retryChip,
              { borderColor: tokens.hairlineStrong },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.retryChipText, { color: tokens.accentSoft }]}>{t('groups.settings.tryAgain')}</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && categories.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="pricetags-outline" size={28} color={tokens.mutedSoft} />
          <Text style={[styles.emptyTitle, { color: tokens.text }]}>{t('groups.settings.noCategories')}</Text>
          <Text style={[styles.emptyHint, { color: tokens.muted }]}>{t('groups.settings.noCategoriesHint')}</Text>
        </View>
      )}

      <View style={styles.categoryList}>
        {categories.map((item) => {
          const draft = drafts[item.id] ?? item.name ?? '';
          const savedName = (item.name ?? '').trim();
          const isDirty = draft.trim().length > 0 && draft.trim() !== savedName;
          const thumbUri = thumbnailUris[item.id];
          const initial = (draft.trim()[0] ?? savedName[0] ?? '?').toUpperCase();
          return (
            <View
              key={item.id}
              style={[styles.categoryCard, { backgroundColor: tokens.inset, borderColor: tokens.hairline }]}
              testID={`group-settings.category.row.${item.id}`}
            >
              <View style={styles.categoryTop}>
                {thumbUri ? (
                  <Image source={{ uri: thumbUri }} style={[styles.thumb, { backgroundColor: tokens.insetDeep }]} />
                ) : (
                  <View
                    style={[
                      styles.thumb,
                      styles.thumbFallback,
                      {
                        backgroundColor: tokens.accentWash,
                        borderColor: tokens.hairlineStrong,
                      },
                    ]}
                  >
                    <Text style={[styles.thumbInitial, { color: tokens.accentSoft }]}>{initial}</Text>
                  </View>
                )}
                {canPersonalize ? (
                  <>
                    <TextInput
                      accessibilityLabel={t('groups.settings.categoryLabel', { name: item.name })}
                      value={draft}
                      onChangeText={(value) => setDraft(item.id, value)}
                      style={[
                        styles.categoryNameInput,
                        {
                          color: tokens.text,
                          backgroundColor: tokens.inputSurface,
                        },
                      ]}
                      testID={`group-settings.category.row.${item.id}.name`}
                      placeholder={t('groups.settings.untitled')}
                      placeholderTextColor={tokens.mutedSoft}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('groups.settings.deleteCategoryLabel', { name: item.name })}
                      onPress={() => remove(item)}
                      testID={`group-settings.category.row.${item.id}.delete`}
                      style={({ pressed }) => [
                        styles.iconButton,
                        { backgroundColor: tokens.dangerSoft },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons name="trash-outline" size={18} color={tokens.danger} />
                    </Pressable>
                  </>
                ) : (
                  <Text
                    style={[styles.categoryName, { color: tokens.text }]}
                    testID={`group-settings.category.row.${item.id}.name`}
                  >
                    {draft.trim() || savedName || t('groups.settings.untitled')}
                  </Text>
                )}
              </View>

              {canPersonalize && (
              <>
              <View style={[styles.categoryDivider, { backgroundColor: tokens.hairline }]} />

              <View style={styles.categoryActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('groups.settings.renameLabel', { name: item.name })}
                  onPress={() => save(item)}
                  testID={`group-settings.category.row.${item.id}.save`}
                  disabled={!isDirty}
                  style={({ pressed }) => [
                    styles.actionChip,
                    {
                      borderColor: tokens.hairlineStrong,
                      backgroundColor: tokens.accentWash,
                    },
                    pressed && styles.pressed,
                    !isDirty && styles.actionChipDisabled,
                  ]}
                >
                  <Ionicons name="create-outline" size={15} color={tokens.text} />
                  <Text style={[styles.actionChipText, { color: tokens.text }]}>{t('groups.settings.rename')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('groups.settings.changeThumbnailLabel', { name: item.name })}
                  onPress={() => swapThumbnail(item)}
                  testID="group-settings.uploader.category-thumbnail"
                  disabled={isSwappingThumbnail}
                  style={({ pressed }) => [
                    styles.actionChip,
                    {
                      borderColor: tokens.hairlineStrong,
                      backgroundColor: tokens.accentWash,
                    },
                    pressed && styles.pressed,
                    isSwappingThumbnail && styles.actionChipDisabled,
                  ]}
                >
                  <Ionicons name="image-outline" size={15} color={tokens.text} />
                  <Text style={[styles.actionChipText, { color: tokens.text }]}>
                    {isSwappingThumbnail ? t('groups.settings.uploading') : t('groups.settings.thumbnail')}
                  </Text>
                </Pressable>
              </View>
              </>
              )}
            </View>
          );
        })}
      </View>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },

  lockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 12,
    borderWidth: 1,
  },
  lockedGlyph: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  lockedText: { flex: 1, fontSize: 14, fontWeight: '600' },

  addComposer: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1,
  },
  addGlyph: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  addInput: { flex: 1, fontSize: 15, paddingVertical: 6, paddingHorizontal: 4 },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  addChipText: { fontSize: 14, fontWeight: '700' },

  muted: { fontSize: 14, marginTop: 8 },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, gap: 8,
  },
  errorText: { fontSize: 13, flexShrink: 1 },
  retryChip: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  retryChipText: { fontSize: 13, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyHint: { fontSize: 13 },

  categoryList: { marginTop: 8, gap: 10 },
  categoryCard: {
    borderRadius: settingsTokens.radiusCard, padding: 10,
    borderWidth: 1,
  },
  categoryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  thumbFallback: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  thumbInitial: { fontSize: 18, fontWeight: '700' },
  categoryNameInput: {
    flex: 1, fontSize: 16, fontWeight: '600',
    paddingVertical: 6, paddingHorizontal: 8, borderRadius: settingsTokens.radiusInput,
  },
  categoryName: { flex: 1, fontSize: 16, fontWeight: '600' },
  iconButton: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  categoryDivider: { height: 1, marginVertical: 10 },
  categoryActions: { flexDirection: 'row', gap: 8 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  actionChipDisabled: { opacity: 0.4 },
  actionChipText: { fontSize: 13, fontWeight: '600' },
});
