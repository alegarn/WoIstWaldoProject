import * as FileSystem from "expo-file-system";
import { Alert } from "react-native";
import * as MediaLibrary from 'expo-media-library';

/* https://stackoverflow.com/questions/54586216/how-to-create-text-file-in-react-native-expo */
/* https://www.farhansayshi.com/post/how-to-save-files-to-a-device-folder-using-expo-and-react-native/ */

export async function toAlbum() {
  const fileUri = FileSystem.cacheDirectory + "WoIstWaldo-logs.txt";

  try {

    const asset = await MediaLibrary.createAssetAsync(fileUri);
    console.log("asset", asset);
    const album = await MediaLibrary.getAlbumAsync('Download');
    console.log("album", album);

    if (album == null) {
      const newAlbum  = await MediaLibrary.createAlbumAsync('Download', asset, false);
      Alert.alert("File created in Download: WoIstWaldo-logs.txt", newAlbum);
    } else {
      const albumDir = await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      console.log("albumDir", albumDir);
      Alert.alert("File created in Download: WoIstWaldo-logs.txt", album);
    };

    /* then delete the file */
    FileSystem.deleteAsync(fileUri);
  } catch (e) {
    console.log(e);
    console.log("asset", asset);
    Alert.alert("Error toAlbum", e.message);
  };
};

export async function showLogs() {
  const fileUri = FileSystem.cacheDirectory + "WoIstWaldo-logs.txt";
  const file = await FileSystem.getInfoAsync(fileUri);

  //console.log("FileSystem.getInfoAsync(fileUri).exists", FileSystem.getInfoAsync(fileUri).exists);
  if (file.exists) {
    const data = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
    //console.log("showLogs", data);
    return data;
  };
};


async function testFileExists(fileUri) {
  const file = await FileSystem.getInfoAsync(fileUri);
  if (!file.exists) {
    try {
      const infos = await FileSystem.writeAsStringAsync(fileUri, "", { encoding: FileSystem.EncodingType.UTF8 });
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      //console.log("File WoIstWaldo-logs.txt getInfoAsync", fileInfo);
      Alert.alert("File WoIstWaldo-logs.txt created", fileUri);
      return fileInfo;
    } catch (error) {
      Alert.alert("Error testFileExists", error.message);
    };
  };
  return file;
};

async function updateLogFile(fileUri, functionName, error, fileInfo) {
  /* console.log("updateLogFile", FileSystem.getInfoAsync(fileUri).exists);
  console.log("updateLogFile", fileInfo.exists); */

  if (fileInfo.exists) {
    let currentLog = await FileSystem.readAsStringAsync(fileInfo.uri, { encoding: FileSystem.EncodingType.UTF8 });
    let newLog = currentLog + "\n" + functionName + "\n" + error;
    try {
      await FileSystem.writeAsStringAsync(fileInfo.uri, newLog, { encoding: FileSystem.EncodingType.UTF8 });
      console.log("File WoIstWaldo-logs.txt updated", newLog);
    } catch (error) {
      Alert.alert("Error updateLogFile", error.message);
    };
  };
};

export async function errorLog({ functionName, error }) {
  let fileUri = FileSystem.cacheDirectory + "WoIstWaldo-logs.txt";
  try {
    const fileInfo = await testFileExists(fileUri);
    await updateLogFile(fileUri, functionName, error, fileInfo);
  } catch (error) {
    console.log("errorLog", error.message);
  };
};
