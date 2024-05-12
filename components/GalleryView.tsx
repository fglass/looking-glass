import { useState } from "react";
import {
  Text,
  TouchableHighlight,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  View,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SnapView } from "./SnapView";
import { getSnapUrl, getSnaps } from "../data-access/s3";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

const SNAP_LIMIT = 20;
const STREAK_START_DATE = process.env.EXPO_PUBLIC_STREAK_START_DATE;

export default function GalleryView({ onClose }: { onClose: () => void }) {
  const leftFling = Gesture.Fling().direction(Directions.LEFT).onStart(onClose);
  const [openedSnap, setOpenedSnap] = useState<{
    key: string;
    uri: string;
  } | null>(null);

  const {
    isLoading,
    error,
    data: gallery,
  } = useQuery({
    queryKey: ["fetchGallery"],
    queryFn: async () => {
      console.log("Fetching gallery...");
      const snaps = await getSnaps();

      if (!snaps) {
        return [];
      }

      const latestSnaps = snaps.reverse().slice(0, SNAP_LIMIT);

      return await Promise.all(
        latestSnaps.map(async (item) => ({
          key: item.Key,
          uri: await getSnapUrl(item.Key ?? ""),
        }))
      );
    },
    staleTime: 60 * 1000, // 1 minute
  });

  if (isLoading || error) {
    return <View />;
  }

  if (openedSnap) {
    return <SnapView snap={openedSnap} onClose={() => setOpenedSnap(null)} />;
  }

  const Thumbnail = ({ snap }: { snap: { key: string; uri: string } }) => {
    return (
      <TouchableHighlight
        style={styles.imageContainer}
        onPress={() => setOpenedSnap(snap)}
      >
        <Image
          style={styles.image}
          source={{ uri: snap.uri, cacheKey: snap.key }}
          cachePolicy="memory-disk"
        />
      </TouchableHighlight>
    );
  };

  const streakStart = STREAK_START_DATE
    ? new Date(STREAK_START_DATE)
    : new Date();
  const streakDurationDays = Math.floor(
    (Date.now() - new Date(streakStart).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <GestureDetector gesture={leftFling}>
      <View style={styles.container}>
        <FlatList
          numColumns={2}
          data={gallery}
          renderItem={({ item }) => <Thumbnail snap={item} />}
        />
        <View style={styles.navbar}>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="arrow-back-ios" size={36} color="yellow" />
          </TouchableOpacity>
          <Text style={styles.text}>
            {streakDurationDays.toLocaleString()} 🔥
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    paddingTop: 80,
  },
  imageContainer: {
    flex: 1,
  },
  image: {
    aspectRatio: 1,
  },
  navbar: {
    flex: 1,
    flexDirection: "row",
    position: "absolute",
    top: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  text: {
    margin: "auto",
    width: "100%",
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
});
