import { useContext, useLayoutEffect } from 'react';
import { Alert, View } from 'react-native';

import { AuthContext } from '../../store/auth-context';
import LogicalImagePicker from '../../components/Picture/LogicalImagePicker';

export default function HidingPathScreen({ navigation }) {

  const context = useContext(AuthContext);

  const verifyLoginInfos = async () => {
    const token = await SecureStore?.getItemAsync("token");
    const contextToken = context?.token;
    if (!token && !contextToken) {
      Alert.alert("Error, your session has expired", "Any upload will not be possible. \nPlease re-log in first");
    }
  };

  useLayoutEffect(() => {
    verifyLoginInfos();
  })

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <LogicalImagePicker navigation={navigation} />
    </View>
  );
};
