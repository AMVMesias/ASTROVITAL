import { AppError } from "./model";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError(400, "VALIDATION", "Se requiere un objeto JSON.");
  return value as Record<string, unknown>;
}
export function only(input: Record<string, unknown>, keys: string[]) {
  const unknown = Object.keys(input).filter(key => !keys.includes(key));
  if (unknown.length) throw new AppError(400, "VALIDATION", "Campos no admitidos.", Object.fromEntries(unknown.map(key => [key, "Campo no admitido"])));
}
export function text(input: Record<string, unknown>, key: string, min = 1, max = 120) {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length < min || value.length > max) throw new AppError(400, "VALIDATION", `Revisa ${key}.`, { [key]: `Debe tener entre ${min} y ${max} caracteres.` });
  return value.trim();
}
export function password(input: Record<string, unknown>) {
  const value = input.password;
  if (typeof value !== "string" || value.length < 12 || value.length > 128) throw new AppError(400, "VALIDATION", "La contraseña debe tener entre 12 y 128 caracteres.", { password: "Usa de 12 a 128 caracteres." });
  return value;
}
export function date(value: unknown, field: string) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw new AppError(400, "VALIDATION", `${field} debe ser una fecha UTC ISO 8601.`, { [field]: "Usa una fecha UTC terminada en Z." });
  const normalized = new Date(value).toISOString();
  if (normalized.slice(0, 19) !== value.slice(0, 19)) throw new AppError(400, "VALIDATION", `Fecha ${field} inválida.`);
  return normalized;
}
