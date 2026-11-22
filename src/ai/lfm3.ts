import path from "node:path";
import { env } from "@huggingface/transformers";
import { transformersJS } from "@browser-ai/transformers-js";

env.allowLocalModels = true;
env.allowRemoteModels = false;

// ponytail: one shared q4/CPU instance; add a pool if parallel generations matter
export const lfm3 = transformersJS("Qwen3.5-0.8B-ONNX-OPT", {
  // ponytail: runtime model dir; opt out of bundling (keeps models/ and public/geo out of the trace)
  localModelPath: path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.LFM3_MODEL_DIR ?? "models"),
  device: "cpu",
  dtype: "q4",
  isVisionModel: true,
});
