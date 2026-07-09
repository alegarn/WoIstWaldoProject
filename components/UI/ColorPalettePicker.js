import { useMemo, useState } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';

import { generateShades } from '../../utils/colorShades';

/**
 * Curated base colors. Exported so callers/tests reference exact hexes.
 *
 * Open/Closed: pass a custom `palette` prop (list of {name, hex} bases) to
 * extend or replace without editing this component.
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

const SHADE_COUNT = 10;

const appearanceThemes = {
  dark: {
    label: '#fff',
    expandedBorder: 'rgba(255,255,255,0.5)',
    shadeGrid: 'rgba(0,0,0,0.25)',
    selectedBorder: '#fff',
  },
  light: {
    label: '#1D133D',
    expandedBorder: 'rgba(101,40,247,0.35)',
    shadeGrid: 'rgba(101,40,247,0.08)',
    selectedBorder: '#1D133D',
  },
};

function noHash(hex) {
  return hex.replace('#', '');
}

/**
 * Single Responsibility: render base swatches + their derivatives, report the
 * picked hex. Knows nothing about groups, persistence, or screens.
 *
 * UX: tapping a BASE swatch expands that base's derivative row (10 shades,
 * including the base itself). Tapping a SHADE calls onValueChange(hex).
 *
 * Props:
 * - label: optional heading text.
 * - value: currently selected hex string (e.g. "#6528F7").
 * - onValueChange: called with the picked hex when a shade is tapped.
 * - palette: bases [{ name, hex }]; defaults to DEFAULT_COLOR_PALETTE.
 * - testIDPrefix: bases -> `${prefix}.swatch.${hexNoHash}`;
 *                 shades -> `${prefix}.shade.${baseHexNoHash}.${shadeHexNoHash}`.
 * - accessibilityLabel: optional, applied to the base grid.
 */
export default function ColorPalettePicker({
  label,
  value,
  onValueChange,
  palette = DEFAULT_COLOR_PALETTE,
  testIDPrefix = 'color-palette-picker',
  accessibilityLabel,
  appearance = 'dark',
  themeColors,
}) {
  const theme = {
    ...(appearanceThemes[appearance] ?? appearanceThemes.dark),
    ...(themeColors ?? {}),
  };
  const normalizedValue = typeof value === 'string' ? value.toUpperCase() : value;

  // base -> shades. Memoized so it stays stable across renders for a given palette.
  const basesWithShades = useMemo(
    () =>
      palette.map((base) => ({
        name: base.name,
        hex: base.hex.toUpperCase(),
        shades: generateShades(base.hex, SHADE_COUNT),
      })),
    [palette],
  );

  // Auto-expand the base whose family contains the current value, so the user
  // sees their selection's shades on first render.
  const initialBaseHex = useMemo(() => {
    if (!normalizedValue) return null;
    const match = basesWithShades.find(
      (b) => b.hex === normalizedValue || b.shades.includes(normalizedValue),
    );
    return match ? match.hex : null;
  }, [basesWithShades, normalizedValue]);

  const [expandedBaseHex, setExpandedBaseHex] = useState(initialBaseHex);
  const expanded = basesWithShades.find((b) => b.hex === expandedBaseHex) || null;

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: theme.label }]}>{label}</Text> : null}
      <View style={styles.grid} accessibilityLabel={accessibilityLabel}>
        {basesWithShades.map((base) => {
          const selected = base.shades.includes(normalizedValue);
          const isExpanded = base.hex === expandedBaseHex;
          return (
            <Pressable
              key={base.hex}
              testID={`${testIDPrefix}.swatch.${noHash(base.hex)}`}
              accessibilityLabel={base.name}
              accessibilityRole="button"
              accessibilityState={{ selected, expanded: isExpanded }}
              onPress={() => setExpandedBaseHex(base.hex)}
              style={[
                styles.swatch,
                { backgroundColor: base.hex },
                selected && styles.selected,
                isExpanded && [styles.expandedBase, { borderColor: theme.expandedBorder }],
              ]}
            />
          );
        })}
      </View>

      {expanded && (
        <View
          style={[styles.shadeGrid, { backgroundColor: theme.shadeGrid }]}
          testID={`${testIDPrefix}.shades.${noHash(expanded.hex)}`}
        >
          {expanded.shades.map((shadeHex) => {
            const selected = shadeHex === normalizedValue;
            return (
              <Pressable
                key={shadeHex}
                testID={`${testIDPrefix}.shade.${noHash(expanded.hex)}.${noHash(shadeHex)}`}
                accessibilityLabel={`${expanded.name} shade`}
                accessibilityRole="button"
                accessibilityState={selected ? { selected: true } : undefined}
                onPress={() => onValueChange?.(shadeHex)}
                style={[
                  styles.shade,
                  { backgroundColor: shadeHex },
                  selected && [styles.selected, { borderColor: theme.selectedBorder }],
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  label: { fontSize: 16, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 8 },
  expandedBase: { borderWidth: 2 },
  shadeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
  },
  shade: { width: 32, height: 32, borderRadius: 6 },
  selected: { borderWidth: 3 },
});
