import { View, Text, TextInput, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';

import SettingsSection from './SettingsSection';
import { getSettingsTokens, settingsTokens } from './settingsTokens';
import { useGroupCategories } from '../../../hooks/useGroupCategories';

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
}) {
  const t = getSettingsTokens({ appearance, primaryColor, secondaryColor });
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
  } = useGroupCategories({ groupId, onRefresh });

  return (
    <SettingsSection
      appearance={appearance}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      testID="group-settings.category.editor"
      title="Categories"
      caption="Players use these to sort hides and guesses."
      count={categories.length}
    >
      <View
        style={[styles.addComposer, { backgroundColor: t.inset, borderColor: t.hairlineInput }]}
        testID="group-settings.category.add-composer"
      >
        <View style={[styles.addGlyph, { backgroundColor: t.accent }]}> 
          <Ionicons name="add" size={18} color={t.text} />
        </View>
        <TextInput
          accessibilityLabel="New category name"
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder="New category name"
          placeholderTextColor={t.mutedSoft}
          style={[styles.addInput, { color: t.text }]}
          testID="group-settings.category.add-input"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add category"
          onPress={add}
          testID="group-settings.category.add"
          style={({ pressed }) => [
            styles.addChip,
            { backgroundColor: t.accent },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add-circle-outline" size={16} color={t.text} />
          <Text style={[styles.addChipText, { color: t.accentText }]}>Add</Text>
        </Pressable>
      </View>

      {loading && <Text style={[styles.muted, { color: t.muted }]}>Loading categories…</Text>}

      {error && (
        <View style={styles.errorRow}>
          <Text style={[styles.errorText, { color: t.warn }]}>Couldn&apos;t load categories.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading categories again"
            onPress={reload}
            testID="group-settings.category.retry"
            style={({ pressed }) => [
              styles.retryChip,
              { borderColor: t.hairlineStrong },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.retryChipText, { color: t.accentSoft }]}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && categories.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="pricetags-outline" size={28} color={t.mutedSoft} />
          <Text style={[styles.emptyTitle, { color: t.text }]}>No categories yet</Text>
          <Text style={[styles.emptyHint, { color: t.muted }]}>Add your first category above.</Text>
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
              style={[styles.categoryCard, { backgroundColor: t.inset, borderColor: t.hairline }]}
              testID={`group-settings.category.row.${item.id}`}
            >
              <View style={styles.categoryTop}>
                {thumbUri ? (
                  <Image source={{ uri: thumbUri }} style={[styles.thumb, { backgroundColor: t.insetDeep }]} />
                ) : (
                  <View
                    style={[
                      styles.thumb,
                      styles.thumbFallback,
                      {
                        backgroundColor: t.accentWash,
                        borderColor: t.hairlineStrong,
                      },
                    ]}
                  >
                    <Text style={[styles.thumbInitial, { color: t.accentSoft }]}>{initial}</Text>
                  </View>
                )}
                <TextInput
                  accessibilityLabel={`Category ${item.name}`}
                  value={draft}
                  onChangeText={(value) => setDraft(item.id, value)}
                  style={[
                    styles.categoryNameInput,
                    {
                      color: t.text,
                      backgroundColor: t.inputSurface,
                    },
                  ]}
                  testID={`group-settings.category.row.${item.id}.name`}
                  placeholder="Untitled category"
                  placeholderTextColor={t.mutedSoft}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                  onPress={() => remove(item)}
                  testID={`group-settings.category.row.${item.id}.delete`}
                  style={({ pressed }) => [
                    styles.iconButton,
                    { backgroundColor: t.dangerSoft },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color={t.danger} />
                </Pressable>
              </View>

              <View style={[styles.categoryDivider, { backgroundColor: t.hairline }]} />

              <View style={styles.categoryActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rename ${item.name}`}
                  onPress={() => save(item)}
                  testID={`group-settings.category.row.${item.id}.save`}
                  disabled={!isDirty}
                  style={({ pressed }) => [
                    styles.actionChip,
                    {
                      borderColor: t.hairlineStrong,
                      backgroundColor: t.accentWash,
                    },
                    pressed && styles.pressed,
                    !isDirty && styles.actionChipDisabled,
                  ]}
                >
                  <Ionicons name="create-outline" size={15} color={t.text} />
                  <Text style={[styles.actionChipText, { color: t.text }]}>Rename</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change ${item.name} thumbnail`}
                  onPress={() => swapThumbnail(item)}
                  testID="group-settings.uploader.category-thumbnail"
                  disabled={isSwappingThumbnail}
                  style={({ pressed }) => [
                    styles.actionChip,
                    {
                      borderColor: t.hairlineStrong,
                      backgroundColor: t.accentWash,
                    },
                    pressed && styles.pressed,
                    isSwappingThumbnail && styles.actionChipDisabled,
                  ]}
                >
                  <Ionicons name="image-outline" size={15} color={t.text} />
                  <Text style={[styles.actionChipText, { color: t.text }]}>
                    {isSwappingThumbnail ? 'Uploading…' : 'Thumbnail'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },

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
