import { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { RANKING } from '../constants/ranking';
import { GlobalStyle } from '../constants/theme';
import { getRankingData, getUserScores } from '../utils/scoreRequests';

import TableComponent from '../components/UI/TableComponent';
import LoadingOverlay from '../components/UI/LoadingOverlay';
import { AuthContext } from '../store/auth-context';

export default function RankingScreen() {

  const [rankingDatum, setRankingDatum] = useState(null);
  const [rows, setRows] = useState([]);
  const [pagy, setPagy] = useState(null);
  const [mode, setMode] = useState('initial');
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const context = useContext(AuthContext);

  function convertToRanking(tableHeaders, rankingData, pagyData) {
    const currentPage = pagyData.page;
    const itemsPerPage = pagyData.items;

    const data = {
      tableHeaders: tableHeaders.slice(0, 3).concat(["Others"]),
      tableScores: rankingData.map(({ total_score, username, ...rest }, index) => ({
        rank: ((currentPage - 1) * itemsPerPage) + index + 1,
        name: username ,
        score: total_score,
        others: ""
      }))
    };

    return data;
  };

  function convertInitialToRanking(tableHeaders, rows) {
    const data = {
      tableHeaders: tableHeaders.slice(0, 3).concat(["Others"]),
      tableScores: (rows || []).map((row) => ({
        rank: Number(row.rank),
        name: row.username,
        score: row.total_score,
        others: ""
      }))
    };
    return data;
  };

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



  const handleRankingData = useCallback(async () => {
    const tableHeaders = RANKING?.tableHeaders;
    const rankingData = await getRankingData(context, { scope: 'initial', top: 10, window: 5 });

    if (rankingData?.status !== 200) {
      handleError(rankingData?.message, rankingData?.status);
      return
    };

    const payload = rankingData?.data?.data;

    let finalDatum = null;
    if (payload && Array.isArray(payload.rows)) {
      const init = convertInitialToRanking(tableHeaders, payload.rows);
      setRows(init.tableScores);
      setRankingDatum(init);
      setMode('initial');
    } else {
      const data = payload;
      const pagyData = rankingData?.data?.pagy;
      const final = convertToRanking(tableHeaders, data, pagyData);
      setRows(final.tableScores);
      setRankingDatum(final);
      setPagy(pagyData);
      setMode('paged');
    }
    return rankingData;
  }, [context]);

  async function fetchPage(page) {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    const tableHeaders = RANKING?.tableHeaders;
    const response = await getRankingData(context, { page });
    if (response?.status !== 200) {
      setIsLoadingMore(false);
      handleError(response?.message, response?.status);
      return;
    }

    const data = response.data.data;
    const pagyData = response.data.pagy;
    const pageRows = (data || []).map((rec, index) => ({
      rank: ((pagyData.page - 1) * pagyData.items) + index + 1,
      username: rec.username,
      name: rec.username,
      score: rec.total_score || rec.totalScore,
    }));

    // dedupe by username (avoid exposing user_id on client)
    const existingNames = new Set(rows.map(r => String(r.name)));
    const deduped = pageRows.filter(r => !existingNames.has(String(r.name)));

    const nextRows = rows.concat(deduped.map(r => ({ rank: r.rank, name: r.name, score: r.score })));
    setRows(nextRows);
    setRankingDatum({ tableHeaders: tableHeaders.slice(0,3).concat(["Others"]), tableScores: nextRows });
    setPagy(pagyData);
    setMode('paged');
    setIsLoadingMore(false);
  }

  const handleEndReached = async () => {
    if (isLoadingMore) return;
    if (mode === 'initial') {
      // switch to paged mode: load page 1 then allow more
      await fetchPage(1);
      return;
    }
    if (pagy && pagy.page < pagy.pages) {
      await fetchPage(pagy.page + 1);
    }
  };

  useEffect(() => {
    handleRankingData();
  }, [handleRankingData])

  return (
    <>
      {rankingDatum ? (
        <View style={styles.screen} testID="ranking.screen">
          <TableComponent data={rankingDatum}  onPress={showSpecificDatum}  />
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
    backgroundColor: GlobalStyle.color.primaryColor500,
  },
});
