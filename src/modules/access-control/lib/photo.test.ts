import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PHOTO_BYTES, photoStoragePath, checkPhoto } from "./photo.ts";

const CLIENT = "20000000-0000-0000-0000-000000000002";

test("a photo lives in its client's own folder", () => {
  assert.equal(photoStoragePath(CLIENT, "abc"), `${CLIENT}/abc.jpg`);
});

test("checkPhoto accepts a small JPEG", () => {
  assert.equal(checkPhoto({ type: "image/jpeg", size: 60_000 }), null);
  assert.equal(checkPhoto({ type: "image/jpeg", size: MAX_PHOTO_BYTES }), null);
});

test("checkPhoto rejects other types, empty and oversized files", () => {
  assert.notEqual(checkPhoto({ type: "image/png", size: 1000 }), null);
  assert.notEqual(checkPhoto({ type: "image/jpeg", size: 0 }), null);
  assert.notEqual(checkPhoto({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 }), null);
});
