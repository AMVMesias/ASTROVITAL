"use client";
import Link from "next/link";
import { useLanguage } from "../../frontend/providers/LanguageProvider";
import { Header } from "../../frontend/components/layout/Header";
import { Footer } from "../../frontend/components/layout/Footer";
import styles from "./resources.module.css";

const repo = "https://github.com/AMVMesias/ASTROVITAL";
export default function Page() {
  const { locale } = useLanguage();
  const es = locale === "es";
  const steps = es ? [
    ["Accede a tu cuenta", "Utiliza la cuenta creada por el administrador y completa la configuración de primer acceso si se solicita."],
    ["Conecta el ESP32", "Abre ESP32 Bluetooth desde una laptop compatible, pulsa Conectar y elige la placa. Mantén la página abierta y la conexión a Internet activa."],
    ["Confirma el contexto", "Selecciona tu actividad cuando la conozcas y el entorno de misión. Puedes cambiar la actividad durante la captura."],
    ["Consulta y da seguimiento", "Revisa el resumen, el historial y los avisos. Comprueba la fecha y la calidad de la lectura antes de interpretarla; registra una observación cuando corresponda."],
  ] : [
    ["Access your account", "Use the account created by the administrator and complete first-access setup if requested."],
    ["Connect the ESP32", "Open ESP32 Bluetooth on a compatible laptop, press Connect and choose the board. Keep the page open and the Internet connection active."],
    ["Confirm the context", "Select your activity when known and choose the mission environment. Activity can be changed during capture."],
    ["Review and follow up", "Review the overview, history and alerts. Check reading dates and quality before interpreting them; record observations when appropriate."],
  ];
  const sources = [
    ["NASA OSDR · RadLab", "https://visualization.osdr.nasa.gov/radlab/gui/data-api/", es ? "Resúmenes históricos en el DSS" : "Historical summaries in the DSS", es ? "El DSS carga los resúmenes aportados de MSL-RAD, CRaTER y Artemis I. Sus conteos y percentiles no se han reproducido sin los CSV originales; no representan dosis personales." : "The DSS loads supplied summaries for MSL-RAD, CRaTER and Artemis I. Counts and percentiles have not been reproduced without the original CSV files; they do not represent personal doses.", "data/radlab_reference_summaries.json"],
    ["NASA · Moon & Mars Fact Sheets", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html", es ? "Valores del catálogo ambiental" : "Environmental catalog values", es ? "El catálogo cita estas fichas para gravedad y condiciones exteriores de referencia de la Luna y Marte. Son valores documentales, no sensores del traje." : "The catalog cites these fact sheets for gravity and reference exterior conditions on the Moon and Mars. These are documentary values, not spacesuit sensors.", "data/space_environment_surface_EVA_verified.json"],
    ["Perseverance · MEDA", "https://pdsatmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html", es ? "Referencia documental de Marte" : "Mars documentary reference", es ? "Registrada entre las fuentes del escenario marciano. La aplicación no descarga ni procesa una serie MEDA en vivo." : "Listed among the sources for the Mars scenario. The application does not download or process a live MEDA series.", "data/space_environment_surface_EVA_verified.json"],
    ["LRO · Diviner", "https://pds-geosciences.wustl.edu/missions/lro/diviner.htm", es ? "Referencia documental de la Luna" : "Moon documentary reference", es ? "Registrada entre las fuentes del escenario lunar. La aplicación no descarga ni procesa una serie Diviner en vivo." : "Listed among the sources for the Moon scenario. The application does not download or process a live Diviner series.", "data/space_environment_surface_EVA_verified.json"],
  ];
  const questions = es ? [
    ["¿Por qué no aparece el selector Bluetooth?", "Usa un navegador compatible con Web Bluetooth y abre AstroVital por HTTPS. Comprueba Bluetooth y sus permisos. En Chrome/Chromium para Linux puede ser necesario habilitar Experimental Web Platform features y reiniciar el navegador."],
    ["¿Qué hago si se pierde la señal?", "Revisa el contacto del sensor, la alimentación de la placa y Bluetooth. Si se desconectó, vuelve a conectar. Una lectura anterior puede aparecer como histórica; no confirma el estado actual."],
    ["¿Puedo cerrar la pestaña mientras captura?", "Mantén la pestaña abierta y el equipo activo. Recargar o cerrar la página interrumpe la captura y puede perder envíos pendientes de confirmación."],
    ["¿Cómo recupero el acceso?", "Utiliza la opción de recuperación de la pantalla de inicio de sesión. Si la recuperación está bloqueada o tu cuenta está inhabilitada, solicita revisión al administrador."],
    ["¿Qué significa un aviso?", "Señala una lectura o variación que conviene revisar. Consulta la evidencia, comprueba la captura y registra seguimiento. Las reglas del prototipo son demostrativas y no emiten diagnósticos."],
  ] : [
    ["Why is the Bluetooth chooser missing?", "Use a Web Bluetooth-compatible browser and open AstroVital over HTTPS. Check Bluetooth and permissions. Chrome/Chromium on Linux may require enabling Experimental Web Platform features and restarting the browser."],
    ["What if the signal is lost?", "Check sensor contact, board power and Bluetooth. Reconnect if disconnected. An earlier reading may be shown as historical; it does not confirm the current state."],
    ["Can I close the tab during capture?", "Keep the tab open and the computer active. Reloading or closing the page interrupts capture and may lose submissions awaiting confirmation."],
    ["How do I recover access?", "Use the recovery option on the sign-in screen. If recovery is locked or the account is disabled, ask the administrator to review it."],
    ["What does an alert mean?", "It flags a reading or change to review. Check the evidence and capture, and record follow-up. Prototype rules are demonstrative and do not provide diagnoses."],
  ];
  return <div className="public-page"><Header /><main className={styles.page}>
    <header className={styles.hero}><p>ASTROVITAL / {es ? "RECURSOS" : "RESOURCES"}</p><h1>{es ? "Lo que necesitas para empezar." : "What you need to get started."}</h1><span>{es ? "Uso de la plataforma, fuentes del proyecto y respuestas prácticas." : "Platform guidance, project sources and practical answers."}</span>
      <nav aria-label={es ? "Secciones de recursos" : "Resource sections"}><a href="#guia">{es ? "Guía de uso" : "User guide"} ↓</a><a href="#fuentes">{es ? "Fuentes científicas" : "Scientific sources"} ↓</a><a href="#ayuda">{es ? "Centro de ayuda" : "Help center"} ↓</a></nav>
    </header>
    <section id="guia" className={styles.section}><p className={styles.kicker}>01 / {es ? "GUÍA DE USO" : "USER GUIDE"}</p><h2>{es ? "Del acceso a la primera lectura." : "From sign-in to your first reading."}</h2><ol className={styles.steps}>{steps.map(([title, text], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol><Link className={styles.link} href="/login">{es ? "Ir a la plataforma" : "Go to the platform"} ↗</Link></section>
    <section id="fuentes" className={`${styles.section} ${styles.sources}`}><p className={styles.kicker}>02 / {es ? "FUENTES CIENTÍFICAS" : "SCIENTIFIC SOURCES"}</p><h2>{es ? "De dónde viene el contexto." : "Where the context comes from."}</h2><p className={styles.description}>{es ? "Estas fuentes están registradas en el proyecto. Cada entrada indica cómo se utiliza." : "These sources are recorded in the project. Each entry explains how it is used."}</p><div className={styles.sourceGrid}>{sources.map(([title, url, usage, text, file]) => <article key={title}><small>{usage}</small><h3><a href={url} target="_blank" rel="noreferrer">{title} ↗</a></h3><p>{text}</p><div className={styles.sourceLinks}><a href={`${repo}/blob/main/${file}`} target="_blank" rel="noreferrer">{es ? "Ver uso en el proyecto" : "See project usage"} ↗</a>{title.includes("Fact Sheets") && <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html" target="_blank" rel="noreferrer">Mars Fact Sheet ↗</a>}</div></article>)}</div></section>
    <section id="ayuda" className={styles.section}><p className={styles.kicker}>03 / {es ? "CENTRO DE AYUDA" : "HELP CENTER"}</p><h2>{es ? "Respuestas rápidas." : "Quick answers."}</h2><div className={styles.faq}>{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <aside className={styles.repository}><div><h2>{es ? "Código y documentación técnica" : "Code and technical documentation"}</h2><p>{es ? "Consulta la instalación, el protocolo de captura y el funcionamiento de los avisos en GitHub." : "Find installation, capture protocol and alert documentation on GitHub."}</p></div><a href={`${repo}/tree/main/docs`} target="_blank" rel="noreferrer">{es ? "Abrir repositorio" : "Open repository"} ↗</a></aside>
  </main><Footer /></div>;
}
