import { Pressable, Text, View , StyleSheet} from "react-native";
import { GlobalStyle } from "../../constants/theme";

  export default function TableButton({cellData, rowData, onPress, windowHeight, windowWidth}) {
    return(
      <View style={[styles.btn, { width: windowWidth * 0.18, height: windowHeight * 0.03, borderRadius: 5,}]}>
        <Pressable
          onPress={() => onPress(cellData, rowData)}
          style={ ({pressed}) => pressed && styles.pressed}>
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
    backgroundColor: GlobalStyle.color.primaryColor500,
    alignSelf: "center",
  },
  btnText: {
    textAlign: 'center',
    color: "white",
  },
});
