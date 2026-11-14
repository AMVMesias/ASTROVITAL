import type { Account, Device, Measurement, MeasurementQuery, QueueRecord, User } from "./model";

export interface Repository {
  atomic<T>(work: () => T): T;
  account(id: string): Account | null;
  accountByUsername(username: string): Account | null;
  users(): User[];
  saveAccount(account: Account): void;
  audit(authorId: string, targetId: string, action: string): void;
  session(id: string): { userId: string; expiresAt: string } | null;
  saveSession(id: string, userId: string, expiresAt: string): void;
  revokeSession(id: string): void;
  revokeUserSessions(userId: string): void;
  blockedUntil(username: string): string | null;
  loginFailure(username: string): void;
  clearFailures(username: string): void;
  device(id: string): (Device & { credentialHash: string }) | null;
  devices(astronautId: string): Device[];
  touchDevice(id: string, at: string): void;
  signalStatus(id: string, status: string, observedAt: string, receivedAt: string): void;
  deviceReading(deviceId: string, readingId: string): { measurement: Measurement; fingerprint: string } | null;
  saveMeasurement(measurement: Measurement, fingerprint: string): void;
  measurements(astronautId: string, query: MeasurementQuery): Measurement[];
  latest(astronautId: string): Measurement[];
  pending(limit: number): QueueRecord[];
  queueStatus(astronautId: string): { pending: number; confirmed: number; rejected: number; rejections: { id: string; reason: string | null }[] };
  attempt(ids: string[]): void;
  acknowledge(id: string, outcome: "confirmed" | "rejected", reason?: string): void;
  retry(id: string): void;
}
