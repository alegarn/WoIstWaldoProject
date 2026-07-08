import { View, Text, TextInput, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';

import SettingsSection from './SettingsSection';
import { settingsTokens as t } from './settingsTokens';
import { useGroupCategories } from '../../../hooks/useGroupCategories';

/**
 * Categories panel — add, rename, re-thumbnail, remove.
 *
 * Single Responsibility: the view over categories. All data logic lives in
 * useGroupCategories; this component only renders state and forwards intents.
 */
export default function GroupCategoriesSection({ groupId, onRefresh }) {
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
      testID="group-settings.category.editor"
      title="Categories"
      caption="Players use these to sort hides and guesses."
      count={categories.length}
    >
      <View style={styles.addComposer} testID="group-settings.category.add-composer">
        <View style={styles.addGlyph}>
          <Ionicons name="add" size={18} color={t.text} />
        </View>
        <TextInput
          accessibilityLabel="New category name"
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder="New category name"
          placeholderTextColor={t.mutedSoft}
          style={styles.addInput}
          testID="group-settings.category.add-input"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add category"
          onPress={add}
          testID="group-settings.category.add"
          style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}
        >
          <Ionicons name="add-circle-outline" size={16} color={t.text} />
          <Text style={styles.addChipText}>Add</Text>
        </Pressable>
      </View>

      {loading && <Text style={styles.muted}>Loading categories…</Text>}

      {error && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>Couldn&apos;t load categories.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading categories again"
            onPress={reload}
            testID="group-settings.category.retry"
            style={({ pressed }) => [styles.retryChip, pressed && styles.pressed]}
          >
            <Text style={styles.retryChipText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && categories.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="pricetags-outline" size={28} color={t.mutedSoft} />
          <Text style={styles.emptyTitle}>No categories yet</Text>
          <Text style={styles.emptyHint}>Add your first category above.</Text>
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
            <View key={item.id} style={styles.categoryCard} testID={`group-settings.category.row.${item.id}`}>
              <View style={styles.categoryTop}>
                {thumbUri ? (
                  <Image source={{ uri: thumbUri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Text style={styles.thumbInitial}>{initial}</Text>
                  </View>
                )}
                <TextInput
                  accessibilityLabel={`Category ${item.name}`}
                  value={draft}
                  onChangeText={(value) => setDraft(item.id, value)}
                  style={styles.categoryNameInput}
                  testID={`group-settings.category.row.${item.id}.name`}
                  placeholder="Untitled category"
                  placeholderTextColor={t.mutedSoft}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                  onPress={() => remove(item)}
                  testID={`group-settings.category.row.${item.id}.delete`}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={18} color={t.danger} />
                </Pressable>
              </View>

              <View style={styles.categoryDivider} />

              <View style={styles.categoryActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rename ${item.name}`}
                  onPress={() => save(item)}
                  testID={`group-settings.category.row.${item.id}.save`}
                  disabled={!isDirty}
                  style={({ pressed }) => [
                    styles.actionChip,
                    pressed && styles.pressed,
                    !isDirty && styles.actionChipDisabled,
                  ]}
                >
                  <Ionicons name="create-outline" size={15} color={t.text} />
                  <Text style={styles.actionChipText}>Rename</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change ${item.name} thumbnail`}
                  onPress={() => swapThumbnail(item)}
                  testID="group-settings.uploader.category-thumbnail"
                  disabled={isSwappingThumbnail}
                  style={({ pressed }) => [
                    styles.actionChip,
                    pressed && styles.pressed,
                    isSwappingThumbnail && styles.actionChipDisabled,
                  ]}
                >
                  <Ionicons name="image-outline" size={15} color={t.text} />
                  <Text style={styles.actionChipText}>
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
    backgroundColor: t.inset, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: t.hairlineInput,
  },
  addGlyph: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: t.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  addInput: { flex: 1, color: t.text, fontSize: 15, paddingVertical: 6, paddingHorizontal: 4 },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.accent, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  addChipText: { color: t.text, fontSize: 14, fontWeight: '700' },

  muted: { color: '#bbb', fontSize: 14, marginTop: 8 },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, gap: 8,
  },
  errorText: { color: t.warn, fontSize: 13, flexShrink: 1 },
  retryChip: {
    borderWidth: 1, borderColor: t.hairlineStrong, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  retryChipText: { color: t.accentSoft, fontSize: 13, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyTitle: { color: t.text, fontSize: 15, fontWeight: '600' },
  emptyHint: { color: t.muted, fontSize: 13 },

  categoryList: { marginTop: 8, gap: 10 },
  categoryCard: {
    backgroundColor: t.inset, borderRadius: t.radiusCard, padding: 10,
    borderWidth: 1, borderColor: t.hairline,
  },
  categoryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: t.insetDeep },
  thumbFallback: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(160,118,249,0.18)',
    borderWidth: 1, borderColor: t.hairlineStrong,
  },
  thumbInitial: { color: t.accentSoft, fontSize: 18, fontWeight: '700' },
  categoryNameInput: {
    flex: 1, color: t.text, fontSize: 16, fontWeight: '600',
    paddingVertical: 6, paddingHorizontal: 8, borderRadius: t.radiusInput,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  iconButton: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.dangerSoft,
  },
  categoryDivider: { height: 1, backgroundColor: t.hairline, marginVertical: 10 },
  categoryActions: { flexDirection: 'row', gap: 8 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: t.hairlineStrong, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(101,40,247,0.12)',
  },
  actionChipDisabled: { opacity: 0.4 },
  actionChipText: { color: t.text, fontSize: 13, fontWeight: '600' },
});
