"use client";
import { useLanguage } from "../../../providers/LanguageProvider";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import { useRouter } from "next/navigation";
import { api, writeRequest, type User } from "../../../lib/api";
import { SECURITY_QUESTIONS } from "../securityQuestions";

type Challenge = { challengeId: string; question: { id: string; label: string }; attemptsRemaining: number; };

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
  "onboarding-complete": ["Cuenta configurada", "Inicia sesión para continuar."],
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
  complete: ["Contraseña guardada", "Inicia sesión para continuar."],
};
export function LoginForm() {
  const { t, locale } = useLanguage();
  const es=locale === "es";
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const passwordDraft=useRef("");
  const resetToken=useRef("");
  const [screen, setScreen] = useState<Screen>("login");
  const [backward, setBackward] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [username, setUsername] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState(["", "", ""]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
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

  return (
    <div className="auth-flow-viewport">
      <div
        key={screen}
        className={`auth-flow-panel ${backward ? "auth-flow-back" : ""}`}
      >
        <h2 id="auth-title" ref={heading} tabIndex={-1}>
          {screen === "complete" || screen === "onboarding-complete" ? (es ? "Cambio guardado" : "Changes saved") : headings[screen][0]}
        </h2>
        <p className="auth-description">{screen === "complete" || screen === "onboarding-complete" ? (es ? "Tu contraseña se guardó. Inicia sesión para continuar." : "Your password was saved. Sign in to continue.") : headings[screen][1]}</p>
        {recovery && screen !== "complete" && (
          <ol
            className="recovery-progress"
            aria-label={t("Pasos de recuperación")}
          >
            {[t("Usuario"), t("Pregunta"), t("Contraseña")].map(
              (label, index) => (
                <li
                  key={label}
                  aria-current={
                    index ===
                    ["identify", "question", "password"].indexOf(screen)
                      ? "step"
                      : undefined
                  }
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ),
            )}
          </ol>
        )}
        <form
          key={screen}
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if(pending) return;
            const data=new FormData(event.currentTarget);setPending(true);setNotice("");
            try {
              if(screen === "login") {
                const name=String(data.get("username")).trim();setUsername(name);
                const {user}=await api<{user:User}>("/v1/auth/login",writeRequest("POST",{username:name,password:String(data.get("password"))}));
                if(user.requiresOnboarding) navigate("onboarding-password");
                else {router.replace(user.role === "admin" ? "/usuarios" : "/dashboard");router.refresh();}
              } else if(screen === "identify") {
                const name=String(data.get("username")).trim();setUsername(name);
                setChallenge(await api<Challenge>("/v1/auth/recovery/start",writeRequest("POST",{username:name})));navigate("question");
              } else if(screen === "question" && challenge) {
                try {
                  const result=await api<{resetToken:string}>("/v1/auth/recovery/verify",writeRequest("POST",{challengeId:challenge.challengeId,answer:String(data.get("answer"))}));
                  resetToken.current=result.resetToken;navigate("password");
                } catch(error) {setChallenge({...challenge,attemptsRemaining:Math.max(0,challenge.attemptsRemaining-1)});throw error;}
              } else if(screen === "password" || screen === "onboarding-password") {
                const next=String(data.get("password"));if(next !== data.get("confirmation")) throw new Error(es ? "Las contraseñas no coinciden." : "Passwords do not match.");
                if(screen === "onboarding-password") {passwordDraft.current=next;navigate("onboarding-question");}
                else {await api("/v1/auth/recovery/reset",writeRequest("POST",{resetToken:resetToken.current,newPassword:next,confirmation:next}));resetToken.current="";navigate("complete");}
              } else if(screen === "onboarding-question") {
                const answers=selectedQuestions.map((questionId,i)=>({questionId,answer:String(data.get(`securityAnswer${i}`))}));
                await api("/v1/auth/onboarding",writeRequest("POST",{newPassword:passwordDraft.current,confirmation:passwordDraft.current,answers}));
                passwordDraft.current="";navigate("onboarding-complete");
              }
            } catch(error) {setNotice(error instanceof Error ? error.message : (es ? "No se pudo completar la operación." : "Request failed."));}
            finally {setPending(false);}
          }}
        >
          {(screen === "login" || screen === "identify") && (
            <label className="auth-field">
              <span className="sr-only">{t("Usuario")}</span>
              <Icon name="user" />
              <input
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder={t("Usuario")}
                defaultValue={username}
                maxLength={100}
              />
            </label>
          )}
          {screen === "question" && (
            <>
              <p className="recovery-question">
                <small>{t("Una de tus tres preguntas")}</small>
                {t(
                  SECURITY_QUESTIONS.find((q) => q.id === challenge?.question.id)
                    ?.label ?? "Pregunta de seguridad",
                )}
              </p>
              <label className="auth-field">
                <span className="sr-only">{t("Respuesta de seguridad")}</span>
                <Icon name="shield" />
                <input
                  name="answer"
                  type="text"
                  required
                  placeholder={t("Tu respuesta")}
                  autoComplete="off"
                  maxLength={200}
                  disabled={!challenge || challenge.attemptsRemaining <= 0}
                />
              </label>

              <p className="recovery-attempts" role="status">
                {t("Intentos restantes:")}{" "}
                {challenge?.attemptsRemaining ?? 0}
                {t("de 3")}
              </p>
            </>
          )}
          {(screen === "login" ||
            screen === "password" ||
            screen === "onboarding-password") && (
            <label className="auth-field">
              <span className="sr-only">
                {screen === "login" ? t("Contraseña") : t("Nueva contraseña")}
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
                  screen === "login" ? t("Contraseña") : t("Nueva contraseña")
                }
              />
              <button
                type="button"
                className="auth-reveal"
                aria-label={
                  showPassword
                    ? t("Ocultar contraseña")
                    : t("Mostrar contraseña")
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
              <span className="sr-only">{t("Confirmar contraseña")}</span>
              <Icon name="lock" />
              <input
                name="confirmation"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                placeholder={t("Confirmar contraseña")}
              />
            </label>
          )}
          {screen === "onboarding-question" && (
            <div className="setup-questions">

              {selectedQuestions.map((selected, index) => (
                <fieldset key={index} className="setup-question-group">
                  <legend>
                    {t("Pregunta")} {index + 1}
                  </legend>
                  <label className="setup-label">
                    <span className="sr-only">
                      {t("Pregunta de seguridad")} {index + 1}
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
                        {t("Selecciona una pregunta")}
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
                          {t(question.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="auth-field">
                    <span className="sr-only">
                      {t("Respuesta de seguridad")} {index + 1}
                    </span>
                    <Icon name="shield" />
                    <input
                      name={`securityAnswer${index}`}
                      required
                      autoComplete="off"
                      placeholder={`${t("Respuesta")} ${index + 1}`}
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
                pending || (screen === "question" && (!challenge || challenge.attemptsRemaining <= 0))
              }
            >
              {screen === "login"
                ? t("Iniciar sesión")
                : screen === "password" || screen === "onboarding-question"
                  ? (es ? "Guardar" : "Save")
                  : t("Continuar")}
              <Icon name="arrow" />
            </button>
          )}
          {screen === "login" ? (
            <button
              type="button"
              className="auth-recovery"
              onClick={() => navigate("identify")}
            >
              <Icon name="lock" />
              {t("Recuperar contraseña")}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="auth-recovery"
                onClick={() => navigate("login", true)}
              >
                {t("Volver a iniciar sesión")}
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
                  {t("Volver al paso anterior")}
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
