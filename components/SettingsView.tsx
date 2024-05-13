import { StyleSheet, Switch, Text, View } from "react-native";
import { useClientId, useLastSnap } from "../data-access/database";
import React from "react";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

export default function SettingsView({
  pushToken,
  selfSend,
  setSelfSend,
  onClose,
}: {
  pushToken: string;
  selfSend: boolean;
  setSelfSend: (selfSend: boolean) => void;
  onClose: () => void;
}) {
  const bucket = process.env.EXPO_PUBLIC_S3_BUCKET_NAME ?? "err";
  const bucketRegion = process.env.EXPO_PUBLIC_S3_BUCKET_REGION ?? "err";
  const downFling = Gesture.Fling().direction(Directions.DOWN).onStart(onClose);

  const clientId = useClientId();
  const { lastSnap } = useLastSnap();

  return (
    <GestureDetector gesture={downFling}>
      <View style={styles.container}>
        <Text style={styles.headerText}>Settings</Text>

        <View style={styles.settingsContainer}>
          <Text style={styles.text}>Self-Send</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#3e3e3e" }}
            thumbColor={selfSend ? "#f5dd4b" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            value={selfSend}
            onValueChange={setSelfSend}
          />
        </View>
        <Text style={styles.headerText}>Debug</Text>
        <Text style={styles.smallText}>
          Bucket: {bucket} ({bucketRegion})
        </Text>
        <Text style={styles.smallText}>Client ID: {clientId}</Text>
        <Text style={styles.smallText}>
          Push Token: {pushToken.slice(18, -1)}
        </Text>
        <Text style={styles.smallText}>
          Last Snap LM: {lastSnap.LastModified?.toISOString()}
        </Text>
        <Text style={styles.smallText}>
          Last Snap Key: {lastSnap.key ?? "null"}
        </Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    backgroundColor: "black",
  },
  settingsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    paddingBottom: 10,
  },
  text: {
    fontSize: 16,
    textAlign: "center",
    color: "white",
  },
  smallText: {
    fontSize: 10,
    color: "white",
  },
});
