"use client";
import { useEffect, useState } from "react";
import { api, type User } from "../../../frontend/lib/api";
import { AdminIcon } from "../../../frontend/components/ui/AdminIcon";
import { useLanguage } from "../../../frontend/providers/LanguageProvider";
import styles from "./account.module.css";

type SecurityStatus = {
  securityQuestionsConfigured: boolean;
  recoveryLocked: boolean;
};
export default function Page() {
  const [user, setUser] = useState<User>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState<SecurityStatus>();
  const { locale } = useLanguage();
  const en = locale === "en";
  useEffect(() => {
    let active = true;
    void Promise.all([
      api<{ user: User }>("/v1/auth/session"),
      api<SecurityStatus>("/v1/auth/onboarding"),
    ])
      .then(([session, recovery]) => {
        if (active) {
          setUser(session.user);
          setStatus(recovery);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const role =
    user?.role === "admin"
      ? en
        ? "Administrator"
        : "Administrador"
      : en
        ? "Astronaut"
        : "Astronauta";
  return (
    <main
      className={`${styles.page} ${user?.role === "astronauta" ? styles.standalone : ""}`}
    >
      <p className={styles.eyebrow}>
        <span />
        {en ? "Personal profile" : "Perfil personal"}
      </p>
      <h1>{en ? "My account" : "Mi cuenta"}</h1>
      <p className={styles.subtitle}>
        {en
          ? "Your account information and access security."
          : "Información de tu cuenta y seguridad de acceso."}
      </p>
      {error && (
        <p role="alert" className={styles.message}>
          {error}
        </p>
      )}
      {!user && !error && (
        <p role="status">{en ? "Loading account…" : "Cargando cuenta…"}</p>
      )}
      {user && status && (
        <>
          <div className={styles.grid}>
            <section
              className={styles.card}
              aria-labelledby="account-profile-title"
            >
              <div className={styles.profile}>
                <span className={styles.avatar}>
                  {(user.name || user.username).charAt(0).toUpperCase()}
                </span>
                <div>
                  <span className={styles.role}>{role}</span>
                  <h2 id="account-profile-title">{user.name}</h2>
                  <p>@{user.username}</p>
                </div>
              </div>
              <dl className={styles.details}>
                <div>
                  <dt>{en ? "Username" : "Usuario"}</dt>
                  <dd>{user.username}</dd>
                </div>
                <div>
                  <dt>{en ? "Full name" : "Nombre completo"}</dt>
                  <dd>{user.name}</dd>
                </div>
                <div>
                  <dt>{en ? "Account role" : "Rol de la cuenta"}</dt>
                  <dd>{role}</dd>
                </div>
              </dl>
            </section>
            <section
              className={styles.card}
              aria-labelledby="account-security-title"
            >
              <div className={styles.securityHeading}>
                <span className={styles.icon}>
                  <AdminIcon name="shield" />
                </span>
                <div>
                  <h2 id="account-security-title">
                    {en ? "Access security" : "Seguridad de acceso"}
                  </h2>
                  <p>
                    {en
                      ? "Your recovery settings"
                      : "Tu configuración de recuperación"}
                  </p>
                </div>
              </div>
              <dl className={styles.details}>
                <div>
                  <dt>
                    {en ? "Security questions" : "Preguntas de seguridad"}
                  </dt>
                  <dd>
                    <span
                      className={`${styles.badge} ${!status.securityQuestionsConfigured ? styles.warning : ""}`}
                    >
                      {status.securityQuestionsConfigured
                        ? en
                          ? "Configured"
                          : "Configuradas"
                        : en
                          ? "Not configured"
                          : "Sin configurar"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>
                    {en ? "Password recovery" : "Recuperación de contraseña"}
                  </dt>
                  <dd>
                    <span
                      className={`${styles.badge} ${status.recoveryLocked ? styles.warning : ""}`}
                    >
                      {status.recoveryLocked
                        ? en
                          ? "Locked"
                          : "Bloqueada"
                        : en
                          ? "Available"
                          : "Disponible"}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className={styles.help}>
                {status.recoveryLocked
                  ? en
                    ? "Contact an administrator to unlock password recovery."
                    : "Contacta con un administrador para desbloquear la recuperación."
                  : en
                    ? "To change your password, use the recovery option on the sign-in screen."
                    : "Para cambiar tu contraseña, utiliza la opción de recuperación en la pantalla de inicio de sesión."}
              </p>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
