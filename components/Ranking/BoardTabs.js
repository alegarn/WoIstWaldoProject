import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from '../../constants/theme';
import { BOARDS } from '../../constants/ranking';
import { rgbaFromHex } from '../../utils/privateGroupTheme';
import { usePrivateGroupTheme } from '../../store/privateGroupTheme-context';

export default function BoardTabs({ activeBoard, onSelectBoard }) {
  const { t } = useTranslation();
  const theme = usePrivateGroupTheme();

  const activeBackground = theme ? theme.primaryColor : GlobalStyle.color.primaryColor;
  const activeBorder = theme ? theme.secondaryColor : GlobalStyle.color.secondaryColor;
  const inactiveBorder = theme ? theme.hairlineStrong : rgbaFromHex(GlobalStyle.color.secondaryColor, 0.5);
  const tabTextColor = theme ? theme.text : GlobalStyle.color.onSurface;

  return (
    <View style={styles.row}>
      {BOARDS.map((board) => {
        const isActive = board === activeBoard;
        return (
          <Pressable
            key={board}
            testID={`ranking.screen.board.${board}`}
            onPress={() => onSelectBoard(board)}
            style={[
              styles.tab,
              { borderColor: isActive ? activeBorder : inactiveBorder },
              isActive && { backgroundColor: activeBackground },
            ]}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.tabText, { color: tabTextColor }, isActive && styles.tabTextActive]}>
              {t(`ui.ranking.board.${board}`)}
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
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabText: {
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    fontWeight: '800',
  },
});
