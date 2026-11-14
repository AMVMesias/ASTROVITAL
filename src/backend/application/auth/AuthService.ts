import { AppError, type Role, type Session, type User } from "../../domain/model";
import type { Repository } from "../../domain/repository";
import { digest, hashPassword, token, verifyPassword } from "../../infrastructure/security/credentials";
import { object, only, text } from "../../domain/validation";

const dummyHash = hashPassword("invalid-account-placeholder");
export function publicUser(user: User): User {
  return { id: user.id, username: user.username, name: user.name, role: user.role, enabled: user.enabled, astronautId: user.astronautId, missionId: user.missionId, moduleId: user.moduleId, createdAt: user.createdAt };
}
export class AuthService {
  constructor(private repo: Repository, private durationSeconds = 8 * 3600) {}
  login(value: unknown) {
    const input = object(value); only(input, ["username", "password"]);
    const username = text(input, "username", 1, 64).toLowerCase();
    if (typeof input.password !== "string" || input.password.length > 128) throw new AppError(401, "INVALID_CREDENTIALS", "Credenciales incorrectas o cuenta no disponible.");
    const blocked = this.repo.blockedUntil(username);
    if (blocked && blocked > new Date().toISOString()) throw new AppError(429, "LOGIN_THROTTLED", "Demasiados intentos. Intenta de nuevo en 15 minutos.");
    const user = this.repo.accountByUsername(username);
    const valid = verifyPassword(input.password, user?.passwordHash ?? dummyHash);
    if (!user?.enabled || !valid) {
      this.repo.loginFailure(username);
      throw new AppError(401, "INVALID_CREDENTIALS", "Credenciales incorrectas o cuenta no disponible.");
    }
    return this.repo.atomic(() => {
      this.repo.clearFailures(username);
      const raw = token();
      const expiresAt = new Date(Date.now() + this.durationSeconds * 1000).toISOString();
      this.repo.saveSession(digest(raw), user.id, expiresAt);
      return { token: raw, expiresAt, user: publicUser(user) };
    });
  }
  session(raw: string | undefined): Session {
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) throw new AppError(401, "UNAUTHENTICATED", "Inicia sesión para continuar.");
    return this.requireSession(digest(raw));
  }
  requireSession(id: string, role?: Role): Session {
    const record = this.repo.session(id);
    const user = record ? this.repo.account(record.userId) : null;
    if (!record || record.expiresAt <= new Date().toISOString() || !user?.enabled) throw new AppError(401, "UNAUTHENTICATED", "La sesión venció o fue revocada.");
    if (role && user.role !== role) throw new AppError(403, "FORBIDDEN", "No tienes permiso para esta operación.");
    return { ...publicUser(user), sessionId: id, expiresAt: record.expiresAt };
  }
  logout(session: Session) { this.repo.revokeSession(session.sessionId); }
}
