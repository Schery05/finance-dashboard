"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { signIn } from "next-auth/react";
import logoIcon from "../icon.png";

type Mode = "login" | "register" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";
  const isReset = mode === "reset";

  const submit = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

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

  const requestPasswordReset = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.error ?? "No se pudo enviar el token.");
      }

      setResetSent(true);
      setSuccess(json.message ?? "Te enviamos un token de recuperacion.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el token.");
    } finally {
      setLoading(false);
    }
  };

  const confirmPasswordReset = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: resetToken, password }),
      });
      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.error ?? "No se pudo actualizar la contrasena.");
      }

      setMode("login");
      setResetSent(false);
      setResetToken("");
      setPassword("");
      setSuccess("Contrasena actualizada. Ya puedes iniciar sesion.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contrasena.");
    } finally {
      setLoading(false);
    }
  };

  const resetFormState = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setResetSent(false);
    setResetToken("");
    setPassword("");
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
          {isReset
            ? "Renueva tu contrasena con un token temporal."
            : isRegister
            ? "Crea tu cuenta para gestionar tus finanzas."
            : "Inicia sesion para acceder a tu dashboard financiero."}
        </p>

        {!isReset && (
          <div className="mt-6 grid grid-cols-2 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
          <button
            onClick={() => {
              resetFormState("login");
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
              resetFormState("register");
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
        )}

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

          {isReset && resetSent && (
            <label className="block text-sm text-white/70">
              Token recibido
              <input
                value={resetToken}
                onChange={(event) =>
                  setResetToken(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                className="mt-1 w-full rounded-2xl bg-white/10 px-4 py-3 text-white outline-none ring-1 ring-white/15 placeholder:text-white/40 focus:ring-2 focus:ring-cyan-300/60"
                placeholder="6 digitos"
              />
            </label>
          )}

          {(!isReset || resetSent) && (
            <label className="block text-sm text-white/70">
              {isReset ? "Nueva contrasena" : "Contrasena"}
              <div className="relative mt-1">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      if (isReset) {
                        if (resetSent) confirmPasswordReset();
                      } else {
                        submit();
                      }
                    }
                  }}
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister || isReset ? "new-password" : "current-password"}
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
          )}
        </div>

        {!isRegister && !isReset && (
          <button
            type="button"
            onClick={() => resetFormState("reset")}
            className="mt-3 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
          >
            Olvide mi contrasena
          </button>
        )}

        {error && (
          <div className="mt-5 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-5 rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-100 ring-1 ring-emerald-300/20">
            {success}
          </div>
        )}

        <button
          onClick={
            isReset
              ? resetSent
                ? confirmPasswordReset
                : requestPasswordReset
              : submit
          }
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Procesando..."
            : isReset
              ? resetSent
                ? "Actualizar contrasena"
                : "Enviar token"
              : isRegister
              ? "Crear cuenta"
              : "Entrar"}
        </button>

        {isReset && (
          <button
            type="button"
            onClick={() => resetFormState("login")}
            className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white/65 transition hover:bg-white/5 hover:text-white"
          >
            Volver al inicio de sesion
          </button>
        )}
      </div>
    </main>
  );
}
