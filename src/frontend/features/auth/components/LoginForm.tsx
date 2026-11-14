"use client";
import { useState } from "react";
export function LoginForm() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <form
      className="login-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <label>
        Correo electrónico
        <input
          type="email"
          autoComplete="email"
          required
          placeholder="nombre@ejemplo.com"
        />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </label>
      <button className="button" type="submit">
        Iniciar sesión
      </button>
      {submitted && (
        <p role="status" className="notice">
          El inicio de sesión estará disponible cuando se conecte el servicio de
          autenticación. Este prototipo no envía ni almacena tus credenciales.
        </p>
      )}
    </form>
  );
}
