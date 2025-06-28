import { useState, useMemo, useCallback, memo } from "react";
import {
  Text,
  TouchableHighlight,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  View,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SnapView } from "./SnapView";
import { getSnapUrl, getSnaps } from "../data-access/s3";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { BLUR_HASH, HIDDEN_SNAP_KEY } from "../utils";

const STREAK_START_DATE = process.env.EXPO_PUBLIC_STREAK_START_DATE;
const THUMBNAIL_HEIGHT = 200;
const N_COLUMNS = 2;

const Thumbnail = memo(
  ({
    idx,
    snap,
    onSnapPress,
  }: {
    idx: number;
    snap: { key: string };
    onSnapPress: (key: string, uri: string, idx: number) => void;
  }) => {
    const {
      isLoading,
      error,
      data: snapUri,
    } = useQuery({
      queryKey: ["fetchSnapUri", snap.key],
      queryFn: async () => await getSnapUrl(snap.key ?? ""),
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });

    if (isLoading || error || !snapUri) {
      return (
        <View style={styles.thumbnailContainer}>
          <ActivityIndicator style={styles.thumbnail} />
        </View>
      );
    }

    return (
      <TouchableHighlight
        style={styles.thumbnailContainer}
        onPress={() => onSnapPress(snap.key, snapUri, idx)}
      >
        {snap.key.includes(HIDDEN_SNAP_KEY) ? (
          <View style={styles.thumbnail}>
            <Image style={styles.thumbnail} source={{ blurhash: BLUR_HASH }} />
            <View style={styles.iconOverlay}>
              <MaterialCommunityIcons
                name="eye-off-outline"
                size={70}
                color="yellow"
              />
            </View>
          </View>
        ) : (
          <Image
            style={styles.thumbnail}
            source={{ uri: snapUri, cacheKey: snap.key }}
            cachePolicy="memory-disk"
          />
        )}
      </TouchableHighlight>
    );
  }
);
Thumbnail.displayName = "Thumbnail";

export default function GalleryView({ onClose }: { onClose: () => void }) {
  const leftFling = Gesture.Fling().direction(Directions.LEFT).onStart(onClose);
  const [openedSnap, setOpenedSnap] = useState<{
    key: string;
    uri: string;
  } | null>(null);
  const [scrollIdx, setScrollIdx] = useState(0);
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

      const latestSnaps = snaps.reverse();
      return latestSnaps
        .filter((item) => item.Key)
        .map((item) => ({ key: item.Key! }));
    },
  });

  const streakDurationDays = useMemo(() => {
    const streakStart = STREAK_START_DATE
      ? new Date(STREAK_START_DATE)
      : new Date();
    return Math.floor(
      (Date.now() - new Date(streakStart).getTime()) / (1000 * 60 * 60 * 24)
    );
  }, []);

  const handleSnapPress = useCallback(
    (key: string, uri: string, idx: number) => {
      setOpenedSnap({ key, uri });
      const rowIndex = Math.floor(idx / N_COLUMNS);
      setScrollIdx(rowIndex);
    },
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: { key: string }; index: number }) => (
      <Thumbnail
        key={item.key}
        idx={index}
        snap={item}
        onSnapPress={handleSnapPress}
      />
    ),
    [handleSnapPress]
  );

  const keyExtractor = useCallback((item: { key: string }) => item.key, []);

  if (isLoading || error) {
    return <View />;
  }

  return (
    <GestureDetector gesture={leftFling}>
      <View style={styles.container}>
        <FlatList
          numColumns={N_COLUMNS}
          data={gallery}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          windowSize={3} // Current + screens above & below
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          initialScrollIndex={scrollIdx}
          getItemLayout={(_data, index) => ({
            length: THUMBNAIL_HEIGHT,
            offset: THUMBNAIL_HEIGHT * index,
            index,
          })}
        />
        <View style={styles.navbar}>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="arrow-back-ios" size={36} color="yellow" />
          </TouchableOpacity>
          {streakDurationDays > 0 && (
            <View style={styles.streakContainer}>
              <Text style={styles.text}>
                {streakDurationDays.toLocaleString()} 🔥
              </Text>
            </View>
          )}
        </View>
        {openedSnap && (
          <View style={styles.snapOverlay}>
            <SnapView
              key={openedSnap.key}
              snap={openedSnap}
              displayDate={true}
              onClose={() => setOpenedSnap(null)}
            />
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#242424" },
  thumbnailContainer: { flex: 1 },
  thumbnail: {
    aspectRatio: 1,
    height: THUMBNAIL_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  iconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  navbar: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    position: "absolute",
    top: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  streakContainer: {
    backgroundColor: "yellow",
    paddingTop: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#242424",
    textAlign: "center",
  },
  snapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});
