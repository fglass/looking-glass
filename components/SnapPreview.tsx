import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export const SnapPreview = ({
  uri,
  onSend,
  onClose,
}: {
  uri: string;
  onSend: () => void;
  onClose: () => void;
}) => (
  <View style={styles.container}>
    <View style={styles.camera}>
      <Image source={{ uri }} style={styles.fullImage} />
      <View style={styles.overlayTopContainer}>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <MaterialIcons name="close" size={42} color="white" />
        </TouchableOpacity>
      </View>
      <View style={styles.overlayBottomContainer}>
        <TouchableOpacity style={styles.button} onPress={onSend}>
          <MaterialIcons name="send" size={42} color="white" />
        </TouchableOpacity>
      </View>
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
  overlayTopContainer: {
    position: "absolute",
    top: 50,
    left: 25,
  },
  overlayBottomContainer: {
    position: "absolute",
    bottom: 30,
    right: 25,
  },
  button: {
    flex: 1,
    alignSelf: "flex-end",
    alignItems: "center",
  },
});
