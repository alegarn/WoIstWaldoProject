import { Pressable, Text, View , StyleSheet} from "react-native";
import { GlobalStyle } from "../../constants/theme";

  export default function TableButton({cellData, rowData, onPress, windowHeight, windowWidth}) {
    return(
      <View style={[styles.btn, { width: windowWidth * 0.18, height: windowHeight * 0.03}]}>
        <Pressable onPress={() => onPress(cellData, rowData)} style={ ({pressed}) => pressed && styles.pressed}>
            <Text style={styles.btnText}>More</Text>
        </Pressable>
      </View>

    );
  };

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  btn: {
    backgroundColor: '#fff',
    borderRadius: 5,
    alignSelf: "center",
  },

  btnText: {
    textAlign: 'center',
    color: GlobalStyle.color.tertiaryColor700,
  },

});
