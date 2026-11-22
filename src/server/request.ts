const MAX_BODY_BYTES = 64 * 1024;

export class RequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function readJsonRequest(request: Request, signal: AbortSignal = request.signal): Promise<unknown> {
  if (new URL(request.url).search) {
    throw new RequestError(400, "VALIDATION_ERROR", "No se admiten parámetros de consulta.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON.");
  }
  const length = request.headers.get("content-length");
  if (length !== null && Number(length) > MAX_BODY_BYTES) {
    throw new RequestError(413, "PAYLOAD_TOO_LARGE", "La solicitud excede el límite permitido.");
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    const cancel = () => { void reader.cancel(signal.reason).catch(() => {}); };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      while (true) {
        if (signal.aborted) throw signal.reason;
        const { done, value } = await reader.read();
        if (signal.aborted) throw signal.reason;
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
          void reader.cancel().catch(() => {});
          throw new RequestError(413, "PAYLOAD_TOO_LARGE", "La solicitud excede el límite permitido.");
        }
        chunks.push(value);
      }
    } finally {
      signal.removeEventListener("abort", cancel);
      reader.releaseLock();
    }
  }
  if (signal.aborted) throw signal.reason;
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new RequestError(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }
}

export function errorResponse(error: RequestError, requestId: string): Response {
  return Response.json(
    { error: { code: error.code, message: error.message }, requestId },
    { status: error.status, headers: { "Cache-Control": "no-store" } },
  );
}
