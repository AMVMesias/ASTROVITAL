import type { CSSProperties } from "react";
const paths: Record<string, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18M5 15l5-5 4 3 6-8" />
      <path d="M16 5h4v4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM9 21h6" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2 10 6-10 6L2 8l10-6ZM2 12l10 6 10-6M2 16l10 6 10-6" />
    </>
  ),
  pulse: <path d="M2 12h5l3-9 4 18 3-9h5" />,
  moon: <path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1 3 4 3 4-3 4-3M8 8v2m8-2v2" />
    </>
  ),
  chip: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="1" />
      <path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4M19 9h4m-4 6h4M9 9h6v6H9Z" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 2S4 10 4 15a8 8 0 0 0 16 0c0-5-8-13-8-13Z" />
      <circle cx="10" cy="14" r="2" />
    </>
  ),
  lungs: (
    <>
      <path d="M10 5v9M14 5v9M10 8C6 5 3 10 3 18c3 0 6-2 7-4M14 8c4-3 7 2 7 10-3 0-6-2-7-4M12 2v8m0 0-2 3m2-3 2 3" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7 12 3 3 7-7" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2M4 6a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M1 20v-2a5 5 0 0 1 3-4m19 6v-2a5 5 0 0 0-3-4" />
    </>
  ),
  astronaut: (
    <>
      <rect x="5" y="2" width="14" height="16" rx="7" />
      <rect x="8" y="6" width="8" height="7" rx="3" />
      <path d="M6 16c-3 2-3 5-3 7h18c0-2 0-5-3-7M8 20h1m6 0h1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2c3 2 6 3 9 3v7c0 5-5 9-9 11-4-2-9-6-9-11V5c3 0 6-1 9-3Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 22v-2a8 8 0 0 1 16 0v2Z" />
    </>
  ),
  addUser: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-2a7 7 0 0 1 12-5m5 0v8m-4-4h8" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 7 7" />
    </>
  ),
  filter: <path d="M2 3h20l-8 9v8l-4 2V12L2 3Z" />,
  plus: <path d="M12 3v18M3 12h18" />,
  edit: (
    <>
      <path d="m15 3 6 6M3 21l5-1L22 6a2 2 0 0 0-4-4L4 16l-1 5Z" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="12" rx="2" />
      <path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H3v18h6m4-15 7 6-7 6m-7-6h14" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M3 5h18M3 12h18M3 19h18" />,
};
export function AdminIcon({
  name,
  style,
}: {
  name: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
