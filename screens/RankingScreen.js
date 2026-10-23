import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BOARDS, PERIODS, columnsForBoard } from '../constants/ranking';
import { GlobalStyle } from '../constants/theme';
import { getRankingData, getUserScores } from '../utils/scoreRequests';
import { rgbaFromHex } from '../utils/privateGroupTheme';

import TableComponent from '../components/UI/TableComponent';
import BoardTabs from '../components/Ranking/BoardTabs';
import PeriodChips from '../components/Ranking/PeriodChips';
import UserScoreDetailContent from '../components/Ranking/UserScoreDetailContent';
import CenteredModal from '../components/UI/CenteredModal';
import Spinner from '../components/UI/Spinner';
import LoadingOverlay from '../components/UI/LoadingOverlay';
import { AuthContext } from '../store/auth-context';
import { PrivateGroupThemeProvider, useScopedPrivateGroupTheme } from '../store/privateGroupTheme-context';
import { useActiveGroup } from '../hooks/useActiveGroup';

// Bounded resident window: 150 rows ≈ 7–8 cursor pages of 20 rows.
// Keeps memory stable on low-end devices while allowing deep browsing.
// Old slices are evicted when the cap is exceeded (see fetchCursorPage).
const RANKING_RESIDENT_ROW_CAP = 150;
const RANKING_PAGE_LIMIT = 20;
const RANKING_TOP = 3;
const RANKING_WINDOW = 5;
const RANKING_HEAD_RANK = 3;

function scoreColumnFor(columns) {
  return columns.find(
    (column) => column.kind === 'score' || column.kind === 'score-emphasis'
  );
}

function convertRankingRows(rows, columns, { renumber = false, baseRank = 0 } = {}) {
  // Two-key row contract: `score` = normalized board score (plan D4); raw total_score/point_score/shape_score passthroughs feed TableComponent descriptor field reads.
  const scoreColumn = scoreColumnFor(columns);
  return (rows || []).map((row, index) => ({
    rank: renumber ? baseRank + index + 1 : Number(row.rank),
    name: row.username,
    score: row[scoreColumn?.field],
    maxStreak: Number(row.max_streak || 0),
    others: "",
    userId: row.user_id,
    total_score: row.total_score ?? row.score,
    point_score: row.point_score,
    shape_score: row.shape_score,
  }));
}

function composeInitialRows(rows, me) {
  if (!rows.length || !me) return rows;
  const head = [];
  const tail = [];
  rows.forEach((row) => {
    if (row.rank <= RANKING_HEAD_RANK) {
      head.push(row);
    } else {
      tail.push(row);
    }
  });
  if (head.length === 0 || tail.length === 0) return rows;
  if (tail[0].rank > head[head.length - 1].rank + 1) {
    return [...head, { separator: true }, ...tail];
  }
  return rows;
}

function lastResidentRank(residentRows) {
  for (let i = residentRows.length - 1; i >= 0; i--) {
    if (!residentRows[i].separator) return Number(residentRows[i].rank) || 0;
  }
  return 0;
}

function appendSliceWithCap(prevSlices, incoming, cap) {
  const next = [...prevSlices, incoming];
  const countRows = (slice) => slice.filter((row) => !row.separator).length;
  const totalRows = next.reduce((sum, slice) => sum + countRows(slice), 0);
  if (totalRows <= cap) return next;
  let kept = [];
  let count = 0;
  for (let i = next.length - 1; i >= 0; i--) {
    const sliceCount = countRows(next[i]);
    if (count + sliceCount > cap && kept.length > 0) break;
    kept.unshift(next[i]);
    count += sliceCount;
  }
  return kept;
}

function buildDetailRows(scores) {
  const total = scores?.total;
  const hideInfo = scores?.hide_info;
  const guessInfo = scores?.guess_info;
  const rows = [
    ['total_score', total?.total_score, 'ranking.totalScore'],
    ['point_score', total?.point_score, 'ranking.pointScore'],
    ['shape_score', total?.shape_score, 'ranking.contourScore'],
    ['total_hide_score', total?.total_hide_score, 'ranking.totalHideScore'],
    ['hide_count', hideInfo?.hide_count, 'ranking.hiddenCount'],
    ['guess_count', guessInfo?.guess_count, 'ranking.guessedCount'],
    ['total_point_guess_score', total?.total_point_guess_score, 'ranking.pointGuessScore'],
    ['total_shape_guess_score', total?.total_shape_guess_score, 'ranking.shapeGuessScore'],
    ['total_point_hide_score', total?.total_point_hide_score, 'ranking.pointHideScore'],
    ['total_shape_hide_score', total?.total_shape_hide_score, 'ranking.shapeHideScore'],
  ];
  return rows
    .filter(([, value]) => value != null)
    .map(([field, value, labelKey]) => ({ field, label: labelKey, value }));
}

export default function RankingScreen({ route, navigation }) {

  const { t } = useTranslation();

  const [board, setBoard] = useState('total');
  const [period, setPeriod] = useState('all');
  const [slices, setSlices] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [me, setMe] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [listEpoch, setListEpoch] = useState(0);
  const [detail, setDetail] = useState(null);
  const fetchingRef = useRef(false);
  const epochRef = useRef(0);

  const context = useContext(AuthContext);
  const routeScope = route?.params?.scope;
  const { group, theme, isPrivate } = useScopedPrivateGroupTheme(routeScope);
  const { scope: activeScope } = useActiveGroup();
  const rankingScope = isPrivate ? (routeScope ?? activeScope) : 'initial';

  const columns = useMemo(() => columnsForBoard(board, period), [board, period]);

  const displayRows = useMemo(() => slices.flat(), [slices]);

  const rankingDatum = useMemo(
    () => (displayRows.length > 0 ? { board, columns, tableScores: displayRows } : null),
    [displayRows, board, columns]
  );

  const handleError = useCallback((message, status) => {
    if (status === 401) {
      Alert.alert(t('auth.serverProblemTitle'), t('ranking.authFailed', { message }));
      return;
    }
    if (status !== 200) {
      Alert.alert(t('auth.serverProblemTitle'), t('ranking.genericFailed', { message }));
      return;
    }
  }, [t]);

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

    setDetail({ name: username, scores });
  }, [context, rankingScope, t, handleError]);

  const closeDetail = useCallback(() => setDetail(null), []);

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

  const isCurrentEpoch = (epoch) => epochRef.current === epoch;

  const loadFirstPage = useCallback(async (nextBoard, nextPeriod) => {
    const epoch = ++epochRef.current;
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await getRankingData(context, {
        scope: rankingScope,
        top: RANKING_TOP,
        window: RANKING_WINDOW,
        limit: RANKING_PAGE_LIMIT,
        board: nextBoard,
        period: nextPeriod,
      });

      if (!isCurrentEpoch(epoch)) return;

      if (response?.status !== 200) {
        setFetchError(response?.message ?? '');
        return;
      }

      const { rows, nextCursor: cursor, hasMore: more } = response.data;
      const converted = convertRankingRows(rows, columnsForBoard(nextBoard, nextPeriod));
      setSlices([composeInitialRows(converted, response.data.me ?? null)]);
      setNextCursor(cursor ?? null);
      setHasMore(more !== false);
      setMe(response.data.me ?? null);
    } catch (error) {
      if (!isCurrentEpoch(epoch)) return;
      setFetchError(error?.message ?? '');
    } finally {
      if (isCurrentEpoch(epoch)) setIsLoading(false);
    }
  }, [context, rankingScope]);

  const fetchCursorPage = useCallback(async () => {
    if (fetchingRef.current || !hasMore || !nextCursor) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setFetchError(null);

    const epoch = epochRef.current;
    const cursorParams = isPrivate
      ? { scope: rankingScope, after: nextCursor, limit: RANKING_PAGE_LIMIT, board }
      : { after: nextCursor, limit: RANKING_PAGE_LIMIT, board, period };

    try {
      const response = await getRankingData(context, cursorParams);

      if (!isCurrentEpoch(epoch)) return;

      if (response?.status !== 200) {
        setFetchError(response?.message ?? '');
        return;
      }

      const { rows, nextCursor: cursor, hasMore: more } = response.data;
      const rawRows = rows || [];

      setSlices(prev => {
        const residentRows = prev.flat();
        const existingIds = new Set(residentRows.map(r => r.userId));
        const freshRows = rawRows.filter(r => !existingIds.has(r.user_id));
        const baseRank = lastResidentRank(residentRows);
        const converted = convertRankingRows(freshRows, columns, { renumber: true, baseRank });
        return appendSliceWithCap(prev, converted, RANKING_RESIDENT_ROW_CAP);
      });
      setNextCursor(cursor);
      setHasMore(more !== false);
    } catch (error) {
      if (!isCurrentEpoch(epoch)) return;
      setFetchError(error?.message ?? '');
    } finally {
      fetchingRef.current = false;
      if (isCurrentEpoch(epoch)) setIsLoading(false);
    }
  }, [board, columns, context, hasMore, isPrivate, nextCursor, period, rankingScope]);

  const handleBoardSwitch = useCallback((nextBoard) => {
    if (!BOARDS.includes(nextBoard) || nextBoard === board) return;
    epochRef.current += 1;
    setBoard(nextBoard);
    setSlices([]);
    setNextCursor(null);
    setHasMore(false);
    setIsLoading(true);
    setMe(null);
    setFetchError(null);
    setListEpoch(current => current + 1);
  }, [board]);

  const handlePeriodSwitch = useCallback((nextPeriod) => {
    if (!PERIODS.includes(nextPeriod) || nextPeriod === period) return;
    epochRef.current += 1;
    setPeriod(nextPeriod);
    setSlices([]);
    setNextCursor(null);
    setHasMore(false);
    setIsLoading(true);
    setMe(null);
    setFetchError(null);
    setListEpoch(current => current + 1);
  }, [period]);

  const handleRefresh = useCallback(async () => {
    setListEpoch(current => current + 1);
    setIsRefreshing(true);
    try {
      await loadFirstPage(board, period);
    } finally {
      setIsRefreshing(false);
    }
  }, [board, loadFirstPage, period]);

  const handleRetry = useCallback(() => {
    if (displayRows.length > 0) {
      fetchCursorPage();
      return;
    }
    loadFirstPage(board, period);
  }, [board, displayRows.length, fetchCursorPage, loadFirstPage, period]);

  const handleEndReached = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return;
    await fetchCursorPage();
  }, [hasMore, fetchCursorPage]);

  useEffect(() => {
    loadFirstPage(board, period);
  }, [loadFirstPage, board, period])

  const accentColor = theme ? theme.secondaryColor : GlobalStyle.color.secondaryColor;
  const chromeHairline = theme ? theme.hairlineStrong : rgbaFromHex(GlobalStyle.color.secondaryColor, 0.5);
  const chromeText = theme ? theme.text : GlobalStyle.color.onSurface;
  const detailWash = rgbaFromHex(accentColor, 0.06);

  const detailRows = useMemo(() => (detail ? buildDetailRows(detail.scores) : []), [detail]);

  return (
    <PrivateGroupThemeProvider group={group}>
      <View style={styles.screen} testID="ranking.screen">
        <ScrollView
          style={styles.chrome}
          contentContainerStyle={styles.chromeContent}
        >
          <BoardTabs activeBoard={board} onSelectBoard={handleBoardSwitch} />
          {!isPrivate ? (
            <PeriodChips activePeriod={period} onSelectPeriod={handlePeriodSwitch} />
          ) : null}
          {me ? (
            <View style={[styles.meCard, { borderColor: chromeHairline }]} testID="ranking.meCard">
              <Text style={[styles.meCardRank, { color: accentColor }]} testID="ranking.meCard.rank">
                {t('ui.ranking.youAreRanked', { rank: me.rank })}
              </Text>
              {me.username ? (
                <Text style={[styles.meCardName, { color: chromeText }]} testID="ranking.meCard.name">
                  {me.username}
                </Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        {rankingDatum || fetchError ? (
          <TableComponent
            key={listEpoch}
            data={rankingDatum}
            onPress={showSpecificDatum}
            onEndReached={handleEndReached}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            refreshTint={accentColor}
          />
        ) : (
          <LoadingOverlay message={t('ranking.loadingTable')}/>
        )}
        <View style={styles.footer} testID="ranking.footer">
          {fetchError ? (
            <>
              <View testID="ranking.footer.error">
                <Text style={styles.footerError}>
                  {t('ranking.genericFailed', { message: fetchError })}
                </Text>
              </View>
              <Pressable
                style={styles.retryButton}
                onPress={handleRetry}
                testID="ranking.footer.retry"
              >
                <Text style={[styles.retryText, { color: accentColor }]}>{t('ui.ranking.retry')}</Text>
              </Pressable>
            </>
          ) : isLoading && !isRefreshing ? (
            <View testID="ranking.footer.spinner">
              <Spinner />
            </View>
          ) : !hasMore ? (
            <View testID="ranking.footer.end">
              <Text style={styles.footerEnd}>{t('ui.ranking.endOfRanking')}</Text>
            </View>
          ) : null}
        </View>
        {detail ? (
          <View testID="ranking.detail.modal">
            <CenteredModal
              isModalVisible={true}
              onCancel={closeDetail}
              singleButton={true}
              testIDPrefix="ranking.detail.modal"
            >
              <View style={styles.detailBody}>
                <UserScoreDetailContent
                  name={detail.name}
                  rows={detailRows}
                  accentColor={accentColor}
                  hairline={chromeHairline}
                  wash={detailWash}
                />
              </View>
            </CenteredModal>
          </View>
        ) : null}
      </View>
    </PrivateGroupThemeProvider>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GlobalStyle.color.primaryColor800,
  },
  chrome: {
    flexGrow: 0,
  },
  chromeContent: {
    paddingBottom: 4,
  },
  meCard: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  meCardRank: {
    fontWeight: '700',
    fontSize: 14,
  },
  meCardName: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  footerError: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(160, 118, 249, 0.5)',
    borderRadius: 8,
  },
  retryText: {
    fontWeight: '700',
    fontSize: 13,
  },
  footerEnd: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
  },
  detailBody: {
    width: '100%',
  },
});
