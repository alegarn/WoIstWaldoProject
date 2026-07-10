import { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';

import ColorPalettePicker from '../../UI/ColorPalettePicker';
import SettingsSection from './SettingsSection';
import { getSettingsTokens, settingsTokens } from './settingsTokens';
import { GlobalStyle } from '../../../constants/theme';
import { AuthContext } from '../../../store/auth-context';
import { updateGroupSettings } from '../../../services/groups/groupApi';

/**
 * Group identity editor — name + primary/secondary colors + save.
 *
 * Single Responsibility: editing the group's identity fields and persisting
 * them. Owns its own draft + saving state; receives the initial values and an
 * onRefresh callback to re-sync the group hub after a successful save.
 */
export default function GroupIdentitySection({
  groupId,
  initialName,
  initialPrimaryColor,
  initialSecondaryColor,
  onRefresh,
  onSaved,
  testIDPrefix = 'group-settings',
  appearance = 'dark',
}) {
  const authContext = useContext(AuthContext);
  const [name, setName] = useState(initialName ?? '');
  const [selectedPrimaryColor, setSelectedPrimaryColor] = useState(initialPrimaryColor ?? GlobalStyle.color.primaryColor);
  const [selectedSecondaryColor, setSelectedSecondaryColor] = useState(initialSecondaryColor ?? GlobalStyle.color.secondaryColor);
  const [isSaving, setIsSaving] = useState(false);
  const t = getSettingsTokens({
    appearance,
    primaryColor: selectedPrimaryColor,
    secondaryColor: selectedSecondaryColor,
  });
  const pickerThemeColors = {
    label: t.text,
    expandedBorder: t.hairlineStrong,
    shadeGrid: t.accentWash,
    selectedBorder: t.text,
  };

  // Re-sync from upstream when the group is refreshed after a save.
  useEffect(() => {
    setName(initialName ?? '');
    setSelectedPrimaryColor(initialPrimaryColor ?? GlobalStyle.color.primaryColor);
    setSelectedSecondaryColor(initialSecondaryColor ?? GlobalStyle.color.secondaryColor);
  }, [initialName, initialPrimaryColor, initialSecondaryColor]);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await updateGroupSettings(authContext, groupId, {
        name: name.trim(),
        primaryColor: selectedPrimaryColor,
        secondaryColor: selectedSecondaryColor,
      });
      if (response?.status === 200 || response?.status === 204) {
        Alert.alert('Saved', 'Group settings updated.');
        onRefresh?.();
        onSaved?.();
      } else {
        Alert.alert(`Error ${response?.status ?? ''}`, 'Could not save settings.');
      }
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const label = isSaving ? 'Saving…' : 'Save changes';

  return (
    <SettingsSection
      appearance={appearance}
      primaryColor={selectedPrimaryColor}
      secondaryColor={selectedSecondaryColor}
      testID={`${testIDPrefix}.section.identity`}
      title="Group identity"
      caption="Name and colors shown across the group."
    >
      <Text style={[styles.fieldLabel, { color: t.muted }]}>Name</Text>
      <TextInput
        accessibilityLabel="Group name"
        value={name}
        onChangeText={setName}
        style={[
          styles.input,
          {
            color: t.text,
            backgroundColor: t.inputSurface,
            borderColor: t.hairlineInput,
          },
        ]}
        testID={`${testIDPrefix}.input.name`}
        placeholder="Group name"
        placeholderTextColor={t.mutedSoft}
      />
      <ColorPalettePicker
        appearance={appearance}
        label="Primary color"
        value={selectedPrimaryColor}
        onValueChange={setSelectedPrimaryColor}
        themeColors={pickerThemeColors}
        testIDPrefix={`${testIDPrefix}.color-primary`}
      />
      <ColorPalettePicker
        appearance={appearance}
        label="Secondary color"
        value={selectedSecondaryColor}
        onValueChange={setSelectedSecondaryColor}
        themeColors={pickerThemeColors}
        testIDPrefix={`${testIDPrefix}.color-secondary`}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={saveSettings}
        disabled={isSaving}
        testID={`${testIDPrefix}.button.save-colors`}
        style={({ pressed }) => [
          styles.saveAction,
          { backgroundColor: t.accent },
          pressed && styles.pressed,
          isSaving && styles.saveActionBusy,
        ]}
      >
        <Ionicons name="save-outline" size={17} color={t.accentText} />
        <Text style={[styles.saveActionText, { color: t.accentText }]}>{label}</Text>
      </Pressable>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: settingsTokens.radiusInput,
    borderWidth: 1,
  },
  saveAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
  },
  saveActionBusy: { opacity: 0.6 },
  saveActionText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
