export const EMBEDDING_DIM = 512;

function sumOfSquares(v: number[]): number {
  let sum = 0;
  for (const x of v) sum += x * x;
  return sum;
}

export function isValidEmbedding(v: unknown): v is number[] {
  if (!Array.isArray(v) || v.length !== EMBEDDING_DIM) return false;
  for (const x of v) {
    if (typeof x !== "number" || !Number.isFinite(x)) return false;
  }
  return sumOfSquares(v as number[]) > 0;
}

export function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(sumOfSquares(v));
  if (!(norm > 0) || !Number.isFinite(norm)) throw new Error("zero vector");
  return v.map((x) => x / norm);
}

// Mean of several captures, renormalized: the averaged vector is not unit
// length on its own, and similarity is computed as cosine.
export function averageEmbeddings(vs: number[][]): number[] {
  if (vs.length === 0) throw new Error("no embeddings");
  const sum = new Array<number>(vs[0].length).fill(0);
  for (const v of vs) {
    if (v.length !== sum.length) throw new Error("dimension mismatch");
    for (let i = 0; i < v.length; i++) sum[i] += v[i];
  }
  return l2Normalize(sum.map((x) => x / vs.length));
}

// pgvector's text input format, e.g. "[1,0.5,0]".
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("dimension mismatch");
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!(na > 0) || !(nb > 0)) throw new Error("zero vector");
  return dot / Math.sqrt(na * nb);
}
