import { chatRequestSchema, chatResponseSchema } from "../../../src/contracts/chat.ts";
import { errorResponseSchema } from "../../../src/contracts/common.ts";
import { handleChatQuestion } from "../../../src/ai/chat-service.ts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "INVALID_JSON",
          message: "El cuerpo de la solicitud no es un JSON válido.",
        },
        requestId,
      }),
      { status: 400 }
    );
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
      acc[issue.path.join(".")] = issue.message;
      return acc;
    }, {});

    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "VALIDATION_FAILED",
          message: "La solicitud no cumple con los contratos de validación de chat.",
          fields: errorDetails,
        },
        requestId,
      }),
      { status: 400 }
    );
  }

  try {
    const chatResult = await handleChatQuestion(parsed.data);
    const validated = chatResponseSchema.parse(chatResult);

    return Response.json(validated, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Chat endpoint error:", error);
    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "INTERNAL_ERROR",
          message: "Ocurrió un error inesperado al procesar la consulta del asistente.",
        },
        requestId,
      }),
      { status: 500 }
    );
  }
}
