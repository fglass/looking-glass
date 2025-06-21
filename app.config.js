const BUNDLE_IDENTIFIER = process.env.BUNDLE_IDENTIFIER;
const APP_VARIANT = process.env.APP_VARIANT;
const IS_DEV = APP_VARIANT === "development";
const IS_PREVIEW = APP_VARIANT === "preview";

const getUniqueIdentifier = () => `${BUNDLE_IDENTIFIER}.${APP_VARIANT}`;

const getIcon = () => {
  if (IS_DEV || IS_PREVIEW) {
    return "./assets/icon.png";
  }

  return "./assets/icon-inv.png";
};

export default {
  name: "Looking Glass",
  slug: "looking-glass",
  version: "1.0.2",
  orientation: "portrait",
  icon: getIcon(),
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: { supportsTablet: true, bundleIdentifier: getUniqueIdentifier() },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: getUniqueIdentifier(),
  },
  plugins: [
    [
      "expo-camera",
      { cameraPermission: "Allow $(PRODUCT_NAME) to access your camera" },
    ],
  ],
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID } },
  infoPlist: { RCTAsyncStorageExcludeFromBackup: false },
};
