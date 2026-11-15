import { AppError, type Role, type Session, type User } from "../../domain/model";
import type { Repository } from "../../domain/repository";
import { digest, hashPassword, token, verifyPassword } from "../../infrastructure/security/credentials";
import { object, only, text } from "../../domain/validation";

const dummyHash = hashPassword("invalid-account-placeholder");
export function publicUser(user: User): User {
  return { id: user.id, username: user.username, name: user.name, role: user.role, enabled: user.enabled, requiresOnboarding: user.requiresOnboarding, astronautId: user.astronautId, missionId: user.missionId, moduleId: user.moduleId, createdAt: user.createdAt };
}
export class AuthService {
  constructor(private repo: Repository, private durationSeconds = 8 * 3600) {}
  async login(value: unknown) {
    const input = object(value); only(input, ["username", "password"]);
    const username = text(input, "username", 1, 64).toLowerCase();
    if (typeof input.password !== "string" || input.password.length > 128) throw new AppError(401, "INVALID_CREDENTIALS", "Credenciales incorrectas o cuenta no disponible.");
    const blocked = (await this.repo.blockedUntil(username));
    if (blocked && blocked > new Date().toISOString()) throw new AppError(429, "LOGIN_THROTTLED", "Demasiados intentos. Intenta de nuevo en 15 minutos.");
    const user = (await this.repo.accountByUsername(username));
    const valid = verifyPassword(input.password, user?.passwordHash ?? dummyHash);
    if (!user?.enabled || !valid) {
      (await this.repo.loginFailure(username));
      throw new AppError(401, "INVALID_CREDENTIALS", "Credenciales incorrectas o cuenta no disponible.");
    }
    return (await this.repo.atomic(async () => {
      (await this.repo.clearFailures(username));
      const raw = token();
      const expiresAt = new Date(Date.now() + this.durationSeconds * 1000).toISOString();
      (await this.repo.saveSession(digest(raw), user.id, expiresAt));
      return { token: raw, expiresAt, user: publicUser(user) };
    }));
  }
  async session(raw: string | undefined): Promise<Session> {
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) throw new AppError(401, "UNAUTHENTICATED", "Inicia sesión para continuar.");
    return this.requireSession(digest(raw), undefined, true);
  }
  async requireSession(id: string, role?: Role, allowOnboarding = false): Promise<Session> {
    const record = (await this.repo.session(id));
    const user = record ? (await this.repo.account(record.userId)) : null;
    if (!record || record.expiresAt <= new Date().toISOString() || !user?.enabled) throw new AppError(401, "UNAUTHENTICATED", "La sesión venció o fue revocada.");
    if (role && user.role !== role) throw new AppError(403, "FORBIDDEN", "No tienes permiso para esta operación.");
    if (user.requiresOnboarding && !allowOnboarding) throw new AppError(403, "ONBOARDING_REQUIRED", "Completa el primer acceso antes de continuar.");
    return { ...publicUser(user), sessionId: id, expiresAt: record.expiresAt };
  }
  async logout(session: Session) { (await this.repo.revokeSession(session.sessionId)); }
}
