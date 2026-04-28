"use client";

import { Bot, Lightbulb, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

const quickQuestions = [
  "¿Puedo gastar RD$3,000 hoy?",
  "¿Cómo voy este mes?",
  "¿Cuál deuda debo pagar primero?",
  "¿Estoy gastando mucho?",
  "¿Cómo van mis metas de ahorro?",
];

function insightTone(tone: "good" | "warning" | "info") {
  if (tone === "good") return "bg-emerald-400/10 text-emerald-100 ring-emerald-300/20";
  if (tone === "warning") return "bg-amber-400/10 text-amber-100 ring-amber-300/20";
  return "bg-cyan-400/10 text-cyan-100 ring-cyan-300/20";
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [question, setQuestion] = useState("");
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

  const ask = (text: string) => {
    const clean = text.trim();
    if (!clean) return;

    const answer = answerFinancialQuestion(clean, context);
    const now = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `u-${now}`, role: "user", content: clean },
      { id: `a-${now}`, role: "assistant", content: answer },
    ]);
    setQuestion("");
  };

  return (
    <section className="space-y-4">
      <div className="glass p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-300/20">
              <Sparkles className="h-3.5 w-3.5" />
              IA financiera personalizada
            </div>
            <h2 className="mt-3 text-xl font-semibold">Asistente Financiero</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
              Haz preguntas en lenguaje natural y recibe respuestas basadas en tus datos reales.
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 p-3 text-cyan-100 ring-1 ring-white/10">
            <Bot className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="glass p-5">
            <div className="mb-4 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-200" />
              <h3 className="text-base font-semibold">Insights automaticos</h3>
            </div>
            <div className="space-y-3">
              {insights.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-white/55 ring-1 ring-white/10">
                  Aun no hay suficiente variacion para generar alertas. Sigue registrando tus movimientos.
                </div>
              ) : (
                insights.map((insight) => (
                  <div
                    key={`${insight.title}-${insight.message}`}
                    className={`rounded-2xl p-4 text-sm ring-1 ${insightTone(insight.tone)}`}
                  >
                    <p className="font-semibold">{insight.title}</p>
                    <p className="mt-1 leading-6 opacity-85">{insight.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass p-5">
            <h3 className="text-base font-semibold">Preguntas rapidas</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickQuestions.map((item) => (
                <button
                  key={item}
                  onClick={() => ask(item)}
                  className="rounded-full bg-white/5 px-3 py-2 text-xs text-white/75 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="glass flex min-h-[620px] flex-col p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold">Conversacion</h3>
            <p className="mt-1 text-sm text-white/55">
              Puedes preguntar sobre gastos, deudas, metas de ahorro o presupuesto.
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-cyan-300 text-slate-950"
                      : "bg-white/7 text-white ring-1 ring-white/10"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") ask(question);
              }}
              placeholder="Ej. Estoy gastando mucho este mes?"
              className="min-h-11 flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60"
            />
            <button
              onClick={() => ask(question)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              <Send className="h-4 w-4" />
              Enviar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
