import React from "react";
import Svg, { Path, Circle, Line, Rect, Polyline } from "react-native-svg";
import type { SkillCode } from "@repo/types";

// Inline-SVG-Icons (24×24, stroke 1.8). Aus der Design-Referenz nachgezogen.
type P = { size?: number; color?: string; fill?: string; strokeWidth?: number };
const base = (size = 24, color = "#211C17", strokeWidth = 1.8) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export const HomeIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Path d="M3 10.5 12 3l9 7.5" /><Path d="M5 9.5V20h14V9.5" /><Path d="M9.5 20v-6h5v6" /></Svg>
);
export const GridIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><Rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><Rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><Rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></Svg>
);
export const ClipboardIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Rect x="5" y="4" width="14" height="17" rx="2.5" /><Path d="M9 4.5V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5v1" /><Path d="m8.5 13 2.2 2.2 4.3-4.3" /></Svg>
);
export const ChartIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Line x1="4" y1="20" x2="20" y2="20" /><Rect x="6" y="11" width="3" height="7" rx="1" /><Rect x="11" y="7" width="3" height="11" rx="1" /><Rect x="16" y="13" width="3" height="5" rx="1" /></Svg>
);
export const PeopleIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Circle cx="9" cy="8" r="3" /><Path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><Path d="M16 6.2a3 3 0 0 1 0 5.6" /><Path d="M16.5 14.5A5.5 5.5 0 0 1 20.5 20" /></Svg>
);
export const BackIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Polyline points="15 5 8 12 15 19" /></Svg>
);
export const CloseIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Line x1="6" y1="6" x2="18" y2="18" /><Line x1="18" y1="6" x2="6" y2="18" /></Svg>
);
export const FlameIcon = ({ size, color = "#DD8A22", fill = "#DD8A22" }: P) => (
  <Svg width={size ?? 16} height={size ?? 16} viewBox="0 0 24 24" fill={fill} stroke={color}><Path d="M12 2c1 3-1 4-1 6a3 3 0 0 0 3 3c0-2 1-3 1-3 2 2 3 4 3 6a6 6 0 0 1-12 0c0-3 2-5 3-7 1 1 1 2 0 3 0 0 0-6 0-8Z" /></Svg>
);
// Outline-Herz (kein Fill) — Gamification-Hearts.
export const HeartIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z" /></Svg>
);
export const PlayIcon = ({ size, color = "#fff", fill = "#fff" }: P) => (
  <Svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill={fill}><Path d="M8 5v14l11-7z" /></Svg>
);
export const MicIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Rect x="9" y="3" width="6" height="11" rx="3" /><Path d="M6 11a6 6 0 0 0 12 0" /><Line x1="12" y1="17" x2="12" y2="21" /></Svg>
);
export const SpeakerIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Path d="M4 9v6h4l5 4V5L8 9H4Z" /><Path d="M16.5 8.5a5 5 0 0 1 0 7" /></Svg>
);
export const BulbIcon = ({ size, color = "#DD8A22", strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Path d="M9 18h6" /><Path d="M10 21h4" /><Path d="M12 3a6 6 0 0 0-3 11c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a6 6 0 0 0-3-11Z" /></Svg>
);
export const CheckCircle = ({ size = 22, color = "#1C8A5B" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="12" r="9" /><Path d="m8 12 2.5 2.5L16 9" /></Svg>
);
export const GearIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Circle cx="12" cy="12" r="3" /><Path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></Svg>
);
export const LockIcon = ({ size = 13, color = "#75695C" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}><Rect x="5" y="11" width="14" height="9" rx="2" /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
);
// Stift/Feder — Schreiben (BUG-10: eigenes Glyph, da icons.tsx keins hatte).
export const PenIcon = ({ size, color, strokeWidth }: P) => (
  <Svg {...base(size, color, strokeWidth)}><Path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z" /><Path d="m13.5 6.5 3 3" /></Svg>
);

// BUG-10: Skill → Icon-Map (analog IslandTabBar's ICONS). Schreiben=Stift,
// Sprechen=Mikro, shared/Konnektoren=Glühbirne. Ersetzt die Platzhalter-Swatches.
export const SKILL_ICON: Record<SkillCode, React.FC<P>> = {
  schreiben: PenIcon,
  sprechen: MicIcon,
  shared: BulbIcon,
};
