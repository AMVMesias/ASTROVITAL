import { catalog } from "../../environment/catalog";
import { seedEnvironmentCatalog } from "./environmentRepository";
import { randomUUID } from "node:crypto";
import { AppError, indicatorConfig, type Account } from "../../../domain/model";
import { password } from "../../../domain/validation";
import { digest, hashPassword } from "../../security/credentials";
import { PostgresRepository } from "./PostgresRepository";

/** Semillas explícitas: no hay contraseñas por defecto ni inicialización al atender HTTP. */
export async function seed(repo: PostgresRepository, adminUsername: string, adminPassword: string) {
  password({ password: adminPassword });
  if (!/^[a-z0-9._-]{3,64}$/.test(adminUsername)) throw new AppError(400, "VALIDATION", "ADMIN_USERNAME inválido.");
  (await repo.atomic(async () => {
    (await repo.run("INSERT INTO missions VALUES('demo-mission','NASA Health · misión de simulación','Preparación') ON CONFLICT DO NOTHING"));
    (await repo.run("INSERT INTO modules VALUES('demo-module','demo-mission','Módulo de demostración') ON CONFLICT DO NOTHING"));
    for (const [id, config] of Object.entries(indicatorConfig)) (await repo.run("INSERT INTO indicators VALUES(?,'demo-format-1',?) ON CONFLICT DO NOTHING", id, JSON.stringify(config)));
    if (!(await repo.accountByUsername(adminUsername))) {
      const account: Account = { id: randomUUID(), username: adminUsername, name: "Administrador inicial", passwordHash: hashPassword(adminPassword), role: "admin", enabled: true, requiresOnboarding: true, astronautId: null, missionId: null, moduleId: null, createdAt: new Date().toISOString() };
      (await repo.saveAccount(account));
      (await repo.audit(account.id, account.id, "initial_admin_provisioned"));
    }
  }));
  (await seedEnvironmentCatalog(repo.db,catalog));
  (await repo.atomic(async () => {
    (await repo.run("INSERT INTO app_settings VALUES('environment_revision',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",catalog.revision));
    for(const user of (await repo.users())) if(user.astronautId) (await repo.saveAccount((await repo.account(user.id))!));
  }));
}

export async function provisionDevice(repo: PostgresRepository, username: string, deviceId: string, credential: string) {
  if (credential.length < 32 || credential.length > 256 || !/^[a-zA-Z0-9._-]{1,64}$/.test(deviceId)) throw new AppError(400, "VALIDATION", "Dispositivo inválido o credencial menor de 32 caracteres.");
  const user = (await repo.accountByUsername(username));
  if (!user?.astronautId || user.role !== "astronauta" || !user.enabled) throw new AppError(400, "VALIDATION", "Primero crea una cuenta habilitada de astronauta.");
  (await repo.atomic(async () => {
    const previous = (await repo.device(deviceId));
    // Un dispositivo con historial no se reasigna silenciosamente a otra persona.
    if (previous && previous.astronautId !== user.astronautId) throw new AppError(409, "DEVICE_BINDING_CONFLICT", "Usa otro ID para un nuevo vínculo; conserva el dispositivo histórico.");
    (await repo.run("INSERT INTO devices(id,astronaut_id,credential_hash,enabled) VALUES(?,?,?,1) ON CONFLICT(id) DO UPDATE SET credential_hash=excluded.credential_hash,enabled=1", deviceId, user.astronautId, digest(credential)));
  }));
}
