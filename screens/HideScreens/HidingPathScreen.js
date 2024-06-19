import { View } from 'react-native';
import LogicalImagePicker from '../../components/Picture/LogicalImagePicker';

export default function HidingPathScreen({ navigation, isTutorial }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <LogicalImagePicker navigation={navigation} isTutorial={isTutorial} />
    </View>
  );
};
