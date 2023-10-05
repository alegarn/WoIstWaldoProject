import { useLayoutEffect } from "react";

import { handleOrientation } from "../utils/orientation";

import ShowSuccess from "../components/Results/ShowSuccess";
import ShowFailure from "../components/Results/ShowFailure";

export default function ResultScreen({ route, navigation }) {

  const { onTarget, pictureId } = route.params;

  useLayoutEffect(() => {
    handleOrientation("portrait");
  }, []);


  function userEarnPoints(pictureId) {
    console.log(`User earned 1 point! (or not :) )`);
  };

  if (onTarget) {
    userEarnPoints(pictureId)
    return <ShowSuccess navigation={navigation} route={route} />;
  };

  if (!onTarget) {
    return <ShowFailure navigation={navigation} route={route} />;
  };

};
