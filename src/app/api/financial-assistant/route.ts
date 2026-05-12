import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  answerFinancialQuestion,
  buildFinancialAdvisorBrief,
  type AssistantContext,
} from "@/lib/financial-assistant";

export const dynamic = "force-dynamic";

type AssistantRequestBody = {
  question?: unknown;
  context?: AssistantContext;
};

type ResponseTextContent = {
  type?: string;
  text?: unknown;
};

type ResponseOutputItem = {
  content?: ResponseTextContent[];
};

type OpenAIResponseBody = {
  output_text?: unknown;
  output?: ResponseOutputItem[];
  error?: {
    message?: unknown;
  };
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error";
}

function extractOutputText(payload: OpenAIResponseBody) {
  if (typeof payload.output_text === "string") return payload.output_text;

  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => (typeof content.text === "string" ? content.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function createAdvisorInstructions() {
  return [
    "Eres un asesor financiero personal para una app de finanzas personales en Republica Dominicana.",
    "Responde siempre en espanol claro, cercano y accionable.",
    "Usa solamente los datos financieros provistos en el contexto. Si falta un dato, dilo y trabaja con lo disponible.",
    "Prioriza recomendaciones concretas: gastos a cortar, categorias a vigilar, presupuesto, ahorro, deudas y proximos pasos.",
    "Cuando recomiendes recortes, menciona categorias especificas y montos aproximados si el contexto lo permite.",
    "No prometas resultados garantizados, no des asesoria legal/fiscal, y evita sonar generico.",
    "Formato ideal: diagnostico breve, 2 a 4 acciones concretas, y una pregunta de seguimiento util.",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as AssistantRequestBody;
    const question = String(body.question ?? "").trim();
    const context = body.context;

    if (!question || !context) {
      return NextResponse.json(
        { ok: false, error: "Falta la pregunta o el contexto financiero." },
        { status: 400 }
      );
    }

    const fallback = answerFinancialQuestion(question, context);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        data: {
          answer: fallback,
          source: "local",
        },
      });
    }

    const advisorBrief = buildFinancialAdvisorBrief(question, context);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5",
        reasoning: { effort: "low" },
        instructions: createAdvisorInstructions(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(advisorBrief),
              },
            ],
          },
        ],
        max_output_tokens: 700,
      }),
    });

    const payload = (await response.json()) as OpenAIResponseBody;
    if (!response.ok) {
      console.error("OpenAI financial assistant error:", payload.error?.message);
      return NextResponse.json({
        ok: true,
        data: {
          answer: fallback,
          source: "local",
        },
      });
    }

    const answer = extractOutputText(payload) || fallback;
    return NextResponse.json({
      ok: true,
      data: {
        answer,
        source: answer === fallback ? "local" : "openai",
      },
    });
  } catch (error) {
    console.error("API /financial-assistant POST error:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 500 }
    );
  }
}
