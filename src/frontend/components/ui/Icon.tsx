import type { CSSProperties } from "react";
const paths: Record<string, React.ReactNode> = {
  heart: (
    <>
      <path d="M22 38S4 27 4 15C4 4 17 2 22 11 28 2 41 4 41 15c0 12-19 23-19 23Z" />
      <path d="M3 22h11l4-8 6 15 5-10 3 3h11" />
    </>
  ),
  chart: (
    <>
      <path d="M4 39h38M7 39V26h7v13m6 0V16h7v23m6 0V4h7v35" />
    </>
  ),
  shield: (
    <>
      <path d="M22 3c5 4 10 5 16 6v14c0 8-7 14-16 18C13 37 6 31 6 23V9c6-1 11-2 16-6Z" />
      <path d="m15 22 5 5 10-12" />
    </>
  ),
  arrow: <path d="M8 22h28m-9-9 9 9-9 9" />,
  youtube: (
    <>
      <rect
        x="7"
        y="12"
        width="30"
        height="21"
        rx="5"
        fill="currentColor"
        stroke="none"
      />
      <path d="m19 18 9 5-9 5Z" fill="#001b38" stroke="none" />
    </>
  ),
  x: (
    <>
      <path d="M10 9h8l17 27h-8L10 9Zm24 0L11 36" />
    </>
  ),
  instagram: (
    <>
      <rect x="9" y="9" width="26" height="26" rx="7" />
      <circle cx="22" cy="22" r="7" />
      <circle cx="30" cy="14" r="1" fill="currentColor" />
    </>
  ),
  linkedin: (
    <>
      <path
        d="M12 19v16m0-24v1m8 23V19m0 7c0-10 13-10 13 0v9"
        strokeWidth="5"
      />
    </>
  ),
};
export function Icon({ name, style }: { name: string; style?: CSSProperties }) {
  return (
    <svg
      style={style}
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
