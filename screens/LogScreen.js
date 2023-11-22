import { View, Text, Platform } from "react-native";
import { showLogs } from "../utils/errorLog";
import { useEffect, useState } from "react";
import Button from "../components/UI/Button";
import * as Clipboard from 'expo-clipboard';

export default function LogScreen({ navigation }) {

  const [logs, setLogs] = useState(null);
  const [displayLogs, setDisplayLogs] = useState(false);

  const fetchLogs = async () => {

    if (displayLogs) {
      setDisplayLogs(false);
      setLogs(null);
    };

    if (!displayLogs) {
      const logs = await showLogs();
      setLogs(logs);
      setDisplayLogs(true);
    };

  };

  const copyLogsToClipboard = async () => {
    const logs = await showLogs()
    await Clipboard.setStringAsync(logs);
  };


  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>LogScreen</Text>
      <Text>Sorry it's unpractical but would be possible to click the 'Copy Logs', paste it and email me everything?</Text>
      <Text>Thanks!</Text>
      <Button
        onPress={fetchLogs}
        mode={Platform.OS === "ios" ? "flat" : null}
        thin={true}
        cancel={true}
      >Get the logs</Button>
      <Button
        mode={Platform.OS === "ios" ? "flat" : null}
        thin={true}
        onPress={copyLogsToClipboard}>Copy Logs</Button>


      {logs !== null && setDisplayLogs ? <Text>The Logs: {"\n"} {logs}</Text>
      : null}
    </View>
  );
};
