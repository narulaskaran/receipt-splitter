import type { PlatformAdapter } from "./types";
import { webPlatform } from "./web";

export * from "./types";
export { webPlatform };

let current: PlatformAdapter = webPlatform;

/** Called once by the native entrypoint (src/mobile/main.tsx) and by tests. */
export function setPlatform(platform: PlatformAdapter): void {
  current = platform;
}

export function getPlatform(): PlatformAdapter {
  return current;
}
