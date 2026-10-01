/**
 * Ícones SVG inline (traçados baseados no Lucide, licença ISC) — sem dependência extra.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const stroke = (props: P) => ({
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
  ...props,
});

export const UserIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const LockIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect width="16" height="11" x="4" y="11" rx="2" ry="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    <path d="M12 15.5v2" />
  </svg>
);

export const EyeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </svg>
);

export const ArrowRightIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M4 12h16" />
    <path d="m13 5 7 7-7 7" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...stroke({ strokeWidth: 3, ...p })}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const AlertIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export const TicketIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" />
    <path d="M13 17v2" />
    <path d="M13 11v2" />
  </svg>
);

export const PhoneIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export const MailIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

/* ---------- Ícones dos 4 pilares (com gradiente, como no layout) ---------- */

function Gradient({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
  );
}

export const ChartIcon = (p: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden focusable={false} {...p}>
    <Gradient id="pg-chart" from="#5fe04a" to="#16a34a" />
    <g fill="url(#pg-chart)">
      <rect x="4" y="30" width="8" height="14" rx="2" />
      <rect x="15" y="22" width="8" height="22" rx="2" />
      <rect x="26" y="14" width="8" height="30" rx="2" />
      <rect x="37" y="5" width="8" height="39" rx="2" />
    </g>
  </svg>
);

export const TeamIcon = (p: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden focusable={false} {...p}>
    <Gradient id="pg-team" from="#3fd67a" to="#0f9a8a" />
    <g fill="none" stroke="url(#pg-team)" strokeWidth="3.2" strokeLinecap="round">
      <circle cx="24" cy="13" r="7" />
      <path d="M11 40v-3a9 9 0 0 1 9-9h8a9 9 0 0 1 9 9v3" />
      <circle cx="9.5" cy="19" r="4.5" />
      <path d="M2.5 36v-1.5A6.5 6.5 0 0 1 9 28h2" />
      <circle cx="38.5" cy="19" r="4.5" />
      <path d="M45.5 36v-1.5A6.5 6.5 0 0 0 39 28h-2" />
    </g>
  </svg>
);

export const GearIcon = (p: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden focusable={false} {...p}>
    <Gradient id="pg-gear" from="#22b8f0" to="#1665d8" />
    <g fill="none" stroke="url(#pg-gear)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3.2" />
    </g>
  </svg>
);

export const LeafIcon = (p: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden focusable={false} {...p}>
    <Gradient id="pg-leaf" from="#6ee04a" to="#0e9f55" />
    <path
      fill="url(#pg-leaf)"
      d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
    />
    <path
      d="M3 21c0-3 1.85-5.36 5.08-6C10.5 14.52 13 13 14.5 10.5"
      fill="none"
      stroke="#e9fff1"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);
