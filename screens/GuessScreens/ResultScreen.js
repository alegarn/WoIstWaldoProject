import { useLayoutEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

import { handleOrientation } from "../../utils/orientation";

import ShowSuccess from "../../components/Results/ShowSuccess";
import ShowFailure from "../../components/Results/ShowFailure";
import StarRatingLine from "../../components/UI/StarRatingLine";
import { RATING_DIMENSIONS } from "../../constants/rating";

export default function ResultScreen({ route, navigation }) {

  // load twice (1)
  console.log("ResultScreen");

  useLayoutEffect(() => {
    handleOrientation("portrait");
  }, []);

  const { onTarget } = route?.params;

  const [globalRating, setGlobalRating] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [subRatings, setSubRatings] = useState({});

  const handleSubRatingChange = (key, next) => {
    setSubRatings((prev) => ({ ...prev, [key]: next }));
  };

  const ratingBlock = (
    <View style={styles.ratingBlock}>
      <Text style={styles.sectionTitle}>Rate this image</Text>
      <StarRatingLine
        value={globalRating}
        onChange={setGlobalRating}
        testIDPrefix="result.rating.global"
      />
      <Pressable
        testID="result.rating.toggleDetails"
        onPress={() => setShowDetails((v) => !v)}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>
          {showDetails ? "Hide details" : "Rate in details"}
        </Text>
      </Pressable>
      {showDetails &&
        RATING_DIMENSIONS.map((dim) => (
          <View key={dim.key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{dim.label}</Text>
            <StarRatingLine
              value={subRatings[dim.key] || 0}
              onChange={(next) => handleSubRatingChange(dim.key, next)}
              testIDPrefix={`result.rating.detail.${dim.key}`}
            />
          </View>
        ))}
      <Pressable
        testID="result.rating.validate"
        onPress={() => console.log({ globalRating, subRatings })}
        style={styles.validate}
      >
        <Text style={styles.validateText}>Validate</Text>
      </Pressable>
    </View>
  );

  if (onTarget) {
    return (
      <View style={styles.container}>
        <ShowSuccess navigation={navigation} route={route} />
        {ratingBlock}
      </View>
    );
  };

  if (!onTarget) {
    return <ShowFailure navigation={navigation} route={route} />;
  };

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ratingBlock: {
    padding: 16,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  toggle: {
    marginTop: 12,
    padding: 8,
  },
  toggleText: {
    fontSize: 14,
    color: "#1D133D",
  },
  detailRow: {
    marginTop: 12,
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  validate: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#1D133D",
    borderRadius: 8,
  },
  validateText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "bold",
  },
});
