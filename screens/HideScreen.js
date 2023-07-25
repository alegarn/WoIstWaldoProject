import Picture from '../components/Picture/Picture';

export default function HideScreen({ navigation, route }) {

  return (
    <>
      <Picture
        uri={route.params?.uri}
        imageWidth={route.params?.imageWidth}
        imageHeight={route.params?.imageHeight}
        screenHeight={route.params?.screenHeight}
        screenWidth={route.params?.screenWidth}
        isPortrait={route.params?.isPortrait} />
    </>
  );
}
