import { useContext, useEffect, useState } from 'react';
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

  const showSpecificDatum = async (username) => {
    const response = await getUserScores({username, context: context});
    console.log("response", response);
    const scores = response?.data;
    let infoString = '';

    infoString += `Total Score: ${scores.total.total_score}\n`;
    infoString += `Total Hide Score: ${scores.total.total_hide_score}\n`;
    infoString += `Total Guess Score: ${scores.total.total_guess_score}\n`;
    infoString += `Hidden Images Count: ${scores.hide_info.hide_count}\n`;
    infoString += `Guessed Images Count: ${scores.guess_info.guess_count}\n`;

    Alert.alert("Complementary Scores of " + username, infoString);
  };

  const handleError = (message, status) => {
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
    const rankingData = await getRankingData(context);

    if (rankingData?.status !== 200) {
      handleError(rankingData?.message, rankingData?.status);
      return
    };

    const data =  rankingData?.data?.data;
    const pagyData = rankingData?.data?.pagy;
    const finalDatum = convertToRanking(tableHeaders, data, pagyData);
    setRankingDatum(finalDatum);
    return rankingData;
  };

  useEffect(() => {
    handleRankingData();
  }, [])

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
