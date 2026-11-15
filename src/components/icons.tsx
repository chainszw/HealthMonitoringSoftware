import type { ReactNode, SVGProps } from 'react';

// Owner B: stroke icons from the design canvas (24x24, currentColor).

type IconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };

function Svg({
  size = 20,
  strokeWidth = 2,
  children,
  ...rest
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
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.6 2.6L16 9.6" />
  </Svg>
);
export const IconTriangle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5L21.5 20H2.5z" />
    <path d="M12 10v4.5" />
    <path d="M12 17.4h.01" />
  </Svg>
);
export const IconOctagon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.2 2.8h7.6l5.4 5.4v7.6l-5.4 5.4H8.2l-5.4-5.4V8.2z" />
    <path d="M12 7.5v5.5" />
    <path d="M12 16.5h.01" />
  </Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <path d="M12 7.6h.01" />
  </Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconArrowUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);
export const IconArrowDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M18 13l-6 6-6-6" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20L20 4" />
    <path d="M9 4h11v11" />
  </Svg>
);
export const IconSignal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12a7 7 0 0 1 14 0" />
    <path d="M8.5 12a3.5 3.5 0 0 1 7 0" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Svg>
);
export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Svg>
);
export const IconPlusCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);
export const IconBody = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="4.5" r="2.2" />
    <path d="M5 9l7 1 7-1" />
    <path d="M12 10v5" />
    <path d="M9 21l3-6 3 6" />
  </Svg>
);
export const IconTrend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 17l5-5 4 3 8-8" />
    <path d="M15 7h5v5" />
  </Svg>
);
export const IconCalendarCheck = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M9 15l2 2 4-4" />
  </Svg>
);
export const IconRotate = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12a9 4 0 0 0 18 0" />
    <path d="M17 14.5l4-2.5-1-4" />
    <path d="M21 12a9 4 0 0 0-18 0" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconFlag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 4 2 4H5" />
  </Svg>
);
export const IconRadiation = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="1.8" />
    <path d="M12 3.5a8.5 8.5 0 0 1 7.4 4.3L14 11M4.6 7.8A8.5 8.5 0 0 1 12 3.5M4.6 7.8L10 11M12 20.5a8.5 8.5 0 0 1-7.4-4.3L10 13M19.4 16.2A8.5 8.5 0 0 1 12 20.5M19.4 16.2L14 13" />
  </Svg>
);
export const IconBox = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <circle cx="12" cy="10" r="2.5" />
    <path d="M8 17c1-2 2.4-3 4-3s3 1 4 3" />
  </Svg>
);
export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="16" r="3.5" />
    <circle cx="19" cy="6" r="1.8" />
    <path d="M10 13.5l7.3-6" strokeDasharray="2 2.5" />
  </Svg>
);
export const IconGravity = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M12 14v6M9 17l3 3 3-3" />
  </Svg>
);
export const IconWind = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9h11a3 3 0 1 0-3-3" />
    <path d="M3 15h15a3 3 0 1 1-3 3" />
  </Svg>
);

/** ZOĒ device (a cube). */
export const IconCube = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </Svg>
);

export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
);

/** Aegis: a shield with an orbit. */
export function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path
        d="M18 3.5l11 4v9.2c0 7.3-4.7 12.6-11 15.8C11.7 29.3 7 24 7 16.7V7.5l11-4z"
        fill="rgba(107,188,255,0.16)"
        stroke="#6bbcff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="17" r="4.2" fill="#6bbcff" />
      <ellipse
        cx="18"
        cy="17"
        rx="12.5"
        ry="4.6"
        stroke="#6bbcff"
        strokeWidth="1.4"
        transform="rotate(-25 18 17)"
      />
    </svg>
  );
}
