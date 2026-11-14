# Idiomas del frontend

El layout raíz monta LanguageProvider. Los componentes cliente consumen useLanguage():

```tsx
const { t, locale, setLocale } = useLanguage();
return <button>{t("Iniciar sesión")}</button>;
```

El catálogo está en src/frontend/src/frontend/lib/i18n.ts. Los mensajes originales en español actúan como claves tipadas y cada uno tiene su traducción inglesa. Para añadir texto, incorpora su entrada al catálogo y usa t() en el componente. No compares el idioma en cada vista.

LanguageSelect usa la lista central de idiomas. El provider guarda la preferencia en localStorage, escucha cambios entre pestañas y actualiza el atributo lang del documento. El HTML inicial usa español y la preferencia se restaura al hidratar. Si el navegador bloquea el almacenamiento, el cambio sigue disponible durante la sesión.

Cobertura actual: navegación, portada, pie, páginas públicas de información y flujo de acceso/recuperación de demostración. Los mensajes de una futura API y los módulos pendientes del panel necesitan incorporarse al catálogo al implementar su integración. Los identificadores y las respuestas de las preguntas de seguridad son independientes del idioma.
