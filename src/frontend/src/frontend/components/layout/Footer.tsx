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
      ["Guía de uso", "/recursos#guia"],
      ["Fuentes científicas", "/recursos#fuentes"],
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
        <div className="social">
          <h2>{t("Síguenos")}</h2>
          <div>
            {[
              ["youtube", "YouTube"],
              ["x", "X"],
              ["instagram", "Instagram"],
              ["linkedin", "LinkedIn"],
            ].map(([icon, label]) => (
              <span key={icon} className="social-icon" role="img" aria-label={label}>
                <Icon name={icon} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
