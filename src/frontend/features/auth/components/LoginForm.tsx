"use client";
import { useState } from "react";
import { Icon } from "../../../components/ui/Icon";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [recovery, setRecovery] = useState(false);
  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      {recovery ? (
        <label className="auth-field">
          <span className="sr-only">Correo electrónico</span>
          <Icon name="user" />
          <input
            type="email"
            autoComplete="email"
            required
            placeholder="Correo electrónico"
          />
        </label>
      ) : (
        <>
          <label className="auth-field">
            <span className="sr-only">Usuario</span>
            <Icon name="user" />
            <input
              type="text"
              autoComplete="username"
              required
              placeholder="Usuario"
            />
          </label>
          <label className="auth-field">
            <span className="sr-only">Contraseña</span>
            <Icon name="lock" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Contraseña"
            />
            <button
              type="button"
              className="auth-reveal"
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} />
            </button>
          </label>
        </>
      )}
      <button className="auth-submit" type="submit">
        {recovery ? "Recuperar contraseña" : "Iniciar sesión"}
        <Icon name="arrow" />
      </button>
      <button
        type="button"
        className="auth-recovery"
        onClick={() => {
          setRecovery(!recovery);
          setSubmitted(false);
        }}
      >
        <Icon name="lock" />
        {recovery ? "Volver a iniciar sesión" : "Recuperar contraseña"}
      </button>
      {submitted && (
        <p role="status" className="auth-notice">
          {recovery
            ? "La recuperación de contraseña estará disponible al conectar el servicio de autenticación."
            : "El inicio de sesión estará disponible al conectar el servicio de autenticación."}{" "}
          Este prototipo no envía ni almacena tus datos.
        </p>
      )}
    </form>
  );
}
