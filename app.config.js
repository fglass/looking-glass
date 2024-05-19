const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";
const BUNDLE_IDENTIFIER = process.env.BUNDLE_IDENTIFIER;

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return `${BUNDLE_IDENTIFIER}.dev`;
  }

  if (IS_PREVIEW) {
    return `${BUNDLE_IDENTIFIER}.preview`;
  }

  return BUNDLE_IDENTIFIER;
};

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
  ios: {
    supportsTablet: true,
    bundleIdentifier: getUniqueIdentifier(),
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: getUniqueIdentifier(),
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  infoPlist: {
    RCTAsyncStorageExcludeFromBackup: false,
  },
};
