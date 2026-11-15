import type { Assessment, PersonalMeasurement } from "./assessMeasurements";

export type Recommendation = {
  id: string;
  version: string;
  action: "repeat_reading" | "collect_history" | "track";
  message: { es: string; en: string };
};

function card(id: string, action: Recommendation["action"], es: string, en: string): Recommendation {
  return { id, version: "1", action, message: { es, en } };
}

const recommendations = {
  invalid: card("invalid-reading", "repeat_reading",
    "Comprueba la captura o el contacto del sensor y registra una lectura nueva.",
    "Check the capture or sensor contact and record a new reading."),
  stale: card("stale-reading", "repeat_reading",
    "La última lectura está desactualizada. Registra una lectura nueva.",
    "The last reading is out of date. Record a new reading."),
  insufficient: card("insufficient-history", "collect_history",
    "Faltan lecturas válidas en el mismo escenario y actividad. Continúa registrándolas para construir tu referencia.",
    "More valid readings from the same scenario and activity are needed. Keep recording them to build your baseline."),
  sleepBelow: card("sleep-below-baseline", "track",
    "Revisa si hubo interrupciones del descanso o cambios de horario y registra una observación.",
    "Check for sleep interruptions or schedule changes and record an observation."),
  sleepAbove: card("sleep-above-baseline", "track",
    "Revisa qué cambió en tu horario o rutina de descanso y registra una observación.",
    "Review what changed in your sleep schedule or routine and record an observation."),
  wellbeing: card("wellbeing-change", "track",
    "Revisa qué cambió desde tus registros anteriores y anótalo en el seguimiento.",
    "Review what changed since your previous entries and record it in the follow-up."),
  pulseRest: card("pulse-rest", "track",
    "Revisa si las lecturas se tomaron en reposo y registra el contexto del cambio.",
    "Check whether the readings were taken at rest and record the circumstances of the change."),
  pulseExercise: card("pulse-exercise", "track",
    "Registra el tipo de ejercicio y el nivel de esfuerzo de las lecturas.",
    "Record the type of exercise and effort level for these readings."),
  pulseEva: card("pulse-eva", "track",
    "Registra la tarea y el nivel de esfuerzo durante la actividad extravehicular.",
    "Record the task and effort level during the extravehicular activity."),
  pulseUnknown: card("pulse-unknown-activity", "track",
    "Registra si estabas en reposo, haciendo ejercicio o en actividad extravehicular.",
    "Record whether you were resting, exercising, or doing extravehicular activity."),
};

export function selectRecommendation(assessment: Assessment, reading: PersonalMeasurement): Recommendation | undefined {
  switch (assessment.status) {
    case "invalid":
    case "stale":
    case "insufficient":
      return recommendations[assessment.status];
    case "stable":
      return undefined;
    case "deviation":
      break;
  }

  switch (reading.indicator) {
    case "sleep":
      return assessment.direction === "below" ? recommendations.sleepBelow : recommendations.sleepAbove;
    case "wellbeing":
      return recommendations.wellbeing;
    case "heart_rate":
      switch (reading.activity) {
        case "rest": return recommendations.pulseRest;
        case "exercise": return recommendations.pulseExercise;
        case "eva": return recommendations.pulseEva;
        default: return recommendations.pulseUnknown;
      }
    default:
      return undefined;
  }
}
