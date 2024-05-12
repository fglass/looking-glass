import { Image } from "expo-image";
import { StyleSheet, TouchableHighlight, View } from "react-native";

export const SnapView = ({
  snap,
  onClose,
}: {
  snap: { key: string; uri: string };
  onClose: () => void;
}) => (
  <View style={styles.container}>
    <View style={styles.camera}>
      <TouchableHighlight style={styles.imageContainer} onPress={onClose}>
        <Image
          source={{ uri: snap.uri, cacheKey: snap.key }}
          style={styles.fullImage}
        />
      </TouchableHighlight>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  camera: {
    flex: 1,
  },
  fullImage: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
  },
});
