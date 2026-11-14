import type { Repository } from "../../domain/repository";

/** Puerto interno del emisor de persona 2. Un único emisor por archivo SQLite.
 * Transporte fallido: solo incrementa intentos; el payload nunca se modifica.
 */
export class LocalQueue {
  constructor(private repo: Repository) {}
  pending(limit = 100) { return this.repo.pending(limit); }
  recordAttempt(ids: string[]) { this.repo.attempt(ids); }
  confirm(id: string) { this.repo.acknowledge(id, "confirmed"); }
  reject(id: string, reason: string) { this.repo.acknowledge(id, "rejected", reason); }
  retryRejected(id: string) { this.repo.retry(id); }
}
