import { randomUUID } from "node:crypto";
import { AppError, type Account, type Role, type Session } from "../../domain/model";
import type { Repository } from "../../domain/repository";
import { object, only, password, text } from "../../domain/validation";
import { hashPassword } from "../../infrastructure/security/credentials";
import { AuthService, publicUser } from "../auth/AuthService";

export class UserService {
  constructor(private repo: Repository, private auth: AuthService) {}
  async list(session: Session) { (await this.auth.requireSession(session.sessionId, "admin")); return (await this.repo.users()); }
  async get(session: Session, id: string) {
    (await this.auth.requireSession(session.sessionId, "admin"));
    const user = (await this.repo.account(id));
    if (!user) throw new AppError(404, "NOT_FOUND", "Cuenta no encontrada.");
    return publicUser(user);
  }
  async save(session: Session, value: unknown, id?: string) {
    return (await this.repo.atomic(async () => {
      const author = (await this.auth.requireSession(session.sessionId, "admin"));
      const input = object(value); only(input, ["username", "name", "password", "role", "enabled"]);
      const existing = id ? (await this.repo.account(id)) : null;
      if (id && !existing) throw new AppError(404, "NOT_FOUND", "Cuenta no encontrada.");
      const username = "username" in input || !existing ? text(input, "username", 3, 64).toLowerCase() : existing.username;
      if (!/^[a-z0-9._-]+$/.test(username)) throw new AppError(400, "VALIDATION", "El usuario admite letras, números, punto, guion y guion bajo.", { username: "Formato inválido." });
      const duplicate = (await this.repo.accountByUsername(username));
      if (duplicate && duplicate.id !== id) throw new AppError(409, "USERNAME_EXISTS", "Ese usuario ya existe.", { username: "Ya está registrado." });
      const role = "role" in input ? input.role : existing?.role;
      if (role !== "admin" && role !== "astronauta") throw new AppError(400, "VALIDATION", "Rol inválido.");
      if ("enabled" in input && typeof input.enabled !== "boolean") throw new AppError(400, "VALIDATION", "enabled debe ser booleano.");
      const enabled = typeof input.enabled === "boolean" ? input.enabled : existing?.enabled ?? true;
      // Evita perder el único acceso administrativo del equipo local.
      if (existing?.role === "admin" && existing.enabled && (!enabled || role !== "admin") && (await (await this.repo.users()).filter(u => u.role === "admin" && u.enabled)).length === 1) throw new AppError(409, "LAST_ADMIN", "Debe permanecer al menos un admin habilitado.");
      const user: Account = {
        id: existing?.id ?? randomUUID(), username,
        name: "name" in input || !existing ? text(input, "name", 1, 120) : existing.name,
        role: role as Role, enabled, createdAt: existing?.createdAt ?? new Date().toISOString(),
        requiresOnboarding: !existing || "password" in input ? true : existing.requiresOnboarding,
        passwordHash: "password" in input || !existing ? hashPassword(password(input)) : existing.passwordHash,
        astronautId: existing?.astronautId ?? (role === "astronauta" ? randomUUID() : null),
        missionId: existing?.missionId ?? (role === "astronauta" ? "demo-mission" : null),
        moduleId: existing?.moduleId ?? (role === "astronauta" ? "demo-module" : null),
      };
      (await this.repo.saveAccount(user));
      if (existing && (role !== existing.role || !enabled || "password" in input)) {
        (await this.repo.revokeUserSessions(user.id));
        (await this.repo.resetRecovery(user.id,"password" in input));
      }
      (await this.repo.audit(author.id, user.id, existing ? "account_updated" : "account_created"));
      return publicUser(user);
    }));
  }
}
