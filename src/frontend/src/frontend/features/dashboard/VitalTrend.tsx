import {trendWindow} from "./trendWindow";
import styles from "./dashboard.module.css";
export type TrendSeries = {
  name: string;
  unit: string;
  color: string;
  points: { time: string; value: number }[];
};
export function VitalTrend({
  series,
  now,
  locale,
}: {
  series: TrendSeries[];
  now: number;
  locale: string;
}) {
  const {start,end,span}=trendWindow(series,now);
  const visible = series.map((s) => ({
    ...s,
    points: s.points
      .filter(
        (p) =>
          Number.isFinite(p.value) &&
          Date.parse(p.time) >= start &&
          Date.parse(p.time) <= end,
      )
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time)),
  }));
  if (!visible.some((s) => s.points.length))
    return (
      <p className={styles.chartEmpty}>
        {locale === "es"
          ? "No hay lecturas válidas en las últimas 24 horas para mostrar una tendencia."
          : "No valid readings in the last 24 hours to show a trend."}
      </p>
    );
  const ceiling =
    Math.ceil(
      Math.max(100, ...visible.flatMap((s) => s.points.map((p) => p.value))) /
        20,
    ) * 20;
  const x = (time: string) =>
    44 + ((Date.parse(time) - start) / span) * 490;
  const y = (value: number) => 175 - (value / ceiling) * 150;
  return (
    <div className={styles.chartBody}>
      <svg
        viewBox="0 0 560 210"
        role="img"
        aria-label={
          locale === "es"
            ? "Tendencia de lecturas reales con escala temporal ajustada a las muestras; unidades indicadas en cada serie"
            : "Real readings with time scale fitted to the samples; units shown per series"
        }
      >
        {Array.from({ length: 6 }, (_, i) => {
          const value = (ceiling * i) / 5;
          return (
            <g key={i}>
              <line
                x1="44"
                x2="534"
                y1={y(value)}
                y2={y(value)}
                className={styles.gridLine}
              />
              <text x="34" y={y(value) + 4} textAnchor="end">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: 5 }, (_, i) => (
          <text key={i} x={44 + i * 122.5} y="198" textAnchor="middle">
            {new Date(start + i * span/4).toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
              ...(span<300000?{second:"2-digit" as const}:{}),
            })}
          </text>
        ))}
        {visible.map((s) => (
          <g key={s.name}>
            {s.points.length > 1 && (
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                points={s.points
                  .map((p) => `${x(p.time)},${y(p.value)}`)
                  .join(" ")}
              />
            )}{" "}
            {s.points.map((p, i) => (
              <circle
                key={i}
                cx={x(p.time)}
                cy={y(p.value)}
                r={s.points.length>60?"1.5":"3"}
                fill="var(--chart-point,#fff)"
                stroke={s.color}
                strokeWidth="2"
              >
                <title>{`${s.name}: ${p.value} ${s.unit} · ${new Date(p.time).toLocaleString(locale)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <ul className={styles.legend}>
        {visible.map((s) => (
          <li key={s.name}>
            <i style={{ background: s.color }} />
            <span>{s.name}</span>
            <strong>
              {s.points.length ? `${s.points.at(-1)!.value} ${s.unit}` : "—"}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
