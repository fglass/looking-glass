import { StyleSheet, Text, View } from "react-native";
import { useClientId, useLastSnap } from "../data-access/database";
import React from "react";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

export default function AdminView({
  pushToken,
  onClose,
}: {
  pushToken: string;
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
        <Text style={styles.headerText}>Debug</Text>
        <Text style={styles.text}>
          Bucket: {bucket} ({bucketRegion})
        </Text>
        <Text style={styles.text}>Client ID: {clientId}</Text>
        <Text style={styles.text}>Push Token: {pushToken.slice(18, -1)}</Text>
        <Text style={styles.text}>
          Last Snap LM: {lastSnap.LastModified?.toISOString()}
        </Text>
        <Text style={styles.text}>Last Snap Key: {lastSnap.key ?? "null"}</Text>
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
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    paddingBottom: 10,
  },
  text: {
    fontSize: 10,
    color: "white",
  },
});
