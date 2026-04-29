"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { data: session } = useSession();

  const userName = session?.user?.name ?? "Usuario";
  const userEmail = session?.user?.email ?? "";
  const userImage = session?.user?.image;

  const initials = userName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const showImage = userImage && !imageError;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="user-menu-trigger hidden items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/10 md:flex"
      >
        {showImage ? (
          <img
            src={userImage}
            alt={userName}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <div className="user-menu-avatar flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-semibold text-cyan-100">
            {initials}
          </div>
        )}

        <span>{userName}</span>
        <span className="text-xs text-white/50">▼</span>
      </button>

      {open && (
        <div className="user-menu-panel absolute right-0 top-12 z-50 w-64 rounded-2xl border border-white/10 bg-slate-950 p-3 text-white shadow-2xl">
          <div className="mb-3 flex items-center gap-3 border-b border-white/10 pb-3">
            {showImage ? (
              <img
                src={userImage}
                alt={userName}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <div className="user-menu-avatar flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-semibold text-cyan-100">
                {initials}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="user-menu-email truncate text-xs text-white/50">{userEmail}</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="user-menu-logout w-full rounded-xl px-3 py-2 text-left text-sm text-red-200 hover:bg-red-500/10"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
