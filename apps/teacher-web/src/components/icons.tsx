import type { CSSProperties, ReactNode } from "react";

// Inline SVG line-icons, viewBox 0 0 24 24, currentColor, round caps/joins —
// the design system's only icon vocabulary (readme "ICONOGRAPHY"). Paths are
// ported verbatim from the Teacher-LMS comp so stroke weights match 1:1.

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

function S({
  size = 18,
  strokeWidth = 1.8,
  className,
  style,
  title,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ── Sidebar / navigation ─────────────────────────────────────────── */
export const IconDashboard = (p: IconProps) => (
  <S strokeWidth={1.7} {...p}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="1.6" />
    <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.6" />
    <rect x="3" y="15" width="7.5" height="6" rx="1.6" />
  </S>
);
export const IconUsers = (p: IconProps) => (
  <S strokeWidth={1.7} {...p}>
    <path d="M16.5 20v-1.6a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.4V20" />
    <circle cx="9.7" cy="8" r="3.4" />
    <path d="M21 20v-1.6a3.6 3.6 0 0 0-2.7-3.5" />
    <path d="M15.6 4.7a3.4 3.4 0 0 1 0 6.6" />
  </S>
);
export const IconClipboardCheck = (p: IconProps) => (
  <S strokeWidth={1.7} {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2.2" />
    <path d="M9 4V3.1A1.1 1.1 0 0 1 10.1 2h3.8A1.1 1.1 0 0 1 15 3.1V4" />
    <path d="M8.8 13.2l2 2 4.2-4.2" />
  </S>
);
export const IconCalendar = (p: IconProps) => (
  <S strokeWidth={1.7} {...p}>
    <rect x="4" y="5" width="16" height="16" rx="2.2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </S>
);
export const IconCard = (p: IconProps) => (
  <S strokeWidth={1.7} {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2.2" />
    <path d="M3 10h18" />
  </S>
);
export const IconSettings = (p: IconProps) => (
  <S strokeWidth={1.7} {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.5 1.5 0 0 0 .3 1.65l.05.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.05a1.5 1.5 0 0 0-2.55 1.06V20.5a1.8 1.8 0 0 1-3.6 0v-.1a1.5 1.5 0 0 0-2.7-.9l-.05.05a1.8 1.8 0 1 1-2.55-2.55l.05-.05A1.5 1.5 0 0 0 4.6 15H4.5a1.8 1.8 0 0 1 0-3.6h.1a1.5 1.5 0 0 0 .9-2.7l-.05-.05A1.8 1.8 0 1 1 8 6.1l.05.05a1.5 1.5 0 0 0 2.6-1.06V4.5a1.8 1.8 0 0 1 3.6 0v.1a1.5 1.5 0 0 0 2.55 1.06L18.85 6a1.8 1.8 0 1 1 2.55 2.55l-.05.05a1.5 1.5 0 0 0-.35 1.65v.05a1.5 1.5 0 0 0 1.4.9h.1a1.8 1.8 0 0 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z" />
  </S>
);
export const IconGrid = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </S>
);

/* ── Chevrons / arrows ────────────────────────────────────────────── */
export const IconChevronRight = (p: IconProps) => (
  <S strokeWidth={1.9} {...p}>
    <path d="M9 6l6 6-6 6" />
  </S>
);
export const IconChevronLeft = (p: IconProps) => (
  <S strokeWidth={1.9} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </S>
);
export const IconChevronDown = (p: IconProps) => (
  <S strokeWidth={1.9} {...p}>
    <path d="M6 9l6 6 6-6" />
  </S>
);
export const IconArrowRight = (p: IconProps) => (
  <S strokeWidth={2} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </S>
);

/* ── Topbar / chrome ──────────────────────────────────────────────── */
export const IconSearch = (p: IconProps) => (
  <S {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </S>
);
export const IconBell = (p: IconProps) => (
  <S {...p}>
    <path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5Z" />
    <path d="M10.3 19.5a2 2 0 0 0 3.4 0" />
  </S>
);
export const IconSun = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </S>
);
export const IconMoon = (p: IconProps) => (
  <S {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.2 6.2 0 0 0 10.5 10.5Z" />
  </S>
);
export const IconLogout = (p: IconProps) => (
  <S {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </S>
);

/* ── Actions / status ─────────────────────────────────────────────── */
export const IconPlus = (p: IconProps) => (
  <S strokeWidth={2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IconCheck = (p: IconProps) => (
  <S strokeWidth={2.2} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </S>
);
export const IconAlertTriangle = (p: IconProps) => (
  <S {...p}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </S>
);
export const IconClock = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4l2.5 2.5" />
  </S>
);
export const IconSparkles = (p: IconProps) => (
  <S strokeWidth={1.9} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M12 8.5 13.2 11 12 12.2 10.8 11Z" />
    <path d="M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2" />
  </S>
);
export const IconSend = (p: IconProps) => (
  <S strokeWidth={2} {...p}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
  </S>
);
export const IconX = (p: IconProps) => (
  <S strokeWidth={1.9} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </S>
);
export const IconUndo = (p: IconProps) => (
  <S strokeWidth={1.9} {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </S>
);
export const IconCopy = (p: IconProps) => (
  <S {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.4" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </S>
);
export const IconRefresh = (p: IconProps) => (
  <S {...p}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </S>
);
export const IconMail = (p: IconProps) => (
  <S strokeWidth={1.9} {...p}>
    <path d="M4 8l8 5 8-5" />
    <rect x="3" y="5" width="18" height="14" rx="2.2" />
  </S>
);
export const IconShieldCheck = (p: IconProps) => (
  <S {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="M9 12l2 2 4-4" />
  </S>
);
export const IconConsent = (p: IconProps) => (
  <S {...p}>
    <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />
    <rect x="4" y="4" width="16" height="16" rx="3" />
  </S>
);
export const IconDotsV = (p: IconProps) => (
  <svg
    width={p.size ?? 18}
    height={p.size ?? 18}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={p.className}
    style={p.style}
    aria-hidden
  >
    <circle cx="12" cy="5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="19" r="1.7" />
  </svg>
);

/* ── Skill glyphs (Schreiben = pencil, Sprechen = mic) ────────────── */
export const IconPencil = (p: IconProps) => (
  <S {...p}>
    <path d="M14.5 5.5l4 4" />
    <path d="M4 20l1.2-4.2L16 5a2.1 2.1 0 0 1 3 3L8.2 18.8 4 20Z" />
  </S>
);
export const IconMic = (p: IconProps) => (
  <S {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0" />
    <path d="M12 17v4" />
  </S>
);

/* ── Filled media controls ────────────────────────────────────────── */
export const IconPlay = ({ size = 22, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);
export const IconPause = ({ size = 20, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
