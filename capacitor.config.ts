import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the bundled iOS client.
 *
 * The app ships its own web assets (`dist-mobile`, built by `npm run mobile:build`)
 * and talks to the hosted Vercel API over HTTPS. There is deliberately no
 * `server.url`: a release build must never load a remote or development server.
 * See docs/ios/README.md.
 */
const config: CapacitorConfig = {
  // Placeholder until the bundle ID is reserved in App Store Connect; it must
  // match the Xcode project and the StoreKit product prefix (docs/ios/tips.md).
  appId: "app.receiptsplitter.ios",
  appName: "Receipt Splitter",
  webDir: "dist-mobile",
  ios: {
    contentInset: "never",
    // iPhone only (TARGETED_DEVICE_FAMILY = 1 in the Xcode project). The
    // default `capacitor://localhost` origin is what the API allows via CORS.
  },
  plugins: {
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;
