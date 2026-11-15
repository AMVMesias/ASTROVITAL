"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "../../frontend/components/layout/Header";
import { Footer } from "../../frontend/components/layout/Footer";
import { AdminIcon } from "../../frontend/components/ui/AdminIcon";
import { useLanguage } from "../../frontend/providers/LanguageProvider";
import styles from "./about.module.css";

const repository = "https://github.com/AMVMesias/ASTROVITAL";
const sections = ["proyecto", "objetivos", "equipo"] as const;
type Section = typeof sections[number];

export function AboutProject() {
  const { locale } = useLanguage();
  const es = locale === "es";
  const [active, setActive] = useState<Section>("proyecto");
  const [objective, setObjective] = useState(0);
  const [scenario, setScenario] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id as Section);
    }, { rootMargin: "-15% 0px -55% 0px", threshold: 0 });
    sections.forEach(id => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, []);

  const objectives = es ? [
    { icon: "pulse", title: "Medir", summary: "Escuchar lo que el cuerpo cuenta.", detail: "Reunir ECG, frecuencia cardíaca, SpO₂ y respiración desde sensores conectados por ESP32 y Bluetooth. Complementar la captura con registros de sueño, actividad y bienestar.", label: "DE LA SEÑAL AL REGISTRO", steps: ["Sensores", "ESP32 · BLE", "Lectura registrada"] },
    { icon: "chart", title: "Comprender", summary: "Convertir datos en una historia clara.", detail: "Mostrar tendencias, historial y referencias personales comparables. Distinguir una lectura actual de una antigua, y comunicar cuándo la señal o el contexto son insuficientes.", label: "DEL REGISTRO AL CONTEXTO", steps: ["Historial", "Referencia personal", "Tendencias"] },
    { icon: "bell", title: "Orientar", summary: "Hacer comprensible el siguiente paso.", detail: "Explicar qué activó un aviso y proponer acciones para comprobar la captura. Conservar cada detección y su seguimiento, con reglas demostrativas y sin emitir diagnósticos automáticos.", label: "DE LA EVIDENCIA A LA ACCIÓN", steps: ["Reglas explicables", "Verificación", "Seguimiento"] },
    { icon: "layers", title: "Contextualizar", summary: "Mirar la salud con perspectiva espacial.", detail: "Relacionar el seguimiento con el escenario de misión seleccionado y sus referencias científicas. Mantener separadas las series históricas de radiación y las mediciones personales de la tripulación.", label: "DE LA MISIÓN A LA PERSPECTIVA", steps: ["Escenario", "Referencias NASA", "Contexto de misión"] },
  ] : [
    { icon: "pulse", title: "Measure", summary: "Listen to what the body tells us.", detail: "Bring together ECG, heart rate, SpO₂ and respiration from sensors connected through ESP32 and Bluetooth. Add sleep, activity and wellbeing records to the capture.", label: "FROM SIGNAL TO RECORD", steps: ["Sensors", "ESP32 · BLE", "Recorded reading"] },
    { icon: "chart", title: "Understand", summary: "Turn data into a clear story.", detail: "Show trends, history and comparable personal baselines. Distinguish current readings from historical ones, and explain when signal quality or context is insufficient.", label: "FROM RECORD TO CONTEXT", steps: ["History", "Personal baseline", "Trends"] },
    { icon: "bell", title: "Guide", summary: "Make the next step understandable.", detail: "Explain what triggered an alert and suggest ways to verify the capture. Preserve each detection and its follow-up, using demonstration rules without automatic diagnoses.", label: "FROM EVIDENCE TO ACTION", steps: ["Explainable rules", "Verification", "Follow-up"] },
    { icon: "layers", title: "Contextualize", summary: "See health from a space perspective.", detail: "Connect monitoring with the selected mission scenario and its scientific references. Keep historical radiation series separate from the crew's personal measurements.", label: "FROM MISSION TO PERSPECTIVE", steps: ["Scenario", "NASA references", "Mission context"] },
  ];
  const scenarios = [
    { name: es ? "Estación espacial" : "Space station", code: "01 / ISS", className: styles.earth, instrument: "ISS · LEO", count: "—", text: es ? "La vida en órbita, con el contexto de cabina y microgravedad. El informe no incluye una serie instrumental de radiación ISS; no se reemplaza por datos de otra misión." : "Life in orbit, with cabin and microgravity context. The report includes no ISS instrumental radiation series; data from other missions is not substituted.", location: es ? "Órbita terrestre baja" : "Low Earth orbit" },
    { name: es ? "Luna" : "Moon", code: "02 / MOON", className: styles.moon, instrument: "LRO · CRaTER-D1D2", count: "71.626", text: es ? "Una referencia para explorar el entorno lunar. La serie CRaTER corresponde a órbita lunar: no representa la superficie, el interior del traje ni la dosis del astronauta." : "A reference for exploring the lunar environment. CRaTER data comes from lunar orbit: it does not represent the surface, a spacesuit interior or an astronaut's dose.", location: es ? "Referencia de órbita lunar" : "Lunar orbit reference" },
    { name: es ? "Marte" : "Mars", code: "03 / MARS", className: styles.mars, instrument: "Curiosity · MSL-RAD", count: "274.998", text: es ? "El siguiente horizonte de la exploración. MSL-RAD aporta un resumen histórico de radiación medido por un detector en Curiosity, no una estimación de exposición personal." : "The next horizon of exploration. MSL-RAD provides a historical radiation summary measured by a detector on Curiosity, not a personal exposure estimate.", location: es ? "Superficie marciana" : "Martian surface" },
    { name: es ? "Tránsito espacial" : "Space transit", code: "04 / ORION", className: styles.transit, instrument: "Artemis I · EAD-MU01", count: "7.303", text: es ? "Más allá de la órbita terrestre. Los registros de Orion durante Artemis I ayudan a describir un entorno instrumental histórico, sin convertirlo en una dosis personal universal." : "Beyond Earth orbit. Orion records from Artemis I describe a historical instrumental environment without turning it into a universal personal dose.", location: es ? "A bordo de Orion" : "Aboard Orion" },
  ];
  const selected = scenarios[scenario];
  const goal = objectives[objective];
  const labels = es ? ["El proyecto", "Objetivos", "Equipo"] : ["The project", "Objectives", "Team"];

  return <div className="public-page">
    <Header />
    <main className={styles.page}>
      <section id="proyecto" className={styles.hero} aria-labelledby="about-title">
        <div className={styles.heroArt} role="img" aria-label={es ? "Ilustración conceptual de un astronauta sobre la Tierra, tomada de la ficha del proyecto" : "Conceptual illustration of an astronaut above Earth from the project report"} />
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}><span /> NASA SPACE APPS CHALLENGE 2026</p>
          <h1 id="about-title">{es ? <>Más lejos.<br />Más conectados.<br /><em>Más humanos.</em></> : <>Further away.<br />More connected.<br /><em>More human.</em></>}</h1>
          <p className={styles.heroDescription}>{es ? "La exploración lleva a las personas más allá de la Tierra. AstroVital lleva el seguimiento de su salud un paso más cerca." : "Exploration takes people beyond Earth. AstroVital brings their health monitoring one step closer."}</p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="#objetivos">{es ? "Explora nuestra misión" : "Explore our mission"}<span aria-hidden="true">↗</span></a>
            <a className={styles.heroLink} href="/project/astrovital-ficha.pdf" target="_blank" rel="noreferrer">{es ? "Ver ficha del proyecto" : "View project report (Spanish)"}<span aria-hidden="true">↗</span></a>
          </div>
          <p className={styles.heroNote}>{es ? "Un prototipo académico. Una visión centrada en la tripulación." : "An academic prototype. A crew-centered vision."}</p>
        </div>
        <div className={styles.orbitalNote}><span className={styles.signal} aria-hidden="true" /><span>ASTROVITAL / MISSION BRIEF<br /><strong>{es ? "Tecnología al servicio de las personas" : "Technology serving people"}</strong></span></div>
        <span className={styles.artCredit}>{es ? "Ilustración conceptual · asistida por IA" : "Conceptual illustration · AI-assisted"}</span>
      </section>

      <nav className={styles.sectionNav} aria-label={es ? "Secciones del proyecto" : "Project sections"}>
        <span className={styles.navBrand}>ASTRO<span>VITAL</span> <span className={styles.navSlash}>/</span></span>
        <div>{sections.map((id, index) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => setActive(id)}><small>0{index + 1}</small>{labels[index]}</a>)}</div>
        <a className={styles.navRepository} href={repository} target="_blank" rel="noreferrer">{es ? "Código abierto" : "Open source"} ↗</a>
      </nav>

      <section className={`${styles.section} ${styles.intro}`} aria-labelledby="intro-title">
        <div><p className={styles.kicker}>{es ? "01 / NUESTRA RAZÓN DE SER" : "01 / WHY WE EXIST"}</p><h2 id="intro-title">{es ? <>En el centro de cada misión,<br /><em>hay una persona.</em></> : <>At the heart of every mission,<br /><em>there is a person.</em></>}</h2></div>
        <div className={styles.introCopy}><p>{es ? "La distancia, el aislamiento y los entornos exigentes hacen del seguimiento de la salud una parte esencial de la exploración. Creemos que comprender una lectura debería ser tan importante como obtenerla." : "Distance, isolation and demanding environments make health monitoring an essential part of exploration. We believe understanding a reading should be as important as capturing it."}</p><p>{es ? "Por eso unimos sensores físicos, registros personales, tendencias y reglas explicables en una experiencia que ayuda a observar cambios y darles seguimiento." : "That is why we bring physical sensors, personal records, trends and explainable rules into an experience that helps people notice and follow up on changes."}</p></div>
        <div className={styles.principles}>{(es ? [["Señales reales", "Captura física con ESP32"], ["Contexto visible", "Vigencia, calidad y actividad"], ["Decisiones explicables", "Evidencia detrás de cada aviso"]] : [["Real signals", "Physical capture with ESP32"], ["Visible context", "Freshness, quality and activity"], ["Explainable decisions", "Evidence behind each alert"]]).map(([title, text], i) => <div key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>
      </section>

      <section id="objetivos" className={`${styles.section} ${styles.objectives}`} aria-labelledby="objectives-title">
        <div className={styles.sectionHeading}><div><p className={styles.kicker}>{es ? "02 / OBJETIVOS" : "02 / OBJECTIVES"}</p><h2 id="objectives-title">{es ? <>De una señal a una<br /><em>mejor comprensión.</em></> : <>From a signal to<br /><em>better understanding.</em></>}</h2></div><p>{es ? "Cuatro propósitos conectados por una misma idea: poner la información al alcance de la tripulación." : "Four purposes connected by one idea: put information within the crew's reach."}</p></div>
        <div className={styles.goalLayout}>
          <div className={styles.goalButtons} aria-label={es ? "Seleccionar objetivo" : "Select an objective"}>{objectives.map((item, index) => <button key={item.title} type="button" aria-pressed={objective === index} aria-controls="goal-detail" onClick={() => setObjective(index)}><span className={styles.goalIcon}><AdminIcon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.summary}</small></span><span className={styles.goalArrow} aria-hidden="true">↗</span></button>)}</div>
          <div id="goal-detail" className={styles.goalDetail} aria-live="polite" aria-atomic="true"><div key={objective} className={styles.detailInner}><div className={styles.detailTop}><span>0{objective + 1} / 04</span><AdminIcon name={goal.icon} /></div><p className={styles.detailLabel}>{goal.label}</p><h3>{goal.title}<span>.</span></h3><p>{goal.detail}</p><div className={styles.flow}>{goal.steps.map((step, i) => <div key={step}><span>0{i + 1}</span><strong>{step}</strong>{i < 2 && <b aria-hidden="true">→</b>}</div>)}</div></div></div>
        </div>
      </section>

      <section className={styles.scenarios} aria-labelledby="scenario-title"><div className={styles.scenarioWrap}>
        <div className={styles.sectionHeading}><div><p className={styles.kicker}>{es ? "PERSPECTIVA DE MISIÓN" : "MISSION PERSPECTIVE"}</p><h2 id="scenario-title">{es ? <>Un mismo propósito.<br /><em>Diferentes horizontes.</em></> : <>One shared purpose.<br /><em>Different horizons.</em></>}</h2></div><p>{es ? "Explora los escenarios y conoce qué aportan las referencias científicas del proyecto." : "Explore the scenarios and discover what the project's scientific references contribute."}</p></div>
        <div className={styles.scenarioTabs} aria-label={es ? "Elegir escenario" : "Choose a scenario"}>{scenarios.map((item, index) => <button key={item.code} type="button" aria-pressed={scenario === index} aria-controls="scenario-detail" onClick={() => setScenario(index)}>{item.name}<span aria-hidden="true">↗</span></button>)}</div>
        <div className={styles.scenarioDetail} id="scenario-detail" aria-live="polite" aria-atomic="true"><div className={`${styles.planetFrame} ${selected.className}`} aria-hidden="true"><div className={styles.planetOrbit} /><div className={styles.planet} /><span>{selected.code}</span><small>{es ? "REPRESENTACIÓN CONCEPTUAL" : "CONCEPTUAL REPRESENTATION"}</small></div><div className={styles.scenarioCopy} key={scenario}><span className={styles.scenarioLocation}>{selected.location}</span><h3>{selected.name}</h3><p>{selected.text}</p><div className={styles.scenarioStats}><div><small>{es ? "MISIÓN / INSTRUMENTO" : "MISSION / INSTRUMENT"}</small><strong>{selected.instrument}</strong></div><div><small>{es ? "REGISTROS REPORTADOS" : "REPORTED RECORDS"}</small><strong>{locale === "en" ? selected.count.replaceAll(".", ",") : selected.count}</strong></div></div><a href="https://visualization.osdr.nasa.gov/radlab/gui/overview/" target="_blank" rel="noreferrer">{es ? "Explorar NASA RadLab" : "Explore NASA RadLab"} ↗</a></div></div>
        <p className={styles.scenarioNote}>{es ? "Referencias históricas instrumentales; no son dosis personales ni límites de seguridad. Conteos y resúmenes aportados, no reproducidos sin los CSV originales." : "Historical instrumental references, not personal doses or safety limits. Supplied counts and summaries have not been reproduced without the original CSV files."}</p>
      </div></section>

      <section id="equipo" className={`${styles.section} ${styles.team}`} aria-labelledby="team-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>{es ? "03 / EL EQUIPO DETRÁS" : "03 / THE TEAM BEHIND IT"}</p><h2 id="team-title">{es ? <>La misión se construye<br /><em>en equipo.</em></> : <>A mission is built<br /><em>together.</em></>}</h2></div><p>{es ? "AstroVital reúne desarrollo de software, integración de sensores e investigación para dar forma a una experiencia compartida." : "AstroVital brings software development, sensor integration and research together to shape a shared experience."}</p></div>
        <div className={styles.teamCards}>{(es ? [
          ["chip", "01", "Ingeniería e integración", "De la placa a la plataforma.", "Captura con ESP32 y BLE, servicios backend, persistencia y una interfaz que conecta cada parte de la experiencia."],
          ["layers", "02", "Investigación y contexto", "De las fuentes a la perspectiva.", "Organización de referencias NASA, escenarios ambientales y reglas demostrativas con sus alcances y limitaciones visibles."],
          ["users", "03", "Diseño y comunicación", "De la información a las personas.", "Jerarquía visual, explicaciones comprensibles y documentación para acercar el seguimiento a la tripulación."],
        ] : [
          ["chip", "01", "Engineering & integration", "From the board to the platform.", "ESP32 and BLE capture, backend services, persistence and an interface connecting every part of the experience."],
          ["layers", "02", "Research & context", "From sources to perspective.", "NASA references, environmental scenarios and demonstration rules with visible scope and limitations."],
          ["users", "03", "Design & communication", "From information to people.", "Visual hierarchy, understandable explanations and documentation that bring monitoring closer to the crew."],
        ]).map(([icon, number, title, subtitle, text]) => <article key={number}><div className={styles.teamCardTop}><AdminIcon name={icon} /><span>{number}</span></div><h3>{title}</h3><strong>{subtitle}</strong><p>{text}</p></article>)}</div>
        <div className={styles.transparency}><span className={styles.transparencyIcon}><AdminIcon name="check" /></span><div><h3>{es ? "Tecnología abierta. Responsabilidad humana." : "Open technology. Human responsibility."}</h3><p>{es ? "ChatGPT y Codex de OpenAI apoyaron la programación, el diseño y la documentación. El equipo integra, revisa y asume las decisiones finales de ingeniería. El código se comparte bajo licencia MIT; los recursos de terceros mantienen sus propias condiciones." : "OpenAI's ChatGPT and Codex assisted with programming, design and documentation. The team integrates, reviews and owns the final engineering decisions. Code is shared under the MIT license; third-party resources retain their own terms."}</p></div><a href={repository} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a></div>
      </section>

      <section className={styles.closing}><div className={styles.closingOrbit} aria-hidden="true" /><p className={styles.eyebrow}>ASTROVITAL / {es ? "EL SIGUIENTE PASO" : "THE NEXT STEP"}</p><h2>{es ? <>Explorar el espacio.<br /><em>Cuidar de quienes lo hacen.</em></> : <>Explore space.<br /><em>Care for those who do.</em></>}</h2><p>{es ? "Conoce la plataforma y descubre cómo se conectan las señales, el contexto y el seguimiento." : "Get to know the platform and see how signals, context and follow-up come together."}</p><div className={styles.closingActions}><Link href="/login" className={styles.primary}>{es ? "Entrar a AstroVital" : "Enter AstroVital"} <span aria-hidden="true">↗</span></Link><a href="/project/astrovital-ficha.pdf" download="AstroVital-ficha-proyecto.pdf" className={styles.download}>{es ? "Descargar ficha del proyecto" : "Download report (Spanish)"} <span aria-hidden="true">↓</span></a></div><small>{es ? "Prototipo académico de apoyo al seguimiento. No constituye un diagnóstico médico ni está certificado para vuelo o EVA." : "Academic monitoring support prototype. It is not a medical diagnosis and is not certified for spaceflight or EVA."}</small></section>
    </main>
    <Footer />
  </div>;
}
