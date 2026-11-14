/** Catálogo del primer acceso. La integración real valida las respuestas en el servidor. */
export const SECURITY_QUESTIONS = [
  { id: "first-pet", label: "¿Cómo se llamaba tu primera mascota?" },
  { id: "childhood-city", label: "¿En qué ciudad pasaste tu infancia?" },
  { id: "first-school", label: "¿Cómo se llamaba tu primera escuela?" },
  {
    id: "childhood-friend",
    label: "¿Cómo se llamaba tu mejor amigo de la infancia?",
  },
  {
    id: "favorite-teacher",
    label: "¿Cuál era el apellido de tu profesor favorito?",
  },
  { id: "first-trip", label: "¿A qué lugar viajaste por primera vez?" },
] as const;
