import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import { PERIODS } from '../../constants/ranking';
import { rgbaFromHex } from '../../utils/privateGroupTheme';
import { usePrivateGroupTheme } from '../../store/privateGroupTheme-context';

export default function PeriodChips({ activePeriod, onSelectPeriod }) {
  const { t } = useTranslation();
  const theme = usePrivateGroupTheme();

  const activeBackground = theme ? theme.primaryColor : GlobalStyle.color.primaryColor;
  const activeBorder = theme ? theme.secondaryColor : GlobalStyle.color.secondaryColor;
  const inactiveBorder = theme ? theme.hairlineStrong : rgbaFromHex(GlobalStyle.color.secondaryColor, 0.5);
  const chipTextColor = theme ? theme.text : GlobalStyle.color.onSurface;

  return (
    <View style={styles.row}>
      {PERIODS.map((period) => {
        const isActive = period === activePeriod;
        return (
          <Pressable
            key={period}
            testID={`ranking.screen.period.${period}`}
            onPress={() => onSelectPeriod(period)}
            style={[
              styles.chip,
              { borderColor: isActive ? activeBorder : inactiveBorder },
              isActive && { backgroundColor: activeBackground },
            ]}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.chipText, { color: chipTextColor }, isActive && styles.chipTextActive]}>
              {t(`ui.ranking.period.${period}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  chipText: {
    fontWeight: '600',
    fontSize: 12,
  },
  chipTextActive: {
    fontWeight: '800',
  },
});
