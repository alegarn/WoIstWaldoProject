import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { RANKING } from '../constants/ranking';
import { GlobalStyle } from '../constants/theme';
import { getRankingData, getUserScores } from '../utils/scoreRequests';

import TableComponent from '../components/UI/TableComponent';
import LoadingOverlay from '../components/UI/LoadingOverlay';
import { AuthContext } from '../store/auth-context';
import { useActiveGroup } from '../hooks/useActiveGroup';
import { useGroupsHub } from '../hooks/useGroupsHub';

// Bounded resident window: 150 rows ≈ 7–8 cursor pages of 20 rows.
// Keeps memory stable on low-end devices while allowing deep browsing.
// Old slices are evicted when the cap is exceeded (see fetchCursorPage).
const RANKING_RESIDENT_ROW_CAP = 150;

export default function RankingScreen({ route, navigation }) {

  const [slices, setSlices] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('initial');
  const fetchingRef = useRef(false);

  const context = useContext(AuthContext);
  const routeScope = route?.params?.scope;
  const { scope: activeScope } = useActiveGroup();
  const scope = routeScope ?? activeScope;
  const isPrivate = scope?.kind === 'private';
  const { data } = useGroupsHub();
  const group = isPrivate
    ? [...(data?.owned ?? []), ...(data?.joined ?? [])].find((entry) => entry.id === scope.groupId)
    : null;

  const rankingScope = isPrivate ? scope : 'initial';

  const tableHeaders = RANKING?.tableHeaders;

  const displayRows = slices.flat();

  const rankingDatum = displayRows.length > 0 ? {
    tableHeaders: tableHeaders.slice(0, 3).concat(["Others"]),
    tableScores: displayRows,
  } : null;

  const showSpecificDatum = useCallback(async (username) => {
    const response = await getUserScores({username, context: context});
    if (response?.status !== 200) {
      if (response?.status === 404) {
        Alert.alert("User not found", `No scores found for ${username}.`);
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
      Alert.alert("Scores unavailable", `Couldn't load detailed scores for ${username}.`);
      return
    }
    let infoString = '';

    infoString += `Total Score: ${total.total_score}\n`;
    infoString += `Total Hide Score: ${total.total_hide_score}\n`;
    infoString += `Total Guess Score: ${total.total_guess_score}\n`;
    infoString += `Hidden Images Count: ${hideInfo.hide_count}\n`;
    infoString += `Guessed Images Count: ${guessInfo.guess_count}\n`;

    Alert.alert("Complementary Scores of " + username, infoString);
  }, [context]);

  function handleError(message, status) {
    if (status === 401) {
      Alert.alert("There is a problem with the server", `${message}. Your authentication failed. Try to reconnect. You canno't get a ranking.`);
      return
    };
    if (status !== 200) {
      Alert.alert("There is a problem with the server", `${message}. Try to reconnect. You canno't get a ranking.`);
      return
    };
  };

  useEffect(() => {
    navigation.setOptions({ title: group?.name ?? 'Ranking' });
  }, [navigation, group?.name]);



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
    <>
      {rankingDatum ? (
        <View style={styles.screen} testID="ranking.screen">
          <TableComponent data={rankingDatum} onPress={showSpecificDatum} onEndReached={handleEndReached} />
        </View>
      ) : (
        <LoadingOverlay message={"Loading ranking table..."}/>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GlobalStyle.color.primaryColor800,
  },
});
