import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/playwright-core/**/*",
      "./node_modules/@sparticuz/chromium/**/*",
      "./node_modules/onnxruntime-node/**/*",
      "./node_modules/@huggingface/transformers/**/*",
      "./node_modules/@browser-ai/transformers-js/**/*",
      "./node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/**/*",
      "./node_modules/.pnpm/@huggingface+transformers@*/node_modules/@huggingface/transformers/**/*",
      "./node_modules/.pnpm/@browser-ai+transformers-js@*/node_modules/@browser-ai/transformers-js/**/*",
      "./node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**/*",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**/*",
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
