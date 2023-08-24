import { useLayoutEffect } from "react";

import { handleOrientation } from "../utils/orientation";

import ShowSuccess from "../components/Results/ShowSuccess";
import ShowFailure from "../components/Results/ShowFailure";

import { IMAGES } from "../data/dummy-data";

export default function ResultScreen({ route, navigation }) {

  const { onTarget, accountId, pictureId } = route.params;

  useLayoutEffect(() => {
    handleOrientation("portrait");
  }, []);

  function removeImageFromList(pictureId) {
    const newList = IMAGES.filter((item) => item.pictureId !== pictureId);
    IMAGES.splice(0, IMAGES.length, ...newList);
    return newList;
  };

  function userEarnPoints(accountId) {
    console.log(`User ${accountId} earned 1 point!`);
  };

  if (onTarget) {
    userEarnPoints(accountId)
    removeImageFromList(pictureId);
    return <ShowSuccess navigation={navigation} route={route} />;
  };

  if (!onTarget) {
    return <ShowFailure navigation={navigation} route={route} />;
  };

};
