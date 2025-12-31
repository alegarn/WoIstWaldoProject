import { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { RANKING } from '../constants/ranking';
import { getRankingData, getUserScores } from '../utils/scoreRequests';

import TableComponent from '../components/UI/TableComponent';
import LoadingOverlay from '../components/UI/LoadingOverlay';
import { AuthContext } from '../store/auth-context';

export default function RankingScreen() {

  const [rankingDatum, setRankingDatum] = useState(null);

  const context = useContext(AuthContext);

  function convertToRanking(tableHeaders, rankingData, pagyData) {
    const totalPages = pagyData.pages;
    const currentPage = pagyData.page;
    const itemsPerPage = pagyData.items;
    const totalItems = pagyData.count;

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
      handleError(response?.message, response?.status);
      return
    }

    const scores = response?.data;
    let infoString = '';

    infoString += `Total Score: ${scores.total.total_score}\n`;
    infoString += `Total Hide Score: ${scores.total.total_hide_score}\n`;
    infoString += `Total Guess Score: ${scores.total.total_guess_score}\n`;
    infoString += `Hidden Images Count: ${scores.hide_info.hide_count}\n`;
    infoString += `Guessed Images Count: ${scores.guess_info.guess_count}\n`;

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



  const handleRankingData = async () => {
    const tableHeaders = RANKING?.tableHeaders;
    const rankingData = await getRankingData(context, { scope: 'initial', top: 10, window: 5 });

    if (rankingData?.status !== 200) {
      handleError(rankingData?.message, rankingData?.status);
      return
    };

    const payload = rankingData?.data?.data;

    let finalDatum = null;
    if (payload && Array.isArray(payload.rows)) {
      finalDatum = convertInitialToRanking(tableHeaders, payload.rows);
    } else {
      const data = payload;
      const pagyData = rankingData?.data?.pagy;
      finalDatum = convertToRanking(tableHeaders, data, pagyData);
    }

    setRankingDatum(finalDatum);
    return rankingData;
  };

  useEffect(() => {
    handleRankingData();
  }, [context])

  return (
    <>
      {rankingDatum ? (
        <View>
          <TableComponent data={rankingDatum}  onPress={showSpecificDatum}  />
        </View>
      ) : (
        <LoadingOverlay message={"Loading ranking table..."}/>
      )}
    </>
  );
};
