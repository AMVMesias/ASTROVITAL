import type { Account, Device, Measurement, MeasurementQuery, User } from "./model";

export interface Repository {
  atomic<T>(work: () => T | Promise<T>): Promise<T>;
  account(id: string): Promise<Account | null>;
  accountByUsername(username: string): Promise<Account | null>;
  users(): Promise<User[]>;
  saveAccount(account: Account): Promise<void>;
  audit(authorId: string, targetId: string, action: string): Promise<void>;
  session(id: string): Promise<{ userId: string; expiresAt: string } | null>;
  saveSession(id: string, userId: string, expiresAt: string): Promise<void>;
  claimSession(user: Account, id: string, expiresAt: string, currentId?: string): Promise<{ id: string; expiresAt: string }>;
  sessionAccount(id: string): Promise<{ user: Account; expiresAt: string } | null>;
  revokeSession(id: string): Promise<void>;
  revokeUserSessions(userId: string): Promise<void>;
  blockedUntil(username: string): Promise<string | null>;
  loginFailure(username: string): Promise<void>;
  clearFailures(username: string): Promise<void>;
  resetRecovery(userId: string, clearAnswers: boolean): Promise<void>;
  device(id: string): Promise<(Device & { credentialHash: string }) | null>;
  devices(astronautId: string): Promise<Device[]>;
  touchDevice(id: string, at: string): Promise<void>;
  signalStatus(id: string, status: string, observedAt: string, receivedAt: string): Promise<void>;
  deviceReading(deviceId: string, readingId: string): Promise<{ measurement: Measurement; fingerprint: string } | null>;
  saveMeasurement(measurement: Measurement, fingerprint: string): Promise<void>;
  measurements(astronautId: string, query: MeasurementQuery): Promise<Measurement[]>;
  latest(astronautId: string): Promise<Measurement[]>;
}
