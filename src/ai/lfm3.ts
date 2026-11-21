import path from "node:path";
import { transformersJS } from "@browser-ai/transformers-js";

// ponytail: one shared q4/CPU instance; add a pool if parallel generations matter
export const lfm3 = transformersJS("LFM3-1.7B-ONNX", {
  localModelPath: path.resolve(process.cwd(), process.env.LFM3_MODEL_DIR ?? "models"),
  device: "cpu",
  dtype: "q4",
});
