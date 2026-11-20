import { Pressable, Text, View , StyleSheet} from "react-native";
import { useTranslation } from 'react-i18next';

import { GlobalStyle } from "../../constants/theme";
import { usePrivateGroupTheme } from '../../store/privateGroupTheme-context';

  export default function TableButton({ onPress, buttonWidth, buttonHeight, buttonBorderRadius, testID, accessibilityLabel }) {
    const { t } = useTranslation();
    const theme = usePrivateGroupTheme();
    const fill = theme ? theme.primaryColor : GlobalStyle.color.primaryColor;
    return(
      <View style={[styles.btn, { width: buttonWidth, height: buttonHeight, borderRadius: buttonBorderRadius, backgroundColor: fill }]}>
        <Pressable
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          testID={testID}
          style={ ({pressed}) => pressed && styles.pressed}>
            <Text style={styles.btnText}>{t('common.more')}</Text>
        </Pressable>
      </View>
    );
  };

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  btn: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: 'rgba(160, 118, 249, 0.5)',
    justifyContent: 'center',
  },
  btnText: {
    textAlign: 'center',
    color: "white",
    fontWeight: '600',
    fontSize: 11,
  },
});
