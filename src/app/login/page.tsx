"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { signIn } from "next-auth/react";
import logoIcon from "../icon.png";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  const submit = async () => {
    setLoading(true);
    setError("");

    try {
      if (isRegister) {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const json = await res.json();

        if (!json.ok) {
          throw new Error(json.error ?? "No se pudo crear la cuenta");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/",
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Correo o contrasena incorrectos.");
      }

      window.location.href = result?.url ?? "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error iniciando sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <div className="mb-6 flex justify-center">
          <Image
            src={logoIcon}
            alt="PropiaFinance"
            width={96}
            height={96}
            className="h-24 w-auto object-contain"
          />
        </div>

        <h1 className="text-center text-3xl font-bold">PropiaFinance</h1>
        <p className="mt-2 text-white/60">
          {isRegister
            ? "Crea tu cuenta para gestionar tus finanzas."
            : "Inicia sesion para acceder a tu dashboard financiero."}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
          <button
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              !isRegister
                ? "bg-white text-slate-950"
                : "text-white/65 hover:text-white"
            }`}
          >
            Iniciar sesion
          </button>
          <button
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              isRegister
                ? "bg-white text-slate-950"
                : "text-white/65 hover:text-white"
            }`}
          >
            Registrarme
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {isRegister && (
            <label className="block text-sm text-white/70">
              Nombre
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="mt-1 w-full rounded-2xl bg-white/10 px-4 py-3 text-white outline-none ring-1 ring-white/15 placeholder:text-white/40 focus:ring-2 focus:ring-cyan-300/60"
                placeholder="Tu nombre"
              />
            </label>
          )}

          <label className="block text-sm text-white/70">
            Correo
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-2xl bg-white/10 px-4 py-3 text-white outline-none ring-1 ring-white/15 placeholder:text-white/40 focus:ring-2 focus:ring-cyan-300/60"
              placeholder="correo@ejemplo.com"
            />
          </label>

          <label className="block text-sm text-white/70">
            Contrasena
            <div className="relative mt-1">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
                type={showPassword ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="w-full rounded-2xl bg-white/10 py-3 pl-4 pr-12 text-white outline-none ring-1 ring-white/15 placeholder:text-white/40 focus:ring-2 focus:ring-cyan-300/60"
                placeholder="Minimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 rounded-xl p-1.5 text-white/55 transition -translate-y-1/2 hover:bg-white/10 hover:text-white"
                aria-label={
                  showPassword ? "Ocultar contrasena" : "Mostrar contrasena"
                }
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </label>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Procesando..."
            : isRegister
              ? "Crear cuenta"
              : "Entrar"}
        </button>
      </div>
    </main>
  );
}
