// The registration photo: a small JPEG kept in the private 'client-photos'
// bucket, one per client, under the client's own folder.
export const PHOTO_BUCKET = "client-photos";
export const MAX_PHOTO_BYTES = 512 * 1024;

export function photoStoragePath(clientId: string, fileId: string): string {
  return `${clientId}/${fileId}.jpg`;
}

// null when the file is acceptable, otherwise the reason (user-facing).
export function checkPhoto(file: { type: string; size: number }): string | null {
  if (file.type !== "image/jpeg") return "La foto debe ser una imagen JPEG";
  if (file.size <= 0) return "La foto está vacía";
  if (file.size > MAX_PHOTO_BYTES) return "La foto es demasiado pesada";
  return null;
}
