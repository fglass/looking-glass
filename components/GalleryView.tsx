import { useState, useMemo, useCallback, memo, useRef } from "react";
import {
  Text,
  TouchableHighlight,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  View,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import type { ViewToken } from "react-native";
import { Image } from "expo-image";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { SnapView } from "./SnapView";
import { getSnapUrl, getSnaps, getSnapReactions } from "../data-access/s3";
import {
  BLUR_HASH,
  HIDDEN_SNAP_KEY,
  TAG_TO_EMOJI,
  getDateTimeFromSnapKey,
} from "../utils";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import * as MediaLibrary from "expo-media-library";
import { Directory, File, Paths } from "expo-file-system";

const STREAK_START_DATE = process.env.EXPO_PUBLIC_STREAK_START_DATE;
const THUMBNAIL_HEIGHT = 200;
const MONTH_HEADER_HEIGHT = 28;
const N_COLUMNS = 2;
const DAY_MS = 1000 * 60 * 60 * 24;

type GalleryRow = {
  id: string;
  header?: string;
  dayStart?: Date;
  snaps: ({ key: string } | null)[];
};

type GalleryDay = {
  key: string;
  firstRowIndex: number;
  dayStart: Date;
};

const getMonthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;

const getDayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const getDayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getClosestGalleryDay = (
  galleryDays: GalleryDay[],
  selectedDayStart: Date,
) => {
  const selectedTime = selectedDayStart.getTime();

  return galleryDays.reduce<GalleryDay | null>((closestDay, day) => {
    if (!closestDay) {
      return day;
    }

    const currentDistance = Math.abs(day.dayStart.getTime() - selectedTime);
    const closestDistance = Math.abs(
      closestDay.dayStart.getTime() - selectedTime,
    );

    if (currentDistance < closestDistance) {
      return day;
    }

    const currentDayIsOlder =
      day.dayStart.getTime() < closestDay.dayStart.getTime();
    if (currentDistance === closestDistance && currentDayIsOlder) {
      return day;
    }

    return closestDay;
  }, null);
};

const Thumbnail = memo(
  ({
    snap,
    onSnapPress,
  }: {
    snap: { key: string };
    onSnapPress: (key: string, uri: string) => void;
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
    const { data: reactions } = useQuery({
      queryKey: ["fetchSnapReactions", snap.key],
      queryFn: async () => await getSnapReactions(snap.key ?? ""),
      staleTime: 60_000,
      gcTime: 60_000,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    });

    const reactionEmojis = useMemo(() => {
      if (!reactions) {
        return [];
      }
      const seen = new Set<string>();
      return reactions
        .map((tag) => TAG_TO_EMOJI[tag] ?? tag)
        .filter((emoji) => {
          if (!emoji || seen.has(emoji)) {
            return false;
          }
          seen.add(emoji);
          return true;
        });
    }, [reactions]);

    if (isLoading || error || !snapUri) {
      return (
        <View style={styles.thumbnailContainer}>
          <ActivityIndicator style={styles.thumbnail} />
        </View>
      );
    }

    const isHidden = snap.key.includes(HIDDEN_SNAP_KEY);

    return (
      <TouchableHighlight
        style={styles.thumbnailContainer}
        onPress={() => onSnapPress(snap.key, snapUri)}
      >
        <View style={styles.thumbnail}>
          {isHidden ? (
            <>
              <Image
                style={styles.thumbnail}
                source={{ blurhash: BLUR_HASH }}
              />
              <View style={styles.iconOverlay}>
                <MaterialCommunityIcons
                  name="eye-off-outline"
                  size={70}
                  color="yellow"
                />
              </View>
            </>
          ) : (
            <Image
              style={styles.thumbnail}
              source={{ uri: snapUri, cacheKey: snap.key }}
              cachePolicy="memory-disk"
            />
          )}
          {reactionEmojis.length > 0 && (
            <View pointerEvents="none" style={styles.reactionOverlay}>
              {reactionEmojis.map((emoji) => (
                <Text style={styles.reactionEmoji} key={emoji}>
                  {emoji}
                </Text>
              ))}
            </View>
          )}
        </View>
      </TouchableHighlight>
    );
  },
);
Thumbnail.displayName = "Thumbnail";

const GalleryRowItem = memo(
  ({
    item,
    onSnapPress,
  }: {
    item: GalleryRow;
    onSnapPress: (key: string, uri: string) => void;
  }) => (
    <View style={styles.rowContainer}>
      {item.header && (
        <View style={styles.monthHeader}>
          <Text style={styles.monthHeaderText}>{item.header}</Text>
        </View>
      )}
      <View style={styles.row}>
        {item.snaps.map((snap, columnIdx) =>
          snap ? (
            <Thumbnail key={snap.key} snap={snap} onSnapPress={onSnapPress} />
          ) : (
            <View
              key={`placeholder-${item.id}-${columnIdx}`}
              style={styles.thumbnailPlaceholder}
            />
          ),
        )}
      </View>
    </View>
  ),
);
GalleryRowItem.displayName = "GalleryRowItem";

export default function GalleryView({ onClose }: { onClose: () => void }) {
  const galleryListRef = useRef<FlatList<GalleryRow>>(null);
  const leftFling = useMemo(
    () => Gesture.Fling().direction(Directions.LEFT).onStart(onClose),
    [onClose],
  );
  const [openedSnap, setOpenedSnap] = useState<{
    key: string;
    uri: string;
  } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [currentScrolledDate, setCurrentScrolledDate] = useState<Date | null>(
    null,
  );
  const {
    isLoading,
    error,
    data: gallerySnaps,
  } = useQuery({
    queryKey: ["fetchGallery"],
    queryFn: async () => {
      console.log("Fetching gallery...");
      const snaps = await getSnaps();

      if (!snaps) {
        return [];
      }

      const latestSnaps = snaps.slice().reverse();
      return latestSnaps
        .filter((item) => item.Key)
        .map((item) => ({ key: item.Key! }));
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("default", { month: "long", year: "numeric" }),
    [],
  );

  const { galleryRows, rowHeights, rowOffsets, galleryDays } = useMemo(() => {
    if (!gallerySnaps) {
      return {
        galleryRows: [] as GalleryRow[],
        rowHeights: [] as number[],
        rowOffsets: [] as number[],
        galleryDays: [] as GalleryDay[],
      };
    }

    const rows: GalleryRow[] = [];
    const heights: number[] = [];
    const offsets: number[] = [];
    const days: GalleryDay[] = [];
    const seenDays = new Set<string>();

    let runningOffset = 0;
    let currentMonthKey: string | null = null;

    const monthRowCounts: Record<string, number> = {};
    let currentRow: GalleryRow | null = null;

    const pushRow = (id: string, header?: string) => {
      const height = THUMBNAIL_HEIGHT + (header ? MONTH_HEADER_HEIGHT : 0);
      const row: GalleryRow = { id, header, snaps: [] };
      rows.push(row);
      offsets.push(runningOffset);
      heights.push(height);
      runningOffset += height;
      return row;
    };

    gallerySnaps.forEach((snap) => {
      const snapDate = getDateTimeFromSnapKey(snap.key);
      const isValidDate = !Number.isNaN(snapDate.getTime());
      const snapDayStart = isValidDate ? getDayStart(snapDate) : null;
      const monthKey = isValidDate ? getMonthKey(snapDate) : "unknown";
      const headerLabel = isValidDate
        ? monthFormatter.format(snapDate)
        : "Unknown date";

      const isNewMonth = monthKey !== currentMonthKey;
      if (isNewMonth) {
        currentMonthKey = monthKey;
        const rowIndex = monthRowCounts[monthKey] ?? 0;
        monthRowCounts[monthKey] = rowIndex;
        const rowId = `${monthKey}-${rowIndex}`;
        currentRow = pushRow(
          rowId,
          rows.length === 0 ? undefined : headerLabel,
        );
        monthRowCounts[monthKey] = rowIndex + 1;
      } else if (!currentRow || currentRow.snaps.length === N_COLUMNS) {
        const rowIndex = monthRowCounts[monthKey] ?? 0;
        const rowId = `${monthKey}-${rowIndex}`;
        currentRow = pushRow(rowId);
        monthRowCounts[monthKey] = rowIndex + 1;
      }

      if (snapDayStart) {
        const dayKey = getDayKey(snapDayStart);
        if (!seenDays.has(dayKey)) {
          seenDays.add(dayKey);
          days.push({
            key: dayKey,
            firstRowIndex: rows.length - 1,
            dayStart: snapDayStart,
          });
        }

        if (currentRow && !currentRow.dayStart) {
          currentRow.dayStart = snapDayStart;
        }
      }

      currentRow?.snaps.push({ key: snap.key });
    });

    rows.forEach((row) => {
      while (row.snaps.length < N_COLUMNS) {
        row.snaps.push(null);
      }
    });

    return {
      galleryRows: rows,
      rowHeights: heights,
      rowOffsets: offsets,
      galleryDays: days,
    };
  }, [gallerySnaps, monthFormatter]);

  const newestGalleryDay = galleryDays[0];
  const oldestGalleryDay = galleryDays[galleryDays.length - 1];
  const visiblePickerDate =
    currentScrolledDate ??
    newestGalleryDay?.dayStart ??
    getDayStart(new Date());

  const jumpToDate = useCallback(
    (date: Date) => {
      const selectedDayStart = getDayStart(date);
      const selectedDayKey = getDayKey(selectedDayStart);
      const targetDay =
        galleryDays.find((day) => day.key === selectedDayKey) ??
        getClosestGalleryDay(galleryDays, selectedDayStart);

      if (!targetDay) {
        return;
      }

      galleryListRef.current?.scrollToIndex({
        index: targetDay.firstRowIndex,
        animated: true,
        viewPosition: 0,
      });
    },
    [galleryDays],
  );

  const onDatePickerChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);

        if (event.type === "set" && date) {
          jumpToDate(date);
        }
        return;
      }

      if (date) {
        setPickerDate(getDayStart(date));
      }
    },
    [jumpToDate],
  );

  const confirmDatePickerSelection = useCallback(() => {
    setShowDatePicker(false);
    jumpToDate(pickerDate);
  }, [jumpToDate, pickerDate]);

  const cancelDatePickerSelection = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const openDatePicker = useCallback(() => {
    if (!newestGalleryDay || !oldestGalleryDay) {
      return;
    }

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: visiblePickerDate,
        mode: "date",
        minimumDate: oldestGalleryDay.dayStart,
        onChange: onDatePickerChange,
      });
      return;
    }

    setPickerDate(visiblePickerDate);
    setShowDatePicker(true);
  }, [
    newestGalleryDay,
    oldestGalleryDay,
    onDatePickerChange,
    visiblePickerDate,
  ]);

  const streakDurationDays = useMemo(() => {
    const streakStart = STREAK_START_DATE
      ? new Date(STREAK_START_DATE)
      : new Date();
    return Math.floor((Date.now() - streakStart.getTime()) / DAY_MS);
  }, []);

  const onSnapPress = useCallback((key: string, uri: string) => {
    setOpenedSnap({ key, uri });
  }, []);

  const onSnapSave = useCallback(async () => {
    if (!openedSnap) {
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission is required to save snaps.",
        );
        return;
      }

      let localUri = openedSnap.uri;
      if (localUri.startsWith("http")) {
        const safeKey = openedSnap.key.replace(/[^a-z0-9]/gi, "_");
        const cacheDir = new Directory(Paths.cache, "snaps");
        if (!cacheDir.exists) {
          cacheDir.create();
        }
        const destination = new File(cacheDir, `${safeKey}.jpg`);
        const output = await File.downloadFileAsync(localUri, destination);
        localUri = output.uri;
      }

      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert("Success", "Snap saved!");
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert("Error", "Failed to save snap.");
    }
  }, [openedSnap]);

  const renderItem = useCallback(
    ({ item }: { item: GalleryRow }) => (
      <GalleryRowItem item={item} onSnapPress={onSnapPress} />
    ),
    [onSnapPress],
  );

  const keyExtractor = useCallback((item: GalleryRow) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<GalleryRow> | null | undefined, index: number) => ({
      length: rowHeights[index] ?? THUMBNAIL_HEIGHT,
      offset: rowOffsets[index] ?? THUMBNAIL_HEIGHT * index,
      index,
    }),
    [rowHeights, rowOffsets],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<GalleryRow>[] }) => {
      let firstVisibleDatedRow: GalleryRow | null = null;
      let firstVisibleRowIndex = Infinity;

      for (const viewToken of viewableItems) {
        if (
          !viewToken.isViewable ||
          typeof viewToken.index !== "number" ||
          !viewToken.item.dayStart
        ) {
          continue;
        }

        if (viewToken.index < firstVisibleRowIndex) {
          firstVisibleDatedRow = viewToken.item;
          firstVisibleRowIndex = viewToken.index;
        }
      }

      if (firstVisibleDatedRow?.dayStart) {
        setCurrentScrolledDate(firstVisibleDatedRow.dayStart);
      }
    },
  ).current;

  if (isLoading || error) {
    return <View />;
  }

  return (
    <GestureDetector gesture={leftFling}>
      <View style={styles.container}>
        <FlatList
          ref={galleryListRef}
          data={galleryRows}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          windowSize={5} // Current + screens above & below
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          getItemLayout={getItemLayout}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
        />
        <View style={styles.navbar}>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="arrow-back-ios" size={36} color="yellow" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calendarNavButton}
            onPress={openDatePicker}
            disabled={!newestGalleryDay || !oldestGalleryDay}
          >
            <MaterialIcons name="calendar-today" size={32} color="yellow" />
          </TouchableOpacity>
          {streakDurationDays > 0 && (
            <View style={styles.streakContainer}>
              <Text style={styles.text}>
                {streakDurationDays.toLocaleString()} 🔥
              </Text>
            </View>
          )}
        </View>
        {showDatePicker && Platform.OS === "ios" && (
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerActions}>
                <TouchableOpacity onPress={cancelDatePickerSelection}>
                  <MaterialIcons name="close" size={28} color="yellow" />
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmDatePickerSelection}>
                  <Text style={styles.datePickerActionText}>Go</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                minimumDate={oldestGalleryDay?.dayStart}
                onChange={onDatePickerChange}
                textColor="#ffffff"
              />
            </View>
          </View>
        )}
        {openedSnap && (
          <View style={styles.snapOverlay}>
            <SnapView
              key={openedSnap.key}
              snap={openedSnap}
              displayDate={true}
              onClose={() => setOpenedSnap(null)}
            />
            <TouchableOpacity style={styles.saveButton} onPress={onSnapSave}>
              <MaterialIcons name="save-alt" size={42} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#242424" },
  rowContainer: {
    width: "100%",
  },
  monthHeader: {
    backgroundColor: "yellow",
    paddingVertical: 3,
    paddingHorizontal: 12,
    alignSelf: "stretch",
    marginBottom: 0,
  },
  monthHeaderText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
  },
  thumbnailContainer: { flex: 1 },
  thumbnail: {
    width: "100%",
    height: THUMBNAIL_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
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
  reactionOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  reactionEmoji: {
    fontSize: 32,
    marginRight: 4,
  },
  thumbnailPlaceholder: {
    flex: 1,
    height: THUMBNAIL_HEIGHT,
    backgroundColor: "transparent",
  },
  navbar: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    position: "absolute",
    top: 40,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  calendarNavButton: {
    position: "absolute",
    left: 58,
    top: 6,
    height: 44,
    width: 44,
    justifyContent: "center",
    alignItems: "center",
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
  saveButton: {
    position: "absolute",
    bottom: 30,
    left: 25,
    alignItems: "center",
  },
  datePickerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 900,
  },
  datePickerContainer: {
    backgroundColor: "rgba(36, 36, 36, 0.88)",
    borderRadius: 8,
    overflow: "hidden",
  },
  datePickerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 0,
  },
  datePickerActionText: {
    color: "yellow",
    fontSize: 17,
    fontWeight: "600",
  },
});
