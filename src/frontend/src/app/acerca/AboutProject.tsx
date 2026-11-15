"use client";

import Link from "next/link";
import { Header } from "../../frontend/components/layout/Header";
import { Footer } from "../../frontend/components/layout/Footer";
import { AdminIcon } from "../../frontend/components/ui/AdminIcon";
import { useLanguage } from "../../frontend/providers/LanguageProvider";
import styles from "./about.module.css";

const repository = "https://github.com/AMVMesias/ASTROVITAL";

export function AboutProject() {
  const { locale } = useLanguage();
  const es = locale === "es";
  const goals = es ? [
    ["pulse", "Medir", "Capturar pulso, SpO₂, respiración y señal ECG con sensores conectados por ESP32."],
    ["chart", "Comprender", "Consultar el historial y las tendencias, con la calidad y vigencia de cada lectura visibles."],
    ["bell", "Dar seguimiento", "Entender qué activó un aviso y registrar observaciones para su revisión."],
    ["layers", "Contextualizar", "Explorar escenarios de misión con referencias científicas NASA."],
  ] : [
    ["pulse", "Measure", "Capture heart rate, SpO₂, respiration and ECG signals with ESP32-connected sensors."],
    ["chart", "Understand", "Review history and trends with the quality and freshness of each reading visible."],
    ["bell", "Follow up", "Understand what triggered an alert and record observations for review."],
    ["layers", "Add context", "Explore mission scenarios with NASA scientific references."],
  ];

  return <div className="public-page">
    <Header />
    <main className={styles.page}>
      <section id="proyecto" className={styles.hero} aria-labelledby="about-title">
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>ASTROVITAL / {es ? "EL PROYECTO" : "THE PROJECT"}</p>
          <h1 id="about-title">{es ? <>Salud conectada.<br /><em>También en el espacio.</em></> : <>Connected health.<br /><em>Even in space.</em></>}</h1>
          <p>{es ? "Un prototipo académico que reúne sensores, registros personales y avisos para facilitar el seguimiento de la salud de la tripulación." : "An academic prototype bringing sensors, personal records and alerts together to support crew health monitoring."}</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#objetivos">{es ? "Conoce los objetivos" : "Our objectives"} <span aria-hidden="true">↓</span></a>
            <a className={styles.reportLink} href="/project/astrovital-entrega.pdf" target="_blank" rel="noreferrer">{es?"Ficha del proyecto · ES / EN ↗":"Project brief · ES / EN ↗"}</a>
            <a className={styles.reportLink} href="/project/astrovital-ficha.pdf" target="_blank" rel="noreferrer">Detalle técnico · Español ↗</a>
            <a className={styles.reportLink} href="/project/astrovital-ficha-en.pdf" target="_blank" rel="noreferrer">Technical detail · English ↗</a>
          </div>
        </div>
      </section>

      <nav className={styles.sectionNav} aria-label={es ? "Secciones del proyecto" : "Project sections"}>
        <a href="#proyecto">{es ? "Acerca del proyecto" : "About the project"}</a>
        <a href="#objetivos">{es ? "Objetivos" : "Objectives"}</a>
        <a href="#equipo">{es ? "Equipo" : "Team"}</a>
      </nav>

      <section id="objetivos" className={styles.section} aria-labelledby="goals-title">
        <p className={styles.kicker}>{es ? "LO QUE BUSCAMOS" : "OUR PURPOSE"}</p>
        <h2 id="goals-title">{es ? "Medir, comprender y acompañar." : "Measure, understand and support."}</h2>
        <div className={styles.goals}>{goals.map(([icon, title, text], i) => <article key={icon}>
          <div className={styles.cardTop}><AdminIcon name={icon} /><span>0{i + 1}</span></div>
          <h3>{title}</h3><p>{text}</p>
        </article>)}</div>
        <p className={styles.note}>{es ? "Las reglas son demostrativas. Los avisos orientan la revisión; no son diagnósticos. Las referencias ambientales históricas no representan dosis personales." : "Rules are demonstrative. Alerts support review; they are not diagnoses. Historical environmental references do not represent personal doses."}</p>
      </section>

      <section id="equipo" className={styles.team} aria-labelledby="team-title"><div className={styles.teamInner}>
        <div><p className={styles.kicker}>{es ? "DETRÁS DE ASTROVITAL" : "BEHIND ASTROVITAL"}</p><h2 id="team-title">20_Codengineers</h2><p>{es ? "El equipo que desarrolla AstroVital." : "The team developing AstroVital."}</p></div>
        <div className={styles.teamCopy}><p>{es ? "Desarrollo de software, integración de sensores, investigación y diseño se unen en este prototipo para NASA Space Apps Challenge 2026." : "Software development, sensor integration, research and design come together in this prototype for NASA Space Apps Challenge 2026."}</p>
          <ul className={styles.members}>
            <li><strong>Mesias Mariscal</strong> · {es ? "Líder" : "Team lead"}</li>
            <li>Denise Rea</li>
            <li>José Joaquín Silva Escobar</li>
            <li>Gabriel José Freitas</li>
            <li>Leonel Alejandro Tipan Quinto</li>
          </ul>
          <p className={styles.aiNote}>{es ? "ChatGPT y Codex apoyaron el desarrollo y la documentación, con revisión y decisiones finales del equipo." : "ChatGPT and Codex assisted development and documentation, with review and final decisions by the team."}</p>
          <a href={repository} target="_blank" rel="noreferrer">{es ? "Conoce el código en GitHub" : "Explore the code on GitHub"} ↗</a>
        </div>
      </div></section>

      <section className={styles.closing} aria-label={es ? "Acceso a la plataforma" : "Platform access"}>
        <div><h2>{es ? "Conoce AstroVital en acción." : "Discover AstroVital in action."}</h2><p>{es ? "Señales, contexto y seguimiento en un mismo lugar." : "Signals, context and follow-up in one place."}</p></div>
        <Link href="/login" className={styles.primary}>{es ? "Entrar a la plataforma" : "Enter the platform"} <span aria-hidden="true">↗</span></Link>
      </section>
    </main>
    <Footer />
  </div>;
}
