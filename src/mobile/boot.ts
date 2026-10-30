import {
  configureApp,
  DEFAULT_PUBLIC_ORIGIN,
  type AppConfig,
} from "@/lib/app-config";

export interface MobileViteEnv {
  VITE_API_ORIGIN?: string;
  VITE_PUBLIC_ORIGIN?: string;
  VITE_APP_VERSION?: string;
}

export function iosAppConfig(env: MobileViteEnv): AppConfig {
  return {
    platform: "ios",
    apiOrigin: env.VITE_API_ORIGIN || DEFAULT_PUBLIC_ORIGIN,
    publicOrigin: env.VITE_PUBLIC_ORIGIN || DEFAULT_PUBLIC_ORIGIN,
    appVersion: env.VITE_APP_VERSION || null,
  };
}

/**
 * Install the native platform adapter and hydrate the storage mirror.
 * A failure leaves the shared UI on localStorage and must not block startup.
 */
export async function bootNativeShell(): Promise<void> {
  try {
    const { bootNative } = await import("./native");
    await bootNative();
  } catch (error) {
    console.error(
      "Native boot failed; continuing with on-device storage only.",
      error
    );
  }
}

export function configureMobileApp(env: MobileViteEnv): void {
  configureApp(iosAppConfig(env));
}
