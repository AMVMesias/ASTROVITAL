"use client";
import Link from "next/link";
import styles from "../../../frontend/features/dashboard/workspace.module.css";
import { useEffect, useState } from "react";
import { api } from "../../../frontend/lib/api";
type Reading = {
  id: string;
  indicator: string;
  value: number;
  unit: string;
  capturedAt: string;
  origin: string;
  note: string;
};
export default function Page() {
  const [rows, setRows] = useState<Reading[]>([]),
    [error, setError] = useState(""),
    [filter, setFilter] = useState(""),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    let active = true;
    void api<{ measurements: Reading[] }>(
      `/v1/me/measurements?limit=50&offset=${offset}${filter ? `&indicator=${filter}` : ""}`,
    )
      .then((r) => {
        if (active) setRows(r.measurements);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [filter, offset]);
  return (
    <main className={styles.workspace}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>
          ASTROVITAL <span />
        </p>
        <h1>Historial de mediciones</h1>
        <p className={styles.subtitle}>
          Consulta tus lecturas y el contexto de cada registro.
        </p>
      </header>
      <section className={styles.card}>
        <div className={styles.historyToolbar}>
          <Link className={styles.primary} href="/registros">
            Registrar sueño o bienestar →
          </Link>
          {error && <p role="alert">{error}</p>}
          <label>
            Indicador{" "}
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Todos</option>
              <option value="sleep">Sueño</option>
              <option value="wellbeing">Bienestar</option>
              <option value="heart_rate">Pulso</option>
            </select>
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Indicador</th>
                <th>Valor</th>
                <th>Origen</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.capturedAt).toLocaleString()}</td>
                  <td>{r.indicator}</td>
                  <td>
                    {r.value} {r.unit}
                  </td>
                  <td>{r.origin}</td>
                  <td>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p>No hay mediciones para este filtro.</p>}
        <div className={styles.pagination}>
          <button disabled={!offset} onClick={() => setOffset(offset - 50)}>
            Anterior
          </button>
          <button
            disabled={rows.length < 50}
            onClick={() => setOffset(offset + 50)}
          >
            Siguiente
          </button>
        </div>
      </section>
    </main>
  );
}
