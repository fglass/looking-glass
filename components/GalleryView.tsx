import { useState } from "react";
import { TouchableOpacity, StyleSheet, FlatList, View } from "react-native";
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

export default function GalleryView({ onClose }: { onClose: () => void }) {
  const leftFling = Gesture.Fling().direction(Directions.LEFT).onStart(onClose);
  const [openedSnap, setOpenedSnap] = useState<{ uri: string } | null>(null);

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
        latestSnaps.map((item) => getSnapUrl(item.Key ?? ""))
      );
    },
    staleTime: 60 * 1000, // 1 minute
  });

  if (isLoading || error) {
    return <View />;
  }

  if (openedSnap) {
    return (
      <SnapView uri={openedSnap.uri} onClose={() => setOpenedSnap(null)} />
    );
  }

  const Thumbnail = ({ uri }: { uri: string }) => {
    return (
      <TouchableOpacity
        style={styles.opacityContainer}
        onPress={() => setOpenedSnap({ uri })}
      >
        <Image
          style={styles.image}
          source={{ uri }}
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    );
  };

  return (
    <GestureDetector gesture={leftFling}>
      <View>
        <FlatList
          numColumns={2}
          data={gallery}
          renderItem={({ item: uri }) => <Thumbnail uri={uri} />}
        />
        <View style={styles.navbar}>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="arrow-back-ios" size={36} color="yellow" />
          </TouchableOpacity>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  navbar: {
    position: "absolute",
    top: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  opacityContainer: {
    flex: 1,
  },
  image: {
    aspectRatio: 1,
  },
});
