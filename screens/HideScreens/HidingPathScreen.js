import { View } from 'react-native';
import LogicalImagePicker from '../../components/Picture/LogicalImagePicker';
import { useActiveGroup } from '../../hooks/useActiveGroup';

export default function HidingPathScreen({ navigation, route }) {
  const isTutorial = route?.params?.isTutorial;
  const routeScope = route?.params?.scope;
  const { scope: activeScope } = useActiveGroup();
  const scope = routeScope ?? activeScope;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <LogicalImagePicker navigation={navigation} isTutorial={isTutorial} scope={scope} />
    </View>
  );
};
