import { useState } from "react";
import { TouchableOpacity, StyleSheet, FlatList, View } from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SnapView } from "./SnapView";
import { getSnapUrl, getSnaps } from "../data-access/s3";

const SNAP_LIMIT = 20;

export default function GalleryView({ onClose }) {
  const [openedSnap, setOpenedSnap] = useState(null);

  const {
    isLoading,
    error,
    data: gallery,
  } = useQuery({
    queryKey: ["fetchGallery"],
    queryFn: async () => {
      console.log("Fetching gallery...");
      const snaps = await getSnaps();
      const latestSnaps = snaps
        .reverse()
        .slice(0, SNAP_LIMIT)
        .map((item) => item.Key);

      return await Promise.all(
        latestSnaps.map(async (snap) => await getSnapUrl(snap))
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

  const Thumbnail = ({ uri }) => {
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
