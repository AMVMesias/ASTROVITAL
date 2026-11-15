"use client";
import { BleCaptureProvider } from "../../features/capture/BleCapture";
import { AdminShell } from "./AdminShell";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError, type User } from "../../lib/api";
export function SessionPanel({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>();
  const [error, setError] = useState("");
  const path = usePathname(),
    router = useRouter();
  useEffect(() => {
    let active = true;
    void api<{ user: User }>("/v1/auth/session")
      .then(({ user }) => {
        if (!active) return;
        if (user.requiresOnboarding) {
          router.replace("/login");
          return;
        }
        const adminPage = path.startsWith("/usuarios");
        if (
          (adminPage && user.role !== "admin") ||
          (!adminPage && user.role === "admin" && path !== "/configuracion")
        ) {
          router.replace(user.role === "admin" ? "/usuarios" : "/dashboard");
          return;
        }
        setUser(user);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, router]);
  if (error)
    return (
      <main className="interior">
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Reintentar</button>
      </main>
    );
  if (!user)
    return (
      <main className="interior">
        <p role="status">Comprobando sesión…</p>
      </main>
    );
  return <AdminShell user={user}>{user.role === "astronauta"
    ? <BleCaptureProvider key={user.id}>{children}</BleCaptureProvider>
    : children}</AdminShell>;
}
