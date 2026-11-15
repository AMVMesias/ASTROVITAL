"use client";
import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "./Brand";
import { LanguageSelect } from "../ui/LanguageSelect";
import { ThemeToggle } from "../ui/ThemeToggle";
import { AdminIcon } from "../ui/AdminIcon";
import { api, writeRequest, type User } from "../../lib/api";
import { useLanguage } from "../../providers/LanguageProvider";
import "./admin.css";
export function AdminShell({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const path = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const { locale } = useLanguage();
  const en = locale === "en";
  const astronaut = user.role === "astronauta";
  async function logout() {
    try {
      await api("/v1/auth/logout", writeRequest("POST"));
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar la sesión.");
    }
  }
  return (
    <div className={`admin-shell ${astronaut ? "astronaut-shell" : ""}`}>
      <header className="admin-header">
        <button
          className="admin-menu"
          onClick={() => setOpen(!open)}
          aria-label={en ? "Toggle menu" : "Abrir o cerrar menú"}
          aria-expanded={open}
          aria-controls="admin-sidebar"
        >
          <AdminIcon name="menu" />
        </button>
        <Brand />
        <div className="admin-header-title">
          <AdminIcon name={astronaut ? "user" : "shield"} />
          <span>
            {astronaut
              ? en
                ? "Astronaut panel"
                : "Panel del astronauta"
              : en
                ? "Administration panel"
                : "Panel de administración"}
          </span>
        </div>
        <div className="admin-header-controls">
          <LanguageSelect />
          <ThemeToggle />
        </div>
        <details className="admin-profile">
          <summary>
            <span className="admin-profile-avatar">
              <AdminIcon name="user" />
            </span>
            <span>
              <strong>{astronaut ? user.name : user.username}</strong>
              <small>
                {astronaut
                  ? en
                    ? "Astronaut"
                    : "Astronauta"
                  : en
                    ? "Administrator"
                    : "Administrador"}
              </small>
            </span>
            <AdminIcon name="chevron" />
          </summary>
          <div>
            <Link href="/configuracion">{en ? "My account" : "Mi cuenta"}</Link>
            <button onClick={() => void logout()}>
              {en ? "Sign out" : "Cerrar sesión"}
            </button>
          </div>
        </details>
      </header>
      {open && (
        <button
          className="admin-backdrop"
          aria-label={en ? "Close menu" : "Cerrar menú"}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="admin-sidebar"
        className={`admin-sidebar ${open ? "is-open" : ""}`}
      >
        {astronaut && (
          <div className="astronaut-sidebar-brand">
            <Brand />
          </div>
        )}
        <nav
          aria-label={
            astronaut
              ? en
                ? "Astronaut"
                : "Astronauta"
              : en
                ? "Administration"
                : "Administración"
          }
        >
          {(astronaut
            ? [
                ["/dashboard", "grid", en ? "Overview" : "Resumen"],
                ["/bluetooth", "chip", "ESP32 Bluetooth"],
                ["/reportes", "chart", en ? "History" : "Historial"],
                ["/registros", "edit", en ? "Manual entry" : "Registro manual"],
                ["/avisos", "bell", en ? "Alerts" : "Avisos"],
                [
                  "/entorno",
                  "layers",
                  en ? "Capture environment" : "Entorno de captura",
                ],
                ["/configuracion", "user", en ? "My account" : "Mi cuenta"],
              ]
            : [
                ["/usuarios", "users", en ? "Users" : "Usuarios"],
                [
                  "/usuarios/nuevo",
                  "addUser",
                  en ? "New user" : "Nuevo usuario",
                ],
                ["/configuracion", "user", en ? "My account" : "Mi cuenta"],
              ]
          ).map(([url, icon, label]) => (
            <Link
              key={url}
              href={url}
              className={path === url ? "is-active" : ""}
              aria-current={path === url ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <AdminIcon name={icon} />
              {label}
            </Link>
          ))}
          <div className="admin-sidebar-divider" />
          <button onClick={() => void logout()}>
            <AdminIcon name="logout" />
            {en ? "Sign out" : "Cerrar sesión"}
          </button>
        </nav>
      </aside>
      <div className="admin-content">
        {error && (
          <p role="alert" className="admin-message error">
            {error}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
