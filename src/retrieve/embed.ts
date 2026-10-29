import { rankByVectors, type VectorHit } from "./vectors";

export type EmbedProgress = { ratio: number; label: string };

type Embedder = (texts: string[]) => Promise<number[][]>;

let pending: Promise<Embedder> | null = null;
let listener: ((progress: EmbedProgress) => void) | null = null;

function report(progress: EmbedProgress): void {
  listener?.(progress);
}

async function createEmbedder(): Promise<Embedder> {
  const mod = (await import("@huggingface/transformers")) as {
    pipeline: (
      task: string,
      model: string,
      options: { progress_callback?: (info: { status?: string; progress?: number; file?: string }) => void },
    ) => Promise<
      (
        texts: string[],
        options: { pooling: "mean"; normalize: true },
      ) => Promise<{ data: Float32Array; dims: number[] }>
    >;
    env: {
      allowLocalModels: boolean;
      useBrowserCache: boolean;
      backends?: { onnx?: { wasm?: { numThreads?: number } } };
    };
  };
  mod.env.allowLocalModels = false;
  mod.env.useBrowserCache = true;
  if (mod.env.backends?.onnx?.wasm) mod.env.backends.onnx.wasm.numThreads = 1;
  const extractor = await mod.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    progress_callback: (info) => {
      const ratio =
        info.status === "done"
          ? 1
          : typeof info.progress === "number"
            ? Math.max(0, Math.min(100, info.progress)) / 100
            : 0;
      report({ ratio, label: "Loading the meaning model" });
    },
  });
  return async (texts: string[]) => {
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    const width = output.dims[output.dims.length - 1] ?? 384;
    const vectors: number[][] = [];
    for (let row = 0; row < texts.length; row += 1) {
      vectors.push(Array.from(output.data.slice(row * width, (row + 1) * width)));
    }
    return vectors;
  };
}

export function loadEmbedder(onProgress?: (progress: EmbedProgress) => void): Promise<Embedder> {
  if (onProgress) listener = onProgress;
  if (!pending) {
    pending = createEmbedder().catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

export async function rankByMeaning(
  query: string,
  passages: string[],
  k: number,
  onProgress?: (progress: EmbedProgress) => void,
): Promise<VectorHit[]> {
  const embed = await loadEmbedder(onProgress);
  const vectors = await embed([query, ...passages]);
  const queryVector = vectors[0] ?? [];
  return rankByVectors(queryVector, vectors.slice(1), passages, k);
}
