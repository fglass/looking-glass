import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      handleRegistrationError(
        "Permission not granted to get push token for push notification!"
      );
      return;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      handleRegistrationError("Project ID not found");
    }
    try {
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      return pushTokenString;
    } catch (e: unknown) {
      handleRegistrationError(`${e}`);
    }
  } else {
    handleRegistrationError("Must use physical device for push notifications");
  }
}

function handleRegistrationError(errorMessage: string) {
  alert(errorMessage);
  throw new Error(errorMessage);
}

type PushNotification = {
  title: string;
  badge?: number;
};

export async function sendPushNotifications({
  clientId,
  tokens,
  notification,
}: {
  clientId: string;
  tokens: { Key?: string }[];
  notification: PushNotification;
}) {
  const messages: (PushNotification | { to: string; sound: string })[] = [];

  tokens.forEach((t) => {
    if (t.Key) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, client, token] = t.Key.split("|");
      if (client !== clientId) {
        console.log(`Sending notification to ${client} (${token})...`);
        messages.push({
          ...notification,
          to: token,
          sound: "default",
        });
      }
    }
  });

  const resp = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (resp.status !== 200) {
    console.error("Error sending notifications: ", resp);
  }
}
