import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useDisplayName } from "../data-access/database";
import { useCameraPermissions } from "expo-camera";

export const SetupView = () => {
  const [provisionalName, setProvisionalName] = useState("");
  const [cameraPerms, requestCameraPerms] = useCameraPermissions();
  const { setDisplayName } = useDisplayName();

  // Camera permissions still loading
  if (!cameraPerms) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.subcontainer}>
        <TextInput
          style={[styles.textInput, styles.text]}
          value={provisionalName}
          onChangeText={setProvisionalName}
          placeholder="Name"
          placeholderTextColor="lightgrey"
        />
        <TouchableOpacity
          style={styles.submitButton}
          disabled={!provisionalName}
          onPress={() => {
            setDisplayName(provisionalName);
            if (cameraPerms && !cameraPerms.granted) {
              requestCameraPerms();
            }
          }}
        >
          <MaterialIcons name="arrow-forward-ios" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#242424",
  },
  subcontainer: {
    width: "50%",
    marginHorizontal: "auto",
  },
  text: {
    textAlign: "center",
    color: "white",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "white",
    padding: 10,
  },
  submitButton: {
    width: 30,
    marginTop: 25,
    marginHorizontal: "auto",
  },
});
