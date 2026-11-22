import { randomUUID } from "node:crypto";
import { chatRequestSchema } from "@/src/contracts/chat";
import { handleChat } from "@/src/server/chat";
import { errorResponse, readJsonRequest, RequestError } from "@/src/server/request";
import { InvalidLocalChatPlanError, LocalModelUnavailableError } from "@/src/ai/provider";
import {
  ChatBusyError,
  ChatCancelledError,
  ChatTimeoutError,
  runChatRequest,
} from "@/src/server/chat-runtime";

// Sin maxDuration: la inferencia LFM3 local puede superar 90 s en el POC.
// Pilot access control is enforced by the configured gateway/proxy, not by this handler.
const json = (body: unknown, status: number, requestId: string) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
  });

export async function POST(request: Request) {
  const requestId = randomUUID();
  let stage: "provider-plan" | "statistics" | "compare" | "semantic" | "metadata" | "request" = "request";

  try {
    return await runChatRequest(async (signal) => {
      let body: unknown;
      try {
        body = await readJsonRequest(request, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        return errorResponse(error instanceof RequestError
          ? error
          : new RequestError(400, "VALIDATION_ERROR", "No se pudo leer la solicitud."), requestId);
      }

      const parsed = chatRequestSchema.safeParse(body);
      if (!parsed.success) {
        return json({ error: { code: "VALIDATION_ERROR", message: "La solicitud no cumple el contrato." }, requestId }, 400, requestId);
      }

      try {
        return json(await handleChat(parsed.data, requestId, signal, (value) => { stage = value; }), 200, requestId);
      } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof LocalModelUnavailableError) {
          return errorResponse(new RequestError(503, "LOCAL_MODEL_UNAVAILABLE", error.message), requestId);
        }
        if (error instanceof InvalidLocalChatPlanError) {
          return errorResponse(new RequestError(502, "LOCAL_MODEL_INVALID_PLAN", error.message), requestId);
        }
        console.error("Chat dependency failure", {
          requestId,
          stage,
          errorName: error instanceof Error ? error.name : typeof error,
        });
        return json({ error: { code: "DEPENDENCY_UNAVAILABLE", message: "El servicio de chat no está disponible." }, requestId }, 503, requestId);
      }
    }, request.signal);
  } catch (error) {
    if (error instanceof ChatBusyError) {
      return Response.json(
        { error: { code: "BUSY", message: "El servicio de chat está ocupado." }, requestId },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "1", "X-Request-Id": requestId } },
      );
    }
    if (error instanceof ChatTimeoutError) {
      return json({ error: { code: "TIME_BUDGET_EXCEEDED", message: "La solicitud de chat excedió el presupuesto de tiempo." }, requestId }, 504, requestId);
    }
    if (error instanceof ChatCancelledError) {
      return json({ error: { code: "REQUEST_CANCELLED", message: "La solicitud de chat fue cancelada." }, requestId }, 499, requestId);
    }
    console.error("Chat dependency failure", {
      requestId,
      stage,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json({ error: { code: "DEPENDENCY_UNAVAILABLE", message: "El servicio de chat no está disponible." }, requestId }, 503, requestId);
  }
}
