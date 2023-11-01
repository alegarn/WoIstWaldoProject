import { useLayoutEffect, useState, useEffect } from "react";
import { View, Text } from "react-native";

import LoadingOverlay from "../components/UI/LoadingOverlay";
import { InterstitialAd, AdEventType, TestIds, useInterstitialAd } from 'react-native-google-mobile-ads';

/* import { InterstitialAd, TestIds, AdEventType } from 'react-native-google-mobile-ads'; */
/* const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyyyyyy'; */

/*
https://blog.openreplay.com/setting-up-google-admob-ads-with-react-native/
  Setting up Interstitial Ads
  European User Consent !!!
    https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent
      Enable and configure GDPR and IDFA messaging in the Privacy & messaging section of AdMob's Web Console.
      For Expo users, add extraProguardRules property to app.json file following this guide Expo:
      App Tracking Transparency

https://docs.page/invertase/react-native-google-mobile-ads
  Optionally configure iOS static frameworks
  App Tracking Transparency (iOS)
  European User Consent
    https://developers.google.com/admob/android/privacy
    https://support.google.com/admob/answer/10207733
    https://github.com/invertase/react-native-google-mobile-ads
https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads#interstitial-ads

*/


/* European User Consent
https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent */



export default function AdScreen({navigation, route}){


  const showLoadingOverlay = () => {
    const message = "Loading Ads";
    return <LoadingOverlay message={message} />;
  };


  const { onTarget, imageFile, pictureId, description, imageHeight, imageWidth, isPortrait, hiddenLocation, screenHeight, screenWidth, listId } = route.params;

  /*  */

  const toResultScreen = () => {
    navigation.replace("ResultScreen", {
      onTarget: onTarget,
      imageFile: imageFile,
      pictureId: pictureId,
      description: description,
      imageHeight: imageHeight,
      imageWidth:imageWidth,
      isPortrait: isPortrait,
      hiddenLocation: hiddenLocation,
      screenHeight: screenHeight,
      screenWidth: screenWidth,
      listId: listId
    });
  };


  const { isLoaded, isClosed, load, show } = useInterstitialAd(TestIds.INTERSTITIAL, {
    requestNonPersonalizedAdsOnly: true,
  });

  useEffect(() => {
    // Start loading the interstitial straight away
    load();
  }, [load]);

  useEffect(() => {
    if (isClosed) {
      // Action after the ad is closed
      toResultScreen();
    };
  }, [isClosed, navigation]);


  // No advert ready to show yet
  if (!isLoaded) {
    return showLoadingOverlay();
  };



  /*
  the options object includes the requestNonPersonalizedAdsOnly property, which tells the AdMob network to only show non-personalized ads
  const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, {
    requestNonPersonalizedAdsOnly: true,
    keywords: ['fashion', 'clothing'],
  }); */

/*   const waitSomeTime = async (myFunction) => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    myFunction();
  }; */



/*   useLayoutEffect(() => {
    waitSomeTime(toResultScreen);
  }, [route]); */


  /*
  useEffect(() => {
  interstitial.load();
  setTimeout(() => {
    interstitial.show()
  }, 20000);
}, []);
 */

  return(
    <View>
      {isLoaded ? (
          show()
      )
      : (
        // No advert ready to show yet
        showLoadingOverlay()
      )}
    </View>
  )
};
