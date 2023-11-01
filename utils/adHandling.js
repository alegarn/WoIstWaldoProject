import mobileAds, { MaxAdContentRating, AdsConsent, AdsConsentStatus, AdsConsentDebugGeography } from 'react-native-google-mobile-ads';

/* https://apps.admob.com/v2/privacymessaging/gdpr
https://support.google.com/admob/answer/10113106

Possible Unhandled Promise Rejection (id: 0):
Error: Publisher misconfiguration: Failed to read publisher's account configuration; no form(s) configured for the input app ID. Verify that you have configured one or more forms for this application and try again. Received app ID: `ca-app-pub-1838983009101821~6524275274`.
Error: Publisher misconfiguration: Failed to read publisher's account configuration; no form(s) configured for the input app ID. Verify that you have configured one or more forms for this application and try again. Received app ID: `ca-app-pub-1838983009101821~6524275274`.

*/

async function adConfig() {

  const config = await mobileAds()
    .setRequestConfiguration({
      // Update all future requests suitable for parental guidance
      maxAdContentRating: MaxAdContentRating.PG,

      // Indicates that you want your content treated as child-directed for purposes of COPPA.
      tagForChildDirectedTreatment: true,

      // Indicates that you want the ad request to be handled in a
      // manner suitable for users under the age of consent.
      tagForUnderAgeOfConsent: true,

      // An array of test device IDs to allow.
      testDeviceIdentifiers: ['EMULATOR'],
    })
    .then(() => {
      console.log("Request config successfully set!");
      const adapterStatusesResult = mobileAds()
      .initialize()
      .then(adapterStatuses => {
        console.log("Initialization complete!");
        return adapterStatuses;
      });
      return adapterStatusesResult;
    });

  return config;
};


export async function getUserConsent () {
  const config = await adConfig();
  console.log("config", config);

  /*
  npm install --save react-native-device-info
  import { getUniqueId, syncUniqueId } from 'react-native-device-info';
  const androidId = await getUniqueId();
  const iosId = await syncUniqueId();
   */

  const consentInfo = await AdsConsent.requestInfoUpdate({
    debugGeography: AdsConsentDebugGeography.EEA,
    testDeviceIdentifiers: ['TEST-DEVICE-HASHED-ID'],
  });

  const { status } = await AdsConsent.loadAndShowConsentFormIfRequired();
  /* put it in context */

};
