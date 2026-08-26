import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RANKING } from '../constants/ranking';
import { GlobalStyle } from '../constants/theme';
import { getRankingData, getUserScores } from '../utils/scoreRequests';

import TableComponent from '../components/UI/TableComponent';
import LoadingOverlay from '../components/UI/LoadingOverlay';
import { AuthContext } from '../store/auth-context';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../store/privateGroupTheme-context';
import { useActiveGroup } from '../hooks/useActiveGroup';

// Bounded resident window: 150 rows ≈ 7–8 cursor pages of 20 rows.
// Keeps memory stable on low-end devices while allowing deep browsing.
// Old slices are evicted when the cap is exceeded (see fetchCursorPage).
const RANKING_RESIDENT_ROW_CAP = 150;

export default function RankingScreen({ route, navigation }) {

  const { t } = useTranslation();

  const [slices, setSlices] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('initial');
  const fetchingRef = useRef(false);

  const context = useContext(AuthContext);
  const routeScope = route?.params?.scope;
  const { group, theme, isPrivate } = useScopedPrivateGroupTheme(routeScope);
  const { scope: activeScope } = useActiveGroup();
  const rankingScope = isPrivate ? (routeScope ?? activeScope) : 'initial';

  const tableHeaders = RANKING?.tableHeaders;

  const displayRows = slices.flat();

  const rankingDatum = displayRows.length > 0 ? {
    tableHeaders: tableHeaders.slice(0, 4).concat(["Others"]),
    tableScores: displayRows,
  } : null;

  const showSpecificDatum = useCallback(async (username) => {
    const response = await getUserScores({username, context: context, scope: rankingScope});
    if (response?.status !== 200) {
      if (response?.status === 404) {
        Alert.alert(t('ranking.userNotFound'), t('ranking.noScoresForUser', { name: username }));
        return
      }
      handleError(response?.message, response?.status);
      return
    }

    const scores = response?.data;
    const total = scores?.total;
    const hideInfo = scores?.hide_info;
    const guessInfo = scores?.guess_info;

    if (!total || !hideInfo || !guessInfo) {
      Alert.alert(t('ranking.scoresUnavailable'), t('ranking.detailsUnavailable', { name: username }));
      return
    }
    let infoString = '';

    infoString += `${t('ranking.totalScore', { value: total.total_score })}\n`;
    infoString += `${t('ranking.totalHideScore', { value: total.total_hide_score })}\n`;
    infoString += `${t('ranking.totalGuessScore', { value: total.total_guess_score })}\n`;
    infoString += `${t('ranking.hiddenCount', { value: hideInfo.hide_count })}\n`;
    infoString += `${t('ranking.guessedCount', { value: guessInfo.guess_count })}\n`;

    Alert.alert(t('ranking.complementaryTitle', { name: username }), infoString);
  }, [context, rankingScope, t]);

  function handleError(message, status) {
    if (status === 401) {
      Alert.alert(t('auth.serverProblemTitle'), t('ranking.authFailed', { message }));
      return
    };
    if (status !== 200) {
      Alert.alert(t('auth.serverProblemTitle'), t('ranking.genericFailed', { message }));
      return
    };
  };

  useEffect(() => {
    if (theme) {
      navigation.setOptions({
        title: group?.name ?? t('ranking.title'),
        headerStyle: { backgroundColor: theme.primaryColor },
        headerTintColor: theme.headerTintColor,
      });
    } else {
      navigation.setOptions({ title: group?.name ?? t('ranking.title') });
    }
  }, [navigation, group?.name, theme?.primaryColor, theme?.headerTintColor, t]);



  const handleRankingData = useCallback(async () => {
    const response = await getRankingData(context, { scope: rankingScope, top: 10, window: 5 });

    if (response?.status !== 200) {
      handleError(response?.message, response?.status);
      return;
    }

    const { rows, nextCursor: cursor, hasMore: more } = response.data;
    const converted = (rows || []).map((row) => ({
      rank: Number(row.rank),
      name: row.username,
      score: row.total_score,
      maxStreak: Number(row.max_streak || 0),
      others: "",
      userId: row.user_id,
    }));

    setSlices([converted]);
    setNextCursor(cursor);
    setHasMore(true);
    setMode('initial');
    return response;
  }, [context, rankingScope]);

  const fetchCursorPage = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setIsLoading(true);

    const cursorParams = isPrivate
      ? { scope: rankingScope, after: nextCursor }
      : { after: nextCursor };
    const response = await getRankingData(context, cursorParams);

    if (response?.status !== 200) {
      fetchingRef.current = false;
      setIsLoading(false);
      handleError(response?.message, response?.status);
      return;
    }

    const { rows, nextCursor: cursor, hasMore: more } = response.data;
    const baseRank = displayRows.length;
    const converted = (rows || []).map((row, index) => ({
      rank: baseRank + index + 1,
      name: row.username,
      score: row.total_score || row.totalScore,
      maxStreak: Number(row.max_streak || 0),
      others: "",
      userId: row.user_id,
    }));

    const finalConverted = mode === 'initial'
      ? (() => {
          const existingIds = new Set(displayRows.map(r => r.userId));
          return converted.filter(r => !existingIds.has(r.userId));
        })()
      : converted;

    setSlices(prev => {
      const next = [...prev, finalConverted];
      const totalRows = next.reduce((sum, s) => sum + s.length, 0);
      if (totalRows <= RANKING_RESIDENT_ROW_CAP) return next;
      let kept = [];
      let count = 0;
      for (let i = next.length - 1; i >= 0; i--) {
        if (count + next[i].length > RANKING_RESIDENT_ROW_CAP && kept.length > 0) break;
        kept.unshift(next[i]);
        count += next[i].length;
      }
      return kept;
    });
    setNextCursor(cursor);
    setHasMore(more !== false);
    setMode('browse');
    fetchingRef.current = false;
    setIsLoading(false);
  }, [context, hasMore, nextCursor, displayRows.length, mode, rankingScope]);

  const handleEndReached = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return;
    await fetchCursorPage();
  }, [hasMore, fetchCursorPage]);

  useEffect(() => {
    handleRankingData();
  }, [handleRankingData])

  return (
    <PrivateGroupThemeProvider group={group}>
      {rankingDatum ? (
        <View style={styles.screen} testID="ranking.screen">
          <TableComponent data={rankingDatum} onPress={showSpecificDatum} onEndReached={handleEndReached} />
        </View>
      ) : (
        <LoadingOverlay message={t('ranking.loadingTable')}/>
      )}
    </PrivateGroupThemeProvider>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GlobalStyle.color.primaryColor800,
  },
});
