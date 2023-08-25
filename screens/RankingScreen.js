import { Alert, View } from 'react-native';
import { RANKING } from '../data/dummy-data';

import TableComponent from '../components/UI/TableComponent';

export default function RankingScreen() {

  function convertToRanking(rankingData) {
    const { tableHeaders, scoresDatum } = rankingData;

    const data = {
      tableHeaders: tableHeaders.slice(0, 3).concat(["Others"]),
      tableScores: scoresDatum.map(({ id, rank, name, totalScore, ...rest }) => ({ rank, name, totalScore, id })),
      complementaryHeaders: tableHeaders.slice(3),
      complementaryScores: scoresDatum
        .map(({ id, ...rest }) => Object.keys(rest).reduce((acc, key) => {
          if (key.startsWith('guess') || key.startsWith('hide')) {
            acc[key] = rest[key];
          }
          return acc;
        }, { id })).sort((a, b) => a.totalScore - b.totalScore)
    };

    return data;
  };

  const showSpecificDatum = (id) => {
    const extractedScore = data.complementaryScores.filter((score) => score.id === id);
    const score = extractedScore[0];
    const message = Object.keys(score).reduce((msg, key) => {
      if (key.startsWith('guess') || key.startsWith('hide')) {
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        const value = key.includes('Count') ? `${score[key]} times` : `${score[key]} points`;
        return `${msg}${label}: ${value}\n`;
      }
      return msg;
    }, '');

    Alert.alert("Complementary Scores", message);
  };

  const data = convertToRanking(RANKING);


  return (
    <>
      <TableComponent data={data} onPress={showSpecificDatum} />
    </>
  );
};


