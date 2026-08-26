import { createWriteStream } from "node:fs";
import { access, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(rootDir, "package.json");
const manifestPath = path.join(rootDir, "komari-theme.json");
const previewPath = path.join(rootDir, "preview.png");
const distDir = path.join(rootDir, "dist");

const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const [packageJson, manifest] = await Promise.all([
  readJson(packagePath),
  readJson(manifestPath),
]);

if (packageJson.name !== "komari-theme-zen") {
  throw new Error(
    `Unexpected package name: ${packageJson.name ?? "<missing>"}`,
  );
}

if (!packageJson.version || packageJson.version !== manifest.version) {
  throw new Error(
    `Version mismatch: package.json=${packageJson.version ?? "<missing>"}, ` +
      `komari-theme.json=${manifest.version ?? "<missing>"}`,
  );
}

if (
  process.env.GITHUB_REF_TYPE === "tag" &&
  process.env.GITHUB_REF_NAME !== `v${packageJson.version}`
) {
  throw new Error(
    `Tag mismatch: ${process.env.GITHUB_REF_NAME} does not match v${packageJson.version}`,
  );
}

await Promise.all([access(manifestPath), access(previewPath), access(distDir)]);

const artifactPattern = /^zen-theme-v.*\.zip$/i;
const rootEntries = await readdir(rootDir, { withFileTypes: true });
await Promise.all(
  rootEntries
    .filter((entry) => entry.isFile() && artifactPattern.test(entry.name))
    .map((entry) => rm(path.join(rootDir, entry.name))),
);

const artifactName = `zen-theme-v${packageJson.version}.zip`;
const artifactPath = path.join(rootDir, artifactName);
const output = createWriteStream(artifactPath);
const archive = new ZipArchive({ zlib: { level: 9 } });

await new Promise((resolve, reject) => {
  output.once("close", resolve);
  output.once("error", reject);
  archive.once("warning", reject);
  archive.once("error", reject);
  archive.pipe(output);
  archive.file(manifestPath, { name: "komari-theme.json" });
  archive.file(previewPath, { name: "preview.png" });
  archive.directory(distDir, "dist");
  archive.finalize().catch(reject);
});

console.log(`Created ${artifactName} (${archive.pointer()} bytes)`);
