"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import { SECURITY_QUESTIONS } from "../securityQuestions";

type DemoAnswer = { questionId: string; answer: string };
type DemoChallenge = {
  questionId: string;
  answer: string;
  failures: number;
  verified: boolean;
  example: boolean;
};
const normalizeAnswer = (value: string) =>
  value.trim().normalize("NFKC").toLocaleLowerCase("es");

type Screen =
  | "login"
  | "identify"
  | "question"
  | "password"
  | "complete"
  | "onboarding-password"
  | "onboarding-question"
  | "onboarding-complete";
const headings: Record<Screen, [string, string]> = {
  "onboarding-password": [
    "Primer acceso",
    "Tu cuenta fue creada por el administrador. Antes de continuar, cambia tu contraseña inicial.",
  ],
  "onboarding-question": [
    "Protege tu cuenta",
    "Elige tres preguntas diferentes y responde cada una. Al recuperar el acceso se te hará una sola, elegida al azar.",
  ],
  "onboarding-complete": [
    "Configuración de ejemplo",
    "Las tres preguntas de ejemplo están listas para probar la recuperación durante esta sesión. La contraseña real no ha cambiado.",
  ],
  login: [
    "Iniciar sesión",
    "Accede a la plataforma para consultar y gestionar la salud de la tripulación.",
  ],
  identify: [
    "Recuperar contraseña",
    "Ingresa tu usuario para consultar la pregunta de seguridad que elegiste en tu primer acceso.",
  ],
  question: [
    "Pregunta de seguridad",
    "Responde la pregunta que elegiste para recuperar el acceso a tu cuenta.",
  ],
  password: [
    "Nueva contraseña",
    "Crea una contraseña de al menos 12 caracteres y confírmala.",
  ],
  complete: [
    "Vista previa completada",
    "Ya recorriste los pasos de recuperación. Tu contraseña no se ha cambiado.",
  ],
};
export function LoginForm() {
  const [screen, setScreen] = useState<Screen>("login");
  const [backward, setBackward] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [username, setUsername] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState(["", "", ""]);
  const [challenge, setChallenge] = useState<DemoChallenge | null>(null);
  const demoAccounts = useRef(new Map<string, DemoAnswer[]>());
  const demoChallenges = useRef(new Map<string, DemoChallenge>());
  const accountKey = (name: string) => name.trim().toLocaleLowerCase("es");
  const heading = useRef<HTMLHeadingElement>(null);
  const initialRender = useRef(true);
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
  }, [screen]);
  function navigate(next: Screen, back = false) {
    setBackward(back);
    setShowPassword(false);
    setNotice("");
    setScreen(next);
  }
  const recovery = ["identify", "question", "password", "complete"].includes(
    screen,
  );
  const onboarding = screen.startsWith("onboarding");
  return (
    <div className="auth-flow-viewport">
      <div
        key={screen}
        className={`auth-flow-panel ${backward ? "auth-flow-back" : ""}`}
      >
        <h2 id="auth-title" ref={heading} tabIndex={-1}>
          {headings[screen][0]}
        </h2>
        <p className="auth-description">{headings[screen][1]}</p>
        {(recovery || onboarding) && (
          <p className="recovery-demo">
            Vista previa · La verificación y el cambio real requieren conectar
            el backend.
          </p>
        )}
        {recovery && screen !== "complete" && (
          <ol className="recovery-progress" aria-label="Pasos de recuperación">
            {["Usuario", "Pregunta", "Contraseña"].map((label, index) => (
              <li
                key={label}
                aria-current={
                  index === ["identify", "question", "password"].indexOf(screen)
                    ? "step"
                    : undefined
                }
              >
                <span>{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        )}
        <form
          key={screen}
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (screen === "login") {
              setUsername(String(data.get("username")).trim());
              setSelectedQuestions(["", "", ""]);
              // Demo only: the real login response must indicate first access.
              navigate("onboarding-password");
            } else if (screen === "identify") {
              const name = String(data.get("username")).trim();
              setUsername(name);
              const key = accountKey(name);
              let current = demoChallenges.current.get(key);
              if (!current) {
                const saved = demoAccounts.current.get(key);
                const answers =
                  saved ??
                  SECURITY_QUESTIONS.slice(0, 3).map((q) => ({
                    questionId: q.id,
                    answer: "demo",
                  }));
                const selected =
                  answers[
                    crypto.getRandomValues(new Uint32Array(1))[0] %
                      answers.length
                  ];
                current = {
                  ...selected,
                  failures: 0,
                  verified: false,
                  example: !saved,
                };
                demoChallenges.current.set(key, current);
              }
              setChallenge(current);
              navigate("question");
            } else if (screen === "question") {
              if (!challenge || challenge.failures >= 3) return;
              if (
                normalizeAnswer(String(data.get("answer"))) !== challenge.answer
              ) {
                const updated = {
                  ...challenge,
                  failures: challenge.failures + 1,
                };
                demoChallenges.current.set(accountKey(username), updated);
                setChallenge(updated);
                setNotice(
                  updated.failures >= 3
                    ? "Has agotado los 3 intentos. Contacta al administrador para recuperar el acceso."
                    : "La respuesta no coincide. Inténtalo de nuevo.",
                );
                return;
              }
              const verified = { ...challenge, verified: true };
              demoChallenges.current.set(accountKey(username), verified);
              setChallenge(verified);
              navigate("password");
            } else if (
              screen === "password" ||
              screen === "onboarding-password"
            ) {
              if (
                screen === "password" &&
                (!challenge?.verified || challenge.failures >= 3)
              )
                return;
              if (data.get("password") !== data.get("confirmation")) {
                setNotice("Las contraseñas no coinciden.");
                return;
              }
              navigate(
                screen === "onboarding-password"
                  ? "onboarding-question"
                  : "complete",
              );
            } else if (screen === "onboarding-question") {
              if (
                new Set(selectedQuestions).size !== 3 ||
                selectedQuestions.some((id) => !id)
              ) {
                setNotice("Elige tres preguntas distintas.");
                return;
              }
              const answers = selectedQuestions.map((questionId, index) => ({
                questionId,
                answer: normalizeAnswer(
                  String(data.get(`securityAnswer${index}`)),
                ),
              }));
              if (answers.some((item) => !item.answer)) {
                setNotice("Responde las tres preguntas.");
                return;
              }
              demoAccounts.current.set(accountKey(username), answers);
              demoChallenges.current.delete(accountKey(username));
              navigate("onboarding-complete");
            }
          }}
        >
          {(screen === "login" || screen === "identify") && (
            <label className="auth-field">
              <span className="sr-only">Usuario</span>
              <Icon name="user" />
              <input
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Usuario"
                defaultValue={username}
                maxLength={100}
              />
            </label>
          )}
          {screen === "question" && (
            <>
              <p className="recovery-question">
                <small>Una de tus tres preguntas</small>
                {
                  SECURITY_QUESTIONS.find((q) => q.id === challenge?.questionId)
                    ?.label
                }
              </p>
              <label className="auth-field">
                <span className="sr-only">Respuesta de seguridad</span>
                <Icon name="shield" />
                <input
                  name="answer"
                  type="text"
                  required
                  placeholder="Tu respuesta"
                  autoComplete="off"
                  maxLength={200}
                  disabled={!challenge || challenge.failures >= 3}
                />
              </label>
              <p className="recovery-hint">
                {challenge?.example
                  ? "Cuenta de ejemplo: responde «demo», o configura primero tus tres preguntas desde el primer acceso."
                  : "Responde con el dato de ejemplo que configuraste en esta sesión."}
              </p>
              <p className="recovery-attempts" role="status">
                Intentos restantes:{" "}
                {Math.max(0, 3 - (challenge?.failures ?? 0))} de 3
              </p>
            </>
          )}
          {(screen === "login" ||
            screen === "password" ||
            screen === "onboarding-password") && (
            <label className="auth-field">
              <span className="sr-only">
                {screen === "login" ? "Contraseña" : "Nueva contraseña"}
              </span>
              <Icon name="lock" />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  screen === "login" ? "current-password" : "new-password"
                }
                required
                minLength={screen !== "login" ? 12 : undefined}
                placeholder={
                  screen === "login" ? "Contraseña" : "Nueva contraseña"
                }
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
          )}
          {(screen === "password" || screen === "onboarding-password") && (
            <label className="auth-field">
              <span className="sr-only">Confirmar contraseña</span>
              <Icon name="lock" />
              <input
                name="confirmation"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                placeholder="Confirmar contraseña"
              />
            </label>
          )}
          {screen === "onboarding-question" && (
            <div className="setup-questions">
              <p className="recovery-hint">
                Usa respuestas de prueba. Esta demo las conserva solo en memoria
                hasta recargar la página.
              </p>
              {selectedQuestions.map((selected, index) => (
                <fieldset key={index} className="setup-question-group">
                  <legend>Pregunta {index + 1}</legend>
                  <label className="setup-label">
                    <span className="sr-only">
                      Pregunta de seguridad {index + 1}
                    </span>
                    <select
                      name={`question${index}`}
                      required
                      value={selected}
                      onChange={(event) =>
                        setSelectedQuestions((current) =>
                          current.map((id, i) =>
                            i === index ? event.target.value : id,
                          ),
                        )
                      }
                    >
                      <option value="" disabled>
                        Selecciona una pregunta
                      </option>
                      {SECURITY_QUESTIONS.map((question) => (
                        <option
                          key={question.id}
                          value={question.id}
                          disabled={
                            question.id !== selected &&
                            selectedQuestions.includes(question.id)
                          }
                        >
                          {question.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="auth-field">
                    <span className="sr-only">
                      Respuesta de seguridad {index + 1}
                    </span>
                    <Icon name="shield" />
                    <input
                      name={`securityAnswer${index}`}
                      required
                      autoComplete="off"
                      placeholder={`Respuesta ${index + 1}`}
                      maxLength={200}
                    />
                  </label>
                </fieldset>
              ))}
            </div>
          )}
          {notice && (
            <p role="alert" className="auth-notice">
              {notice}
            </p>
          )}
          {screen !== "complete" && screen !== "onboarding-complete" && (
            <button
              className="auth-submit"
              type="submit"
              disabled={
                screen === "question" && (!challenge || challenge.failures >= 3)
              }
            >
              {screen === "login"
                ? "Iniciar sesión"
                : screen === "password" || screen === "onboarding-question"
                  ? "Finalizar vista previa"
                  : "Continuar"}
              <Icon name="arrow" />
            </button>
          )}
          {screen === "complete" && (
            <p className="auth-notice" role="status">
              La integración pendiente deberá validar tu respuesta antes de
              permitir guardar una nueva contraseña.
            </p>
          )}
          {screen === "login" ? (
            <button
              type="button"
              className="auth-recovery"
              onClick={() => navigate("identify")}
            >
              <Icon name="lock" />
              Recuperar contraseña
            </button>
          ) : (
            <>
              <button
                type="button"
                className="auth-recovery"
                onClick={() => navigate("login", true)}
              >
                Volver a iniciar sesión
              </button>
              {(screen === "question" || screen === "password") && (
                <button
                  type="button"
                  className="recovery-back"
                  onClick={() =>
                    navigate(
                      screen === "question" ? "identify" : "question",
                      true,
                    )
                  }
                >
                  Volver al paso anterior
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
