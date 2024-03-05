import { useLayoutEffect } from "react";

import { handleOrientation } from "../../utils/orientation";

import ShowSuccess from "../../components/Results/ShowSuccess";
import ShowFailure from "../../components/Results/ShowFailure";

export default function ResultScreen({ route, navigation }) {

  // load twice (1)
  console.log("ResultScreen");

  useLayoutEffect(() => {
    handleOrientation("portrait");
  }, []);

  const { onTarget } = route?.params;


  if (onTarget) {
    return <ShowSuccess navigation={navigation} route={route} />;
  };

  if (!onTarget) {
    return <ShowFailure navigation={navigation} route={route} />;
  };

};
