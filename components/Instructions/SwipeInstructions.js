import { View, Text, StyleSheet } from "react-native";

import { Ionicons } from '@expo/vector-icons';

import BigButton from '../UI/BigButton';
import { GlobalStyle } from "../../constants/theme";

export default function SwipeInstructions({ screenWidth, handleFilterClick }) {

  const textSize = { fontSize: screenWidth/10 };

  return(
    <View style={styles.container}>
        <View style={styles.filter}>
          <View style={styles.marginTop}>
            <Text style={[styles.filterText, textSize]}>Swipe !</Text>
          </View>
          

          <View style={styles.filterIconContainer}>
            <Ionicons name={"arrow-up-circle"} color={"white"} size={screenWidth/10}/>
            <Ionicons name={"arrow-down-circle"} color={"white"} size={screenWidth/10}/>
            <Text style={[styles.filterText, textSize]}>Description</Text>
          </View>

          <View style={styles.marginTop}>
            <BigButton text="Let's go!" onPress={handleFilterClick} buttonStyle="ranking" />
          </View>


          <View style={styles.filterIconContainer}>
            <Ionicons name={"arrow-back-circle"} color={"white"} size={screenWidth/10}/>
            <Text style={[styles.filterText, textSize]}>Pass</Text>
          </View>

          <View style={styles.filterIconContainer}>
            <Ionicons name={"arrow-forward-circle"} color={"white"} size={screenWidth/10}/>
            <Text style={[styles.filterText, textSize]}>Play</Text>
          </View>

        </View>
    </View>
  )
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

  },
  filter: {
    position: 'absolute',
    flex: 1,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: GlobalStyle.color.secondaryColor500,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },

  marginTop: {
    marginTop: 10,
  },
  filterIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterText: {
    color: 'white',
    fontWeight: 'bold',
    position: "relative",

  },
});
