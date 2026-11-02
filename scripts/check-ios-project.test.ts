/**
 * @jest-environment node
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(__dirname, "..");
const script = path.join(repoRoot, "scripts/check-ios-project.mjs");

function checkIosProject(rootDir: string): { errors: string[] } {
  const loader = `
    import { checkIosProject } from ${JSON.stringify(pathToFileURL(script).href)};
    const result = checkIosProject(process.argv[1]);
    if (!result || !Array.isArray(result.errors)) {
      throw new Error("checkIosProject must return { errors }");
    }
    process.stdout.write(JSON.stringify(result));
  `;
  const res = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", loader, rootDir],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || "checkIosProject failed");
  }
  return JSON.parse(res.stdout) as { errors: string[] };
}

const FIXTURE_FILES = [
  "capacitor.config.ts",
  "ios/App/App.xcodeproj/project.pbxproj",
  "ios/App/App/Info.plist",
  "ios/App/App/PrivacyInfo.xcprivacy",
  "ios/App/CapApp-SPM/Package.swift",
];

function stageFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ios-check-"));
  for (const rel of FIXTURE_FILES) {
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, rel), dest);
  }
  return dir;
}

describe("checkIosProject", () => {
  it("accepts the committed iOS project", () => {
    expect(checkIosProject(repoRoot).errors).toEqual([]);
  });

  it("rejects a development server, a bad deployment target, and a missing camera string", () => {
    const dir = stageFixture();
    try {
      const configPath = path.join(dir, "capacitor.config.ts");
      fs.appendFileSync(
        configPath,
        `\nconst dev = { server: { url: "http://localhost:3000", cleartext: true }, allowNavigation: ["localhost"] };\n`,
      );
      const pbxPath = path.join(dir, "ios/App/App.xcodeproj/project.pbxproj");
      fs.writeFileSync(
        pbxPath,
        fs.readFileSync(pbxPath, "utf8").replaceAll(
          "IPHONEOS_DEPLOYMENT_TARGET = 26.0;",
          "IPHONEOS_DEPLOYMENT_TARGET = 15.0;",
        ),
      );
      const plistPath = path.join(dir, "ios/App/App/Info.plist");
      fs.writeFileSync(
        plistPath,
        fs
          .readFileSync(plistPath, "utf8")
          .replace(
            /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]*<\/string>/,
            "<key>NSCameraUsageDescription</key><string>   </string>",
          ),
      );

      const { errors } = checkIosProject(dir);
      expect(errors.join("\n")).toMatch(/must not set server/);
      expect(errors.join("\n")).toMatch(/must not set cleartext/);
      expect(errors.join("\n")).toMatch(/must not set allowNavigation/);
      expect(errors.join("\n")).toMatch(/IPHONEOS_DEPLOYMENT_TARGET must be 26\.0/);
      expect(errors.join("\n")).toMatch(/NSCameraUsageDescription must be a non-empty string/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("requires CapacitorTipJar only when the package directory exists", () => {
    const dir = stageFixture();
    try {
      fs.mkdirSync(path.join(dir, "packages/capacitor-tip-jar"), {
        recursive: true,
      });
      const spmPath = path.join(dir, "ios/App/CapApp-SPM/Package.swift");
      fs.writeFileSync(
        spmPath,
        fs
          .readFileSync(spmPath, "utf8")
          .split("\n")
          .filter((line) => !line.includes("CapacitorTipJar"))
          .join("\n"),
      );
      const { errors } = checkIosProject(dir);
      expect(errors).toEqual([
        expect.stringContaining("must list CapacitorTipJar"),
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a generated server config and localhost in dist-mobile", () => {
    const dir = stageFixture();
    try {
      const generated = path.join(dir, "ios/App/App/capacitor.config.json");
      fs.mkdirSync(path.dirname(generated), { recursive: true });
      fs.writeFileSync(
        generated,
        JSON.stringify({ appId: "app.receiptsplitter.ios", server: { url: "http://10.0.2.2:3000" } }),
      );
      const dist = path.join(dir, "dist-mobile");
      fs.mkdirSync(dist, { recursive: true });
      fs.writeFileSync(
        path.join(dist, "index.html"),
        '<script src="http://localhost:5173/main.js"></script>',
      );

      const { errors } = checkIosProject(dir);
      expect(errors.join("\n")).toMatch(/must not contain a server key/);
      expect(errors.join("\n")).toMatch(/must not reference http:\/\/localhost/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits non-zero with a message when the project is incomplete", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ios-check-cli-"));
    try {
      const res = spawnSync(process.execPath, [script], {
        cwd: dir,
        encoding: "utf8",
      });
      expect(res.status).not.toBe(0);
      expect(res.stderr).toMatch(/ios check: capacitor\.config\.ts is missing/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
