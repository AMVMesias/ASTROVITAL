"use client";
import { useLanguage } from "../../providers/LanguageProvider";
import Link from "next/link";
import { Brand } from "./Brand";
import { Icon } from "../ui/Icon";
const groups = [
  {
    title: "Proyecto",
    links: [
      ["Acerca del proyecto", "/acerca"],
      ["Objetivos", "/acerca#objetivos"],
      ["Equipo", "/acerca#equipo"],
    ],
  },
  {
    title: "Recursos",
    links: [
      ["Documentación", "/recursos"],
      ["Publicaciones", "/recursos#publicaciones"],
      ["Centro de ayuda", "/recursos#ayuda"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacidad", "/legal#privacidad"],
      ["Términos de uso", "/legal#terminos"],
      ["Accesibilidad", "/legal#accesibilidad"],
    ],
  },
] as const;
export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <Brand footer />
        {groups.map((group) => (
          <div className="footer-group" key={group.title}>
            <h2>{t(group.title)}</h2>
            {group.links.map(([text, url]) => (
              <Link key={text} href={url}>
                {t(text)}
              </Link>
            ))}
          </div>
        ))}
        <div className="mobile-footer-groups">
          {groups.map((group) => (
            <details key={group.title}>
              <summary>{t(group.title)}</summary>
              <div>
                {group.links.map(([text, url]) => (
                  <Link key={text} href={url}>
                    {t(text)}
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </div>
        <div className="social">
          <h2>{t("Síguenos")}</h2>
          <div>
            {[
              ["youtube", "YouTube", "https://www.youtube.com/@NASA"],
              ["x", "X", "https://x.com/NASA"],
              ["instagram", "Instagram", "https://www.instagram.com/nasa/"],
              [
                "linkedin",
                "LinkedIn",
                "https://www.linkedin.com/company/nasa/",
              ],
            ].map(([icon, label, href]) => (
              <a
                key={icon}
                href={href}
                aria-label={`${t("NASA en")} ${label}`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name={icon} />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>NASA Space Apps Challenge 2026</span>
        <span>
          {t("Prototipo académico")}
          <b>·</b> NASA Health v1.0
        </span>
      </div>
    </footer>
  );
}
