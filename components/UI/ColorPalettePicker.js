import { Pressable, View, Text, StyleSheet } from 'react-native';

/**
 * Curated default swatches. Exported so callers/tests can reference the
 * exact hex values instead of hardcoding duplicates.
 *
 * Open/Closed: pass a custom `palette` prop to extend or replace without
 * editing this component.
 */
export const DEFAULT_COLOR_PALETTE = [
  { name: 'Purple', hex: '#6528F7' },
  { name: 'Light Purple', hex: '#A076F9' },
  { name: 'Indigo', hex: '#4A55A2' },
  { name: 'Blue', hex: '#7895CB' },
  { name: 'Teal', hex: '#198868' },
  { name: 'Green', hex: '#4BB543' },
  { name: 'Lime', hex: '#A0E548' },
  { name: 'Yellow', hex: '#FFCC00' },
  { name: 'Orange', hex: '#F37C13' },
  { name: 'Red', hex: '#E03A3A' },
  { name: 'Pink', hex: '#FF6FB5' },
  { name: 'Slate', hex: '#3D4358' },
];

/**
 * Single Responsibility: render labelled swatches and report the picked hex.
 * Knows nothing about groups, persistence, or screens.
 *
 * Props:
 * - label: optional heading text above the grid.
 * - value: currently selected hex string (e.g. "#6528F7").
 * - onValueChange: called with the picked hex when a swatch is tapped.
 * - palette: swatches [{ name, hex }]; defaults to DEFAULT_COLOR_PALETTE.
 * - testIDPrefix: swatches get testID `${testIDPrefix}.swatch.${hexWithoutHash}`.
 * - accessibilityLabel: optional, applied to the grid container.
 */
export default function ColorPalettePicker({
  label,
  value,
  onValueChange,
  palette = DEFAULT_COLOR_PALETTE,
  testIDPrefix = 'color-palette-picker',
  accessibilityLabel,
}) {
  const normalizedValue = typeof value === 'string' ? value.toLowerCase() : value;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.grid} accessibilityLabel={accessibilityLabel}>
        {palette.map((swatch) => {
          const selected = normalizedValue === swatch.hex.toLowerCase();
          return (
            <Pressable
              key={swatch.hex}
              testID={`${testIDPrefix}.swatch.${swatch.hex.replace('#', '')}`}
              accessibilityLabel={swatch.name}
              accessibilityRole="button"
              accessibilityState={selected ? { selected: true } : undefined}
              onPress={() => onValueChange?.(swatch.hex)}
              style={[
                styles.swatch,
                { backgroundColor: swatch.hex },
                selected && styles.selected,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  label: { color: '#fff', fontSize: 16, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 8 },
  selected: { borderWidth: 3, borderColor: '#fff' },
});
