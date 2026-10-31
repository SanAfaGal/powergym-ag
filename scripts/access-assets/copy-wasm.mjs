// Copies the WASM runtimes used by the facial access-control module into
// public/ so the browser loads them same-origin (no CDN, works offline on the
// local network). Output dirs are git-ignored; this runs before dev/build.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const nm = (p) => resolve(root, "node_modules", p);

const ortDist = nm("onnxruntime-web/dist");
const mediapipeWasm = nm("@mediapipe/tasks-vision/wasm");

if (!existsSync(ortDist) || !existsSync(mediapipeWasm)) {
  console.warn("copy-wasm: vision dependencies not installed, skipping");
  process.exit(0);
}

mkdirSync(resolve(root, "public/ort"), { recursive: true });
for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  cpSync(resolve(ortDist, file), resolve(root, "public/ort", file));
}
cpSync(mediapipeWasm, resolve(root, "public/mediapipe/wasm"), { recursive: true });
console.log("copy-wasm: ORT and MediaPipe WASM copied to public/");
