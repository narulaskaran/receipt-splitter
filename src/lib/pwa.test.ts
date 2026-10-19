import fs from "fs";
import path from "path";
import manifestRoute from "@/app/manifest";
import {
  PWA_BACKGROUND_DARK,
  PWA_BACKGROUND_LIGHT,
  PWA_THEME_COLORS,
} from "./pwa";

// OKLCH -> sRGB hex (https://bottosson.github.io/posts/oklab/).
function oklchToHex(l: number, c: number, hDeg: number): string {
  const a = c * Math.cos((hDeg * Math.PI) / 180);
  const b = c * Math.sin((hDeg * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const channel = (x: number) => {
    const clamped = Math.min(1, Math.max(0, x));
    const srgb =
      clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${linear.map(channel).join("")}`;
}

const css = fs.readFileSync(
  path.join(__dirname, "..", "app", "globals.css"),
  "utf8",
);

function cssBackground(selector: ":root" | ".dark"): string {
  const block = css.match(new RegExp(`^${selector.replace(".", "\\.")}\\s*{([^}]*)}`, "m"));
  const value = block?.[1].match(/--background:\s*oklch\(([^)]+)\)/)?.[1];
  if (!value) throw new Error(`No oklch --background in ${selector}`);
  const [l, c, h] = value.trim().split(/\s+/).map(Number);
  return oklchToHex(l, c, h);
}

describe("PWA colors", () => {
  it("match --background in globals.css for both themes", () => {
    expect(PWA_BACKGROUND_LIGHT).toBe(cssBackground(":root"));
    expect(PWA_BACKGROUND_DARK).toBe(cssBackground(".dark"));
  });

  it("are valid hex colors", () => {
    for (const color of [PWA_BACKGROUND_LIGHT, PWA_BACKGROUND_DARK]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("set the browser theme color for both color schemes", () => {
    expect(PWA_THEME_COLORS).toEqual([
      { media: "(prefers-color-scheme: light)", color: PWA_BACKGROUND_LIGHT },
      { media: "(prefers-color-scheme: dark)", color: PWA_BACKGROUND_DARK },
    ]);
  });

  it("are used by the manifest", () => {
    const manifest = manifestRoute();
    expect(manifest.theme_color).toBe(PWA_BACKGROUND_LIGHT);
    expect(manifest.background_color).toBe(PWA_BACKGROUND_LIGHT);
  });
});
