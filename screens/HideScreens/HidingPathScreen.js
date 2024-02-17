import { View } from 'react-native';
import LogicalImagePicker from '../../components/Picture/LogicalImagePicker';

export default function HidingPathScreen({ navigation }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <LogicalImagePicker navigation={navigation} />
    </View>
  );
};
