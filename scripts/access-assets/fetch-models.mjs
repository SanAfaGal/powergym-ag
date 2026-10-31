// Downloads the vision models into public/models/ when they are missing.
// The binaries are not versioned (see docs/access-control/models.md), so a
// fresh checkout or a CI/Netlify build would otherwise ship without them and
// the kiosk would not work.
//
// Skipped when NEXT_PUBLIC_MODELS_BASE_URL is set: the models are then served
// from that external host and must not be bundled into the deploy.
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dir = resolve(root, "public/models");

const MODELS = [
  {
    file: "glintr100.onnx",
    url: "https://huggingface.co/fal/AuraFace-v1/resolve/main/glintr100.onnx",
    sha256: "a7933ea5330113b01c9b60351d8f4c33003f145d8470ac5f0e52ee2effe25c60",
  },
  {
    file: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  },
];

if (process.env.NEXT_PUBLIC_MODELS_BASE_URL) {
  console.log("fetch-models: NEXT_PUBLIC_MODELS_BASE_URL is set, skipping");
  process.exit(0);
}

mkdirSync(dir, { recursive: true });

for (const { file, url, sha256 } of MODELS) {
  const target = resolve(dir, file);
  if (existsSync(target)) continue;

  console.log(`fetch-models: downloading ${file}...`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    console.error(`fetch-models: ${url} answered ${response.status}`);
    process.exit(1);
  }

  const partial = `${target}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));

  if (sha256) {
    const actual = createHash("sha256").update(await readFile(partial)).digest("hex");
    if (actual !== sha256) {
      rmSync(partial);
      console.error(`fetch-models: checksum mismatch for ${file}`);
      process.exit(1);
    }
  }
  renameSync(partial, target);
}
console.log("fetch-models: models ready in public/models/");
