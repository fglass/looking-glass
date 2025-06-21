import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";

export const SnapPreview = ({
  uri,
  onSend,
  onClose,
}: {
  uri: string;
  onSend: ({ hidden }: { hidden: boolean }) => void;
  onClose: () => void;
}) => {
  const onSave = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission is required to save snaps."
        );
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Success", "Snap saved!");
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert("Error", "Failed to save snap.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.camera}>
        <Image source={{ uri }} style={styles.fullImage} />
        <View style={styles.overlayTopContainer}>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <MaterialIcons name="close" size={42} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.overlayBottomContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => onSend({ hidden: false })}
            onLongPress={() => onSend({ hidden: true })}
          >
            <MaterialIcons name="send" size={42} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.overlayBottomLeftContainer}>
          <TouchableOpacity style={styles.button} onPress={onSave}>
            <MaterialIcons name="save-alt" size={42} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
  camera: { flex: 1 },
  fullImage: { flex: 1 },
  overlayTopContainer: { position: "absolute", top: 50, left: 25 },
  overlayBottomContainer: { position: "absolute", bottom: 30, right: 25 },
  overlayBottomLeftContainer: { position: "absolute", bottom: 30, left: 25 },
  button: { flex: 1, alignSelf: "flex-end", alignItems: "center" },
});
