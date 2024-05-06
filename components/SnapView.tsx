import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export const SnapView = ({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) => (
  <View style={styles.container}>
    <View style={styles.camera}>
      <TouchableOpacity style={styles.opacityContainer} onPress={onClose}>
        <Image source={{ uri }} style={styles.fullImage} />
      </TouchableOpacity>
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
  opacityContainer: {
    flex: 1,
  },
});
