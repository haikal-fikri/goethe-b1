/* Die Strichzeichnungen aus dem Design, 1:1 übernommen (viewBox 0 0 24 24).
   Alle rein dekorativ — sie stehen immer neben einem Text, deshalb aria-hidden. */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 20, strokeWidth = 1.8, children, ...rest }: IconProps & { children: React.ReactNode }) {
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
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PhoneIcon = (props: IconProps) => (
  <Stroke {...props}>
    <rect x="6" y="2" width="12" height="20" rx="3" />
    <path d="M11 18h2" />
  </Stroke>
);

export const LaptopIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M3 5h18v12H3z" />
    <path d="M8 21h8" />
  </Stroke>
);

export const SparkleIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 3l2.2 5.6L20 10l-5.8 1.4L12 17l-2.2-5.6L4 10l5.8-1.4z" />
  </Stroke>
);

export const CheckIcon = (props: IconProps) => (
  <Stroke strokeWidth={2.2} size={18} {...props}>
    <path d="M5 13l4 4L19 7" />
  </Stroke>
);

export const PenIcon = (props: IconProps) => (
  <Stroke strokeWidth={1.9} size={14} {...props}>
    <path d="M15.5 4.5l4 4L8 20H4v-4z" />
  </Stroke>
);

export const MicIcon = (props: IconProps) => (
  <Stroke strokeWidth={1.9} size={14} {...props}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 12a6 6 0 0012 0" />
    <path d="M12 18v3" />
  </Stroke>
);

export const DocumentIcon = (props: IconProps) => (
  <Stroke strokeWidth={1.9} size={14} {...props}>
    <path d="M5 4h14v16H5z" />
    <path d="M9 9h6" />
    <path d="M9 13h6" />
    <path d="M9 17h3" />
  </Stroke>
);

export const LockIcon = (props: IconProps) => (
  <Stroke strokeWidth={1.9} size={14} {...props}>
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 018 0v3" />
  </Stroke>
);

export const SearchIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} size={16} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M16.5 16.5L21 21" />
  </Stroke>
);

export const SendIcon = (props: IconProps) => (
  <Stroke strokeWidth={1.9} size={16} {...props}>
    <path d="M21 3L3 10.5l7 2.5 2.5 7z" />
    <path d="M21 3l-11 11" />
  </Stroke>
);

export const InfoIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} size={18} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v.01M12 11v5" />
  </Stroke>
);
