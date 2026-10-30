import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_PLUGINS = [
  "CapacitorApp",
  "CapacitorBrowser",
  "CapacitorCamera",
  "CapacitorClipboard",
  "CapacitorKeyboard",
  "CapacitorPreferences",
  "CapacitorShare",
  "CapacitorStatusBar",
];

const DIST_TEXT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".txt",
  ".map",
  ".svg",
  ".mjs",
  ".cjs",
]);

/**
 * Validate the committed Capacitor iOS project. Missing optional build
 * outputs (dist-mobile, generated capacitor.config.json) are skipped.
 * @param {string} rootDir
 * @returns {{ errors: string[] }}
 */
export function checkIosProject(rootDir) {
  const errors = [];
  const root = path.resolve(rootDir);

  const appId = checkCapacitorConfig(root, errors);
  checkPbxproj(root, errors, appId);
  checkInfoPlist(root, errors);
  checkPrivacyManifest(root, errors);
  checkPackageSwift(root, errors);
  checkGeneratedCapacitorConfig(root, errors);
  checkDistMobile(root, errors);

  return { errors };
}

function readText(root, rel, errors) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    errors.push(`${rel} is missing`);
    return null;
  }
  return fs.readFileSync(file, "utf8");
}

function stripJsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function checkCapacitorConfig(root, errors) {
  const rel = "capacitor.config.ts";
  const source = readText(root, rel, errors);
  if (source == null) return null;

  const code = stripJsComments(source);
  const appIdMatch = code.match(/appId\s*:\s*["']([^"']+)["']/);
  const webDirMatch = code.match(/webDir\s*:\s*["']([^"']+)["']/);

  if (!appIdMatch) {
    errors.push(`${rel} is missing appId`);
  }
  if (!webDirMatch || webDirMatch[1] !== "dist-mobile") {
    errors.push(`${rel} webDir must be "dist-mobile"`);
  }
  if (/\bserver\s*:/.test(code)) {
    errors.push(
      `${rel} must not set server (no server.url / development server)`,
    );
  }
  if (/\bcleartext\s*:/.test(code)) {
    errors.push(`${rel} must not set cleartext`);
  }
  if (/\ballowNavigation\s*:/.test(code)) {
    errors.push(`${rel} must not set allowNavigation`);
  }

  return appIdMatch ? appIdMatch[1] : null;
}

function pbxValues(text, key) {
  const re = new RegExp(`${key}\\s*=\\s*([^;]+);`, "g");
  return [...text.matchAll(re)].map((match) =>
    match[1].trim().replace(/^"|"$/g, ""),
  );
}

function checkPbxproj(root, errors, appId) {
  const rel = "ios/App/App.xcodeproj/project.pbxproj";
  const text = readText(root, rel, errors);
  if (text == null) return;

  const targets = pbxValues(text, "IPHONEOS_DEPLOYMENT_TARGET");
  if (targets.length === 0) {
    errors.push(`${rel} is missing IPHONEOS_DEPLOYMENT_TARGET`);
  } else if (targets.some((value) => value !== "26.0")) {
    errors.push(
      `${rel} IPHONEOS_DEPLOYMENT_TARGET must be 26.0 everywhere (found ${targets.join(", ")})`,
    );
  }

  const families = pbxValues(text, "TARGETED_DEVICE_FAMILY");
  if (families.length === 0) {
    errors.push(`${rel} is missing TARGETED_DEVICE_FAMILY`);
  } else if (families.some((value) => value !== "1")) {
    errors.push(
      `${rel} TARGETED_DEVICE_FAMILY must be 1 only (found ${families.join(", ")})`,
    );
  }

  const bundles = pbxValues(text, "PRODUCT_BUNDLE_IDENTIFIER");
  if (bundles.length === 0) {
    errors.push(`${rel} is missing PRODUCT_BUNDLE_IDENTIFIER`);
  } else if (!appId) {
    errors.push(
      `${rel} bundle id cannot be checked because capacitor.config.ts has no appId`,
    );
  } else if (bundles.some((value) => value !== appId)) {
    errors.push(
      `${rel} PRODUCT_BUNDLE_IDENTIFIER must match appId ${appId} (found ${bundles.join(", ")})`,
    );
  }

  const marketing = pbxValues(text, "MARKETING_VERSION");
  if (marketing.length === 0) {
    errors.push(`${rel} is missing MARKETING_VERSION`);
  } else if (
    marketing.some((value) => !/^\d+\.\d+(\.\d+)?$/.test(value))
  ) {
    errors.push(
      `${rel} MARKETING_VERSION must be numeric semver-ish (found ${marketing.join(", ")})`,
    );
  }

  const build = pbxValues(text, "CURRENT_PROJECT_VERSION");
  if (build.length === 0) {
    errors.push(`${rel} is missing CURRENT_PROJECT_VERSION`);
  } else if (build.some((value) => !/^\d+$/.test(value))) {
    errors.push(
      `${rel} CURRENT_PROJECT_VERSION must be an integer (found ${build.join(", ")})`,
    );
  }
}

function checkInfoPlist(root, errors) {
  const rel = "ios/App/App/Info.plist";
  const xml = readText(root, rel, errors);
  if (xml == null) return;

  let plist;
  try {
    plist = parsePlist(xml);
  } catch (error) {
    errors.push(
      `${rel} failed to parse: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  if (!plist || typeof plist !== "object" || Array.isArray(plist)) {
    errors.push(`${rel} must contain a top-level dict`);
    return;
  }

  for (const key of ["NSCameraUsageDescription", "NSPhotoLibraryUsageDescription"]) {
    const value = plist[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`${rel} ${key} must be a non-empty string`);
    }
  }

  if (plist.ITSAppUsesNonExemptEncryption !== false) {
    errors.push(`${rel} ITSAppUsesNonExemptEncryption must be false`);
  }

  const schemes = plist.LSApplicationQueriesSchemes;
  if (!Array.isArray(schemes) || !schemes.includes("venmo")) {
    errors.push(`${rel} LSApplicationQueriesSchemes must contain venmo`);
  }

  if (
    Object.prototype.hasOwnProperty.call(
      plist,
      "UISupportedInterfaceOrientations~ipad",
    ) ||
    xml.includes("UISupportedInterfaceOrientations~ipad")
  ) {
    errors.push(`${rel} must not declare an iPad orientation key`);
  }

  if (!requiresArm64(plist.UIRequiredDeviceCapabilities)) {
    errors.push(`${rel} UIRequiredDeviceCapabilities must include arm64`);
  }
}

function requiresArm64(value) {
  if (Array.isArray(value)) return value.includes("arm64");
  if (value && typeof value === "object") return value.arm64 === true;
  return false;
}

function checkPrivacyManifest(root, errors) {
  const rel = "ios/App/App/PrivacyInfo.xcprivacy";
  const pbxRel = "ios/App/App.xcodeproj/project.pbxproj";
  const xml = readText(root, rel, errors);
  const pbxPath = path.join(root, pbxRel);
  const pbx = fs.existsSync(pbxPath) ? fs.readFileSync(pbxPath, "utf8") : "";

  const resources = pbx
    .split("/* Begin PBXResourcesBuildPhase section */")[1]
    ?.split("/* End PBXResourcesBuildPhase section */")[0];
  if (!resources || !resources.includes("PrivacyInfo.xcprivacy in Resources")) {
    errors.push(
      `${pbxRel} Resources phase must reference PrivacyInfo.xcprivacy`,
    );
  }

  if (xml == null) return;

  let manifest;
  try {
    manifest = parsePlist(xml);
  } catch (error) {
    errors.push(
      `${rel} failed to parse: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  if (manifest?.NSPrivacyTracking !== false) {
    errors.push(`${rel} NSPrivacyTracking must be false`);
  }
}

function checkPackageSwift(root, errors) {
  const rel = "ios/App/CapApp-SPM/Package.swift";
  const source = readText(root, rel, errors);
  if (source == null) return;

  for (const plugin of EXPECTED_PLUGINS) {
    if (!source.includes(plugin)) {
      errors.push(`${rel} must list ${plugin}`);
    }
  }

  const tipJar = path.join(root, "packages/capacitor-tip-jar");
  if (fs.existsSync(tipJar) && fs.statSync(tipJar).isDirectory()) {
    if (!source.includes("CapacitorTipJar")) {
      errors.push(
        `${rel} must list CapacitorTipJar because packages/capacitor-tip-jar exists`,
      );
    }
  }
}

function checkGeneratedCapacitorConfig(root, errors) {
  const rel = "ios/App/App/capacitor.config.json";
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return;

  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(
      `${rel} failed to parse: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  if (json && Object.prototype.hasOwnProperty.call(json, "server")) {
    errors.push(`${rel} must not contain a server key`);
  }
}

function checkDistMobile(root, errors) {
  const rel = "dist-mobile";
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;

  if (!fs.existsSync(path.join(dir, "index.html"))) {
    errors.push(`${rel}/index.html is missing`);
  }

  const offenders = [];
  walkTextFiles(dir, (file) => {
    const ext = path.extname(file).toLowerCase();
    if (!DIST_TEXT_EXTENSIONS.has(ext)) return;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes("http://localhost")) {
      offenders.push(path.relative(dir, file));
    }
  });
  if (offenders.length > 0) {
    errors.push(
      `${rel} must not reference http://localhost (found ${offenders.slice(0, 5).join(", ")})`,
    );
  }
}

function walkTextFiles(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTextFiles(full, visit);
    else if (entry.isFile()) visit(full);
  }
}

function decodeXml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tokenizePlist(xml) {
  const tokens = [];
  const re =
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<\/([A-Za-z0-9]+)>|<([A-Za-z0-9]+)(\s[^>]*?)?\s*(\/?)>|([^<]+)/g;
  let match;
  while ((match = re.exec(xml))) {
    const raw = match[0];
    if (
      raw.startsWith("<!--") ||
      raw.startsWith("<?") ||
      raw.startsWith("<!")
    ) {
      continue;
    }
    if (match[1]) tokens.push({ type: "close", name: match[1] });
    else if (match[2]) {
      tokens.push({
        type: match[4] === "/" ? "empty" : "open",
        name: match[2],
      });
    } else if (match[5] && match[5].trim()) {
      tokens.push({ type: "text", text: decodeXml(match[5]) });
    }
  }
  return tokens;
}

function parseValue(tokens, index) {
  const token = tokens[index];
  if (!token) throw new Error("unexpected end of plist");

  if (token.type === "empty" && token.name === "true") {
    return { value: true, index: index + 1 };
  }
  if (token.type === "empty" && token.name === "false") {
    return { value: false, index: index + 1 };
  }
  if (token.type === "empty" && token.name === "array") {
    return { value: [], index: index + 1 };
  }
  if (token.type === "empty" && token.name === "dict") {
    return { value: {}, index: index + 1 };
  }
  if (token.type === "empty" && token.name === "string") {
    return { value: "", index: index + 1 };
  }

  if (
    token.type === "open" &&
    (token.name === "string" ||
      token.name === "integer" ||
      token.name === "real" ||
      token.name === "date" ||
      token.name === "data")
  ) {
    let text = "";
    let cursor = index + 1;
    while (tokens[cursor] && tokens[cursor].type !== "close") {
      if (tokens[cursor].type === "text") text += tokens[cursor].text;
      cursor += 1;
    }
    if (!tokens[cursor] || tokens[cursor].name !== token.name) {
      throw new Error(`unclosed <${token.name}>`);
    }
    let value = text;
    if (token.name === "integer") value = Number.parseInt(text, 10);
    if (token.name === "real") value = Number.parseFloat(text);
    return { value, index: cursor + 1 };
  }

  if (token.type === "open" && token.name === "array") {
    const value = [];
    let cursor = index + 1;
    while (
      tokens[cursor] &&
      !(tokens[cursor].type === "close" && tokens[cursor].name === "array")
    ) {
      const parsed = parseValue(tokens, cursor);
      value.push(parsed.value);
      cursor = parsed.index;
    }
    if (!tokens[cursor]) throw new Error("unclosed <array>");
    return { value, index: cursor + 1 };
  }

  if (token.type === "open" && token.name === "dict") {
    const value = {};
    let cursor = index + 1;
    while (
      tokens[cursor] &&
      !(tokens[cursor].type === "close" && tokens[cursor].name === "dict")
    ) {
      if (tokens[cursor].type !== "open" || tokens[cursor].name !== "key") {
        throw new Error("expected <key> in dict");
      }
      let key = "";
      cursor += 1;
      while (tokens[cursor] && tokens[cursor].type !== "close") {
        if (tokens[cursor].type === "text") key += tokens[cursor].text;
        cursor += 1;
      }
      if (!tokens[cursor] || tokens[cursor].name !== "key") {
        throw new Error("unclosed <key>");
      }
      cursor += 1;
      const parsed = parseValue(tokens, cursor);
      value[key] = parsed.value;
      cursor = parsed.index;
    }
    if (!tokens[cursor]) throw new Error("unclosed <dict>");
    return { value, index: cursor + 1 };
  }

  throw new Error(`unexpected plist token <${token.name}>`);
}

export function parsePlist(xml) {
  const tokens = tokenizePlist(xml);
  const start = tokens.findIndex(
    (token) => token.type === "open" && token.name === "plist",
  );
  if (start === -1) throw new Error("missing <plist>");
  const parsed = parseValue(tokens, start + 1);
  return parsed.value;
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const result = checkIosProject(process.cwd());
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`ios check: ${error}`);
    }
    process.exit(1);
  }
  console.log("ios check: ok");
}
