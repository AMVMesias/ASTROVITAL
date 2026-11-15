"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, writeRequest, type User } from "../../../lib/api";
import { AdminIcon } from "../../../components/ui/AdminIcon";
import { useLanguage } from "../../../providers/LanguageProvider";
export function UsersManager({ create = false }: { create?: boolean }) {
  const [users, setUsers] = useState<User[]>([]),
    [editing, setEditing] = useState<User | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(false),
    [loading, setLoading] = useState(!create);
  const [search, setSearch] = useState(""),
    [role, setRole] = useState("all"),
    [status, setStatus] = useState("all");
  const [linking,setLinking]=useState<User|null>(null);
  const formCard = useRef<HTMLElement>(null);
  useEffect(() => {
    if (editing)
      formCard.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [editing]);
  const router = useRouter();
  const { locale } = useLanguage();
  const en = locale === "en";
  async function load() {
    setUsers((await api<{ users: User[] }>("/v1/users")).users);
  }
  useEffect(() => {
    let active = true;
    if (!create)
      void api<{ users: User[] }>("/v1/users")
        .then((r) => {
          if (active) setUsers(r.users);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [create]);
  async function unlock(user: User) {
    setPending(true);
    setError("");
    try {
      await api(`/v1/users/${user.id}/recovery/unlock`, writeRequest("POST"));
      setNotice(
        en
          ? `Recovery unlocked for ${user.username}.`
          : `Recuperación desbloqueada para ${user.username}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setPending(false);
    }
  }
  const filtered = users.filter(
    (u) =>
      (role === "all" || u.role === role) &&
      (status === "all" || u.enabled === (status === "enabled")) &&
      `${u.name} ${u.username}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <main className="admin-users">
      <p className="admin-eyebrow">
        <span />
        {en ? "Administration" : "Administración"}
      </p>
      <h1>
        {create
          ? en
            ? "New user"
            : "Nuevo usuario"
          : en
            ? "Users"
            : "Usuarios"}
      </h1>
      <p className="admin-subtitle">
        {en
          ? "Manage platform accounts and access."
          : "Gestiona las cuentas y accesos de la plataforma."}
      </p>
      {linking&&<section className="admin-form-card"><h2>Vincular ESP32 a {linking.username}</h2><form className="data-form" onSubmit={async event=>{event.preventDefault();const f=new FormData(event.currentTarget);setPending(true);setError("");try{const r=await api<{deviceId:string}>(`/v1/users/${linking.id}/devices`,writeRequest("POST",{deviceId:String(f.get("deviceId")).trim()}));setNotice(`Dispositivo ${r.deviceId} vinculado a ${linking.username}. Ya puede seleccionarlo en su dashboard.`);setLinking(null);}catch(e){setError(e instanceof Error?e.message:"No se pudo vincular.");}finally{setPending(false);}}}><label>ID interno de la placa (no es la dirección MAC)<input name="deviceId" required maxLength={64} pattern="[a-zA-Z0-9._-]+" placeholder="esp32-01"/></label><button disabled={pending}>Vincular</button><button type="button" onClick={()=>setLinking(null)}>Cancelar</button></form></section>}
      {error && (
        <p role="alert" className="admin-message error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="admin-message">
          {notice}
        </p>
      )}
      {!create && (
        <div className="admin-stats">
          {[
            ["users", en ? "Total users" : "Total de usuarios", users.length],
            [
              "astronaut",
              en ? "Astronauts" : "Astronautas",
              users.filter((u) => u.role === "astronauta").length,
            ],
            [
              "shield",
              en ? "Administrators" : "Administradores",
              users.filter((u) => u.role === "admin").length,
            ],
          ].map(([icon, label, value]) => (
            <article key={String(icon)}>
              <span className="admin-stat-icon">
                <AdminIcon name={String(icon)} />
              </span>
              <div>
                <h2>{label}</h2>
                <strong>{loading ? "—" : value}</strong>
              </div>
            </article>
          ))}
        </div>
      )}
      {(create || editing) && (
        <section className="admin-form-card" ref={formCard}>
          <h2>
            {editing
              ? en
                ? "Edit user"
                : "Editar usuario"
              : en
                ? "Account details"
                : "Datos de la cuenta"}
          </h2>
          <form
            className="admin-user-form"
            key={editing?.id ?? "new"}
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget,
                data = new FormData(form);
              setPending(true);
              setError("");
              const password = String(data.get("password"));
              const body = {
                username: String(data.get("username")),
                name: String(data.get("name")),
                role: String(data.get("role")),
                enabled: data.get("enabled") === "on",
                ...(password ? { password } : {}),
              };
              try {
                await api(
                  `/v1/users${editing ? `/${editing.id}` : ""}`,
                  writeRequest(editing ? "PATCH" : "POST", body),
                );
                setNotice(
                  en
                    ? "Account saved. A new password requires first sign-in setup."
                    : "Cuenta guardada. Una contraseña nueva requiere completar el primer acceso.",
                );
                setEditing(null);
                form.reset();
                if (create) router.push("/usuarios");
                else await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error");
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              {en ? "Username" : "Usuario"}
              <input
                name="username"
                required
                minLength={3}
                maxLength={64}
                pattern="[a-zA-Z0-9._-]+"
                defaultValue={editing?.username}
              />
            </label>
            <label>
              {en ? "Name" : "Nombre"}
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={editing?.name}
              />
            </label>
            <label>
              {en ? "Role" : "Rol"}
              <select name="role" defaultValue={editing?.role ?? "astronauta"}>
                <option value="astronauta">
                  {en ? "Astronaut" : "Astronauta"}
                </option>
                <option value="admin">
                  {en ? "Administrator" : "Administrador"}
                </option>
              </select>
            </label>
            <label>
              {editing
                ? en
                  ? "New password (optional)"
                  : "Nueva contraseña (opcional)"
                : en
                  ? "Initial password"
                  : "Contraseña inicial"}
              <input
                name="password"
                type="password"
                required={!editing}
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={editing?.enabled ?? true}
              />
              {en ? "Account enabled" : "Cuenta habilitada"}
            </label>
            <div className="admin-form-actions">
              <button className="admin-primary" disabled={pending}>
                {pending
                  ? en
                    ? "Saving…"
                    : "Guardando…"
                  : en
                    ? "Save user"
                    : "Guardar usuario"}
              </button>
              {editing ? (
                <button
                  type="button"
                  className="admin-action"
                  onClick={() => setEditing(null)}
                >
                  {en ? "Cancel" : "Cancelar"}
                </button>
              ) : (
                <Link href="/usuarios" className="admin-action">
                  {en ? "Back" : "Volver"}
                </Link>
              )}
            </div>
          </form>
        </section>
      )}
      {!create && (
        <>
          <div className="admin-filters">
            <label className="admin-search">
              <span className="sr-only">
                {en ? "Search users" : "Buscar usuarios"}
              </span>
              <AdminIcon name="search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  en
                    ? "Search by name or username…"
                    : "Buscar usuario por nombre o usuario..."
                }
              />
            </label>
            <label className="admin-filter">
              <AdminIcon name="filter" />
              <span className="sr-only">
                {en ? "Filter by role" : "Filtrar por rol"}
              </span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="all">
                  {en ? "All roles" : "Todos los roles"}
                </option>
                <option value="admin">
                  {en ? "Administrators" : "Administradores"}
                </option>
                <option value="astronauta">
                  {en ? "Astronauts" : "Astronautas"}
                </option>
              </select>
            </label>
            <label className="admin-filter">
              <AdminIcon name="shield" />
              <span className="sr-only">
                {en ? "Filter by status" : "Filtrar por estado"}
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">
                  {en ? "All statuses" : "Todos los estados"}
                </option>
                <option value="enabled">
                  {en ? "Enabled" : "Habilitados"}
                </option>
                <option value="disabled">
                  {en ? "Disabled" : "Inhabilitados"}
                </option>
              </select>
            </label>
            <Link href="/usuarios/nuevo" className="admin-primary">
              <AdminIcon name="plus" />
              {en ? "New user" : "Nuevo usuario"}
            </Link>
          </div>
          <div className="admin-mobile-list-heading">
            <h2>{en ? "Platform accounts" : "Cuentas de la plataforma"}</h2>
            <span>{filtered.length}</span>
          </div>
          <div
            className="admin-table-wrap"
            role="region"
            aria-label={en ? "Users table" : "Tabla de usuarios"}
            tabIndex={0}
          >
            <table className="admin-table">
              <thead>
                <tr>
                  {(en
                    ? ["Username", "Name", "Role", "Status", "Actions"]
                    : ["Usuario", "Nombre", "Rol", "Estado", "Acciones"]
                  ).map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td className="admin-cell-user">
                      <span className="admin-user-cell">
                        <span className="admin-initial">
                          {(user.name || user.username).charAt(0).toUpperCase()}
                        </span>
                        <strong>{user.username}</strong>
                      </span>
                    </td>
                    <td className="admin-cell-name">{user.name}</td>
                    <td className="admin-cell-role">
                      <span className="admin-role">
                        <AdminIcon
                          name={user.role === "admin" ? "shield" : "astronaut"}
                        />
                        {user.role === "admin"
                          ? "Admin"
                          : en
                            ? "Astronaut"
                            : "Astronauta"}
                      </span>
                    </td>
                    <td className="admin-cell-status">
                      <span
                        className={`admin-status ${user.enabled ? "enabled" : "disabled"}`}
                      >
                        <i />
                        {user.enabled
                          ? en
                            ? "Enabled"
                            : "Habilitado"
                          : en
                            ? "Disabled"
                            : "Inhabilitado"}
                      </span>
                      {user.requiresOnboarding && (
                        <small className="admin-onboarding">
                          {en
                            ? "First sign-in pending"
                            : "Primer acceso pendiente"}
                        </small>
                      )}
                    </td>
                    <td className="admin-cell-actions">
                      <div className="admin-row-actions">
                        <button
                          className="admin-action"
                          disabled={pending}
                          onClick={() => setEditing(user)}
                        >
                          <AdminIcon name="edit" />
                          {en ? "Edit" : "Editar"}
                        </button>
                        <button
                          className="admin-action"
                          disabled={pending}
                          onClick={() => void unlock(user)}
                        >
                          <AdminIcon name="lock" />
                          {en ? "Unlock recovery" : "Desbloquear recuperación"}
                        </button>
                        {user.role==="astronauta"&&user.enabled&&<button disabled={pending} onClick={()=>setLinking(user)}>Vincular ESP32</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {(loading || !filtered.length) && (
                  <tr>
                    <td colSpan={5} className="admin-empty" role="status">
                      {loading
                        ? en
                          ? "Loading users…"
                          : "Cargando usuarios…"
                        : en
                          ? "No users match these filters."
                          : "No hay usuarios que coincidan con los filtros."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
