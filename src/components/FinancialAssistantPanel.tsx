"use client";

import { Bot, Lightbulb, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Budget } from "@/lib/budgets";
import {
  answerFinancialQuestion,
  currentPeriod,
  getAutomaticFinancialInsights,
} from "@/lib/financial-assistant";
import type { Debt, SavingsGoal } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type AssistantApiResponse = {
  ok: boolean;
  data?: {
    answer: string;
    source: "openai" | "local";
  };
  error?: string;
};

const quickQuestions = [
  "¿Puedo gastar RD$3,000 hoy?",
  "¿Cómo voy este mes?",
  "¿Cuál deuda debo pagar primero?",
  "¿Estoy gastando mucho?",
  "¿Cómo van mis metas de ahorro?",
];

function insightTone(tone: "good" | "warning" | "info") {
  if (tone === "good") return "assistant-insight-good";
  if (tone === "warning") return "assistant-insight-warning";
  return "assistant-insight-info";
}

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!json.ok) return fallback;
    return json.data as T;
  } catch {
    return fallback;
  }
}

export function FinancialAssistantPanel() {
  const transactions = useFinanceStore((state) => state.transactions);
  const messageIdRef = useRef(0);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hola, soy tu asistente financiero. Puedo revisar tus gastos, deudas, metas y presupuesto para darte recomendaciones claras.",
    },
  ]);

  useEffect(() => {
    Promise.all([
      fetchJson<Budget[]>("/api/budgets", []),
      fetchJson<Debt[]>("/api/debts", []),
      fetchJson<SavingsGoal[]>("/api/savings-goals", []),
    ]).then(([budgetData, debtData, goalData]) => {
      setBudgets(budgetData);
      setDebts(debtData);
      setGoals(goalData);
    });
  }, []);

  const context = useMemo(
    () => ({
      transactions,
      budgets,
      debts,
      goals,
      period: currentPeriod(),
      strategy: "avalanche" as const,
    }),
    [transactions, budgets, debts, goals]
  );

  const insights = useMemo(
    () => getAutomaticFinancialInsights(context),
    [context]
  );

  const ask = async (text: string) => {
    const clean = text.trim();
    if (!clean || isAsking) return;

    messageIdRef.current += 1;
    const nextId = messageIdRef.current;
    setMessages((prev) => [
      ...prev,
      { id: `u-${nextId}`, role: "user", content: clean },
    ]);
    setQuestion("");
    setIsAsking(true);

    try {
      const res = await fetch("/api/financial-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: clean, context }),
      });
      const json = (await res.json()) as AssistantApiResponse;
      if (!json.ok || !json.data?.answer) {
        throw new Error(json.error ?? "No se pudo generar la respuesta.");
      }
      const answer = json.data.answer;

      setMessages((prev) => [
        ...prev,
        { id: `a-${nextId}`, role: "assistant", content: answer },
      ]);
    } catch {
      const answer = answerFinancialQuestion(clean, context);
      setMessages((prev) => [
        ...prev,
        { id: `a-${nextId}`, role: "assistant", content: answer },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="assistant-hero p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="assistant-ai-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1">
              <Sparkles className="h-3.5 w-3.5" />
              IA financiera personalizada
            </div>
            <h2 className="mt-3 text-xl font-semibold">Asistente Financiero</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
              Haz preguntas en lenguaje natural y recibe respuestas basadas en tus datos reales.
            </p>
          </div>
          <div className="assistant-icon-tile rounded-2xl p-3 ring-1">
            <Bot className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="assistant-panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-200" />
              <h3 className="text-base font-semibold">Insights automaticos</h3>
            </div>
            <div className="space-y-3">
              {insights.length === 0 ? (
                <div className="assistant-empty-state rounded-2xl p-4 text-sm">
                  Aun no hay suficiente variacion para generar alertas. Sigue registrando tus movimientos.
                </div>
              ) : (
                insights.map((insight) => (
                  <div
                    key={`${insight.title}-${insight.message}`}
                    className={`assistant-insight rounded-2xl p-4 text-sm ${insightTone(insight.tone)}`}
                  >
                    <p className="font-semibold">{insight.title}</p>
                    <p className="mt-1 leading-6 opacity-85">{insight.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="assistant-panel p-5">
            <h3 className="text-base font-semibold">Preguntas rapidas</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickQuestions.map((item) => (
                <button
                  key={item}
                  onClick={() => void ask(item)}
                  className="assistant-quick-question rounded-full px-3 py-2 text-xs ring-1 transition"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="assistant-panel assistant-chat-panel flex min-h-[620px] flex-col p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold">Conversacion</h3>
            <p className="mt-1 text-sm text-white/55">
              Puedes preguntar sobre gastos, deudas, metas de ahorro o presupuesto.
            </p>
          </div>

          <div className="assistant-chat-window min-h-0 flex-1 space-y-3 overflow-y-auto rounded-3xl p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "assistant-message-user"
                      : "assistant-message-bot ring-1"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isAsking && (
              <div className="flex justify-start">
                <div className="assistant-message-bot max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ring-1">
                  Analizando tus datos financieros...
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void ask(question);
              }}
              placeholder="Ej. Estoy gastando mucho este mes?"
              disabled={isAsking}
              className="assistant-input min-h-11 flex-1 rounded-xl px-4 py-3 text-sm outline-none ring-1 focus:ring-2"
            />
            <button
              onClick={() => void ask(question)}
              disabled={isAsking}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {isAsking ? "Analizando" : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
