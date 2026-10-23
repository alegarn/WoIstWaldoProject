import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
const RANKING_WINDOW = 5;

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

function hasServerRank(row) {
  const rank = Number(row.rank);
  return Number.isInteger(rank) && rank > 0;
}

function lastResidentRank(residentRows) {
  for (let i = residentRows.length - 1; i >= 0; i--) {
    if (!residentRows[i].separator) return Number(residentRows[i].rank) || 0;
  }
  return 0;
}

function firstResidentRank(residentRows) {
  for (let i = 0; i < residentRows.length; i++) {
    if (!residentRows[i].separator) return Number(residentRows[i].rank) || 0;
  }
  return 0;
}

export function deriveDisplayRows(slices) {
  const seenUserIds = new Set();
  const rows = [];
  (slices || []).forEach((slice) => {
    (slice || []).forEach((row) => {
      if (row.separator) return;
      if (row.userId != null) {
        if (seenUserIds.has(row.userId)) return;
        seenUserIds.add(row.userId);
      }
      rows.push(row);
    });
  });
  rows.sort((a, b) => Number(a.rank) - Number(b.rank));
  const display = [];
  rows.forEach((row, index) => {
    if (index > 0 && Number(row.rank) - Number(rows[index - 1].rank) > 1) {
      display.push({ separator: true });
    }
    display.push(row);
  });
  return display;
}

function countSliceRows(slice) {
  return slice.filter((row) => !row.separator).length;
}

function capSliceWindow(sliceList, cap, keepFromEnd) {
  const totalRows = sliceList.reduce((sum, slice) => sum + countSliceRows(slice), 0);
  if (totalRows <= cap) return sliceList;
  let kept = [];
  let count = 0;
  const order = keepFromEnd ? [...sliceList].reverse() : sliceList;
  for (const slice of order) {
    const sliceCount = countSliceRows(slice);
    if (count + sliceCount > cap && kept.length > 0) break;
    kept.push(slice);
    count += sliceCount;
  }
  return keepFromEnd ? kept.reverse() : kept;
}

function appendSliceWithCap(prevSlices, incoming, cap) {
  return capSliceWindow([...prevSlices, incoming], cap, true);
}

function prependSliceWithCap(prevSlices, incoming, cap) {
  return capSliceWindow([incoming, ...prevSlices], cap, false);
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
  const [upCursor, setUpCursor] = useState(null);
  const [hasMoreUp, setHasMoreUp] = useState(false);
  const [downCursor, setDownCursor] = useState(null);
  const [hasMoreDown, setHasMoreDown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [me, setMe] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [listEpoch, setListEpoch] = useState(0);
  const [detail, setDetail] = useState(null);
  const fetchingUpRef = useRef(false);
  const fetchingDownRef = useRef(false);
  const inFlightRef = useRef(0);
  const epochRef = useRef(0);

  const context = useContext(AuthContext);
  const routeScope = route?.params?.scope;
  const { group, theme, isPrivate } = useScopedPrivateGroupTheme(routeScope);
  const { scope: activeScope } = useActiveGroup();
  const rankingScope = isPrivate ? (routeScope ?? activeScope) : 'initial';

  const columns = useMemo(() => columnsForBoard(board, period), [board, period]);

  const displayRows = useMemo(() => deriveDisplayRows(slices), [slices]);

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
    fetchingUpRef.current = false;
    fetchingDownRef.current = false;
    inFlightRef.current = 0;
    setIsLoading(true);
    setFetchError(null);
    try {
      // Contract v3 public path: me-window envelope, no top block request.
      // Private path stays legacy top-3: the private leaderboard defaults
      // top=10, which would silently grow the head block.
      const response = await getRankingData(context, {
        scope: rankingScope,
        ...(isPrivate ? { top: 3 } : {}),
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

      const data = response.data;
      const isBidirectional = data.upCursor !== undefined || data.downCursor !== undefined;
      const converted = convertRankingRows(data.rows, columnsForBoard(nextBoard, nextPeriod));
      setSlices([converted]);
      if (isBidirectional) {
        setUpCursor(data.upCursor ?? null);
        setHasMoreUp(data.hasMoreUp !== false && data.upCursor != null);
        setDownCursor(data.downCursor ?? null);
        setHasMoreDown(data.hasMoreDown !== false && data.downCursor != null);
      } else {
        setUpCursor(null);
        setHasMoreUp(false);
        setDownCursor(data.nextCursor ?? null);
        setHasMoreDown(data.hasMore !== false && data.nextCursor != null);
      }
      setMe(data.me ?? null);
    } catch (error) {
      if (!isCurrentEpoch(epoch)) return;
      setFetchError(error?.message ?? '');
    } finally {
      if (isCurrentEpoch(epoch)) setIsLoading(false);
    }
  }, [context, isPrivate, rankingScope]);

  const fetchCursorPage = useCallback(async (direction) => {
    const isUp = direction === 'up';
    const fetchingRef = isUp ? fetchingUpRef : fetchingDownRef;
    const cursor = isUp ? upCursor : downCursor;
    const hasMore = isUp ? hasMoreUp : hasMoreDown;
    if (fetchingRef.current || !hasMore || !cursor) return;
    fetchingRef.current = true;
    inFlightRef.current += 1;
    setIsLoading(true);
    setFetchError(null);

    const epoch = epochRef.current;
    const cursorParams = isPrivate
      ? { scope: rankingScope, after: cursor, limit: RANKING_PAGE_LIMIT, board }
      : { after: cursor, direction, limit: RANKING_PAGE_LIMIT, board, period };

    try {
      const response = await getRankingData(context, cursorParams);

      if (!isCurrentEpoch(epoch)) return;

      if (response?.status !== 200) {
        setFetchError(response?.message ?? '');
        return;
      }

      const { rows, nextCursor, hasMore: more } = response.data;
      const rawRows = rows || [];
      const nextHasMore = more !== false && nextCursor != null;

      setSlices(prev => {
        const residentRows = prev.flat();
        const existingIds = new Set(residentRows.map(r => r.userId));
        const freshRows = rawRows.filter(r => !existingIds.has(r.user_id));
        let converted;
        if (isUp) {
          const firstRank = firstResidentRank(residentRows);
          converted = freshRows.map((row, index) => {
            if (hasServerRank(row)) {
              return convertRankingRows([row], columns)[0];
            }
            return convertRankingRows([row], columns, { renumber: true, baseRank: firstRank - (freshRows.length - index) })[0];
          });
        } else {
          let renumberBase = lastResidentRank(residentRows);
          converted = freshRows.map((row) => {
            if (hasServerRank(row)) {
              return convertRankingRows([row], columns)[0];
            }
            const convertedRow = convertRankingRows([row], columns, { renumber: true, baseRank: renumberBase })[0];
            renumberBase = convertedRow.rank;
            return convertedRow;
          });
        }
        return isUp
          ? prependSliceWithCap(prev, converted, RANKING_RESIDENT_ROW_CAP)
          : appendSliceWithCap(prev, converted, RANKING_RESIDENT_ROW_CAP);
      });
      if (isUp) {
        setUpCursor(nextCursor);
        setHasMoreUp(nextHasMore);
      } else {
        setDownCursor(nextCursor);
        setHasMoreDown(nextHasMore);
      }
    } catch (error) {
      if (!isCurrentEpoch(epoch)) return;
      setFetchError(error?.message ?? '');
    } finally {
      if (isCurrentEpoch(epoch)) {
        fetchingRef.current = false;
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        if (inFlightRef.current === 0) setIsLoading(false);
      }
    }
  }, [board, columns, context, downCursor, hasMoreDown, hasMoreUp, isPrivate, period, rankingScope, upCursor]);

  const handleBoardSwitch = useCallback((nextBoard) => {
    if (!BOARDS.includes(nextBoard) || nextBoard === board) return;
    epochRef.current += 1;
    setBoard(nextBoard);
    setSlices([]);
    setUpCursor(null);
    setHasMoreUp(false);
    setDownCursor(null);
    setHasMoreDown(false);
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
    setUpCursor(null);
    setHasMoreUp(false);
    setDownCursor(null);
    setHasMoreDown(false);
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
      fetchCursorPage('up');
      fetchCursorPage('down');
      return;
    }
    loadFirstPage(board, period);
  }, [board, displayRows.length, fetchCursorPage, loadFirstPage, period]);

  const handleEndReached = useCallback(() => {
    fetchCursorPage('down');
  }, [fetchCursorPage]);

  const handleStartReached = useCallback(() => {
    fetchCursorPage('up');
  }, [fetchCursorPage]);

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
        {fetchError || rankingDatum ? (
          <TableComponent
            key={listEpoch}
            data={rankingDatum}
            onPress={showSpecificDatum}
            onEndReached={handleEndReached}
            onStartReached={handleStartReached}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            refreshTint={accentColor}
          />
        ) : slices.length > 0 ? (
          <ScrollView
            style={styles.emptyState}
            contentContainerStyle={styles.emptyStateContent}
            testID="ranking.empty"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={accentColor}
              />
            }
          >
            <Text style={styles.emptyStateText}>{t('ranking.empty')}</Text>
          </ScrollView>
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
          ) : !hasMoreDown ? (
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
  emptyState: {
    flex: 1,
  },
  emptyStateContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 14,
  },
  detailBody: {
    width: '100%',
  },
});
