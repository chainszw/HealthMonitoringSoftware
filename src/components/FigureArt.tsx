import type { CSSProperties } from 'react';
import { FIGURE_VB, type FigureSystem } from './figure';

// Owner B: the 2D crew figure, drawn in a 400 x 600 box and animated so it reads as a live
// person in zero g: the body drifts, the chest breathes, arms and head sway, and the heart
// beats at the crew member's latest heart rate. Animation classes live in index.css
// (`.chc-fig-*`) and stop under prefers-reduced-motion.
// This is the stand-in for a 3D character: BodyFigure and CrewCharacter take a `model` node
// that replaces it (e.g. a three.js canvas) without changing their layout.

interface Props {
  /** Fill for each system zone (status colour or neutral). */
  zoneFill: (id: FigureSystem) => string;
  /** Opacity for each zone (dims the others while one is focused). */
  zoneOpacity?: (id: FigureSystem) => number;
  /** Seconds per heartbeat, from the latest heart rate. */
  beatSeconds?: number;
  label: string;
  className?: string;
}

export function FigureArt({
  zoneFill,
  zoneOpacity = () => 0.95,
  beatSeconds,
  label,
  className,
}: Props) {
  const beat = { '--beat': `${beatSeconds ?? 0.85}s` } as CSSProperties;
  return (
    <svg
      viewBox={`0 0 ${FIGURE_VB.w} ${FIGURE_VB.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
      className={className}
    >
      {/* Floor glow: stays put while the body drifts above it */}
      <ellipse cx="200" cy="588" rx="120" ry="12" fill="rgba(41,240,255,0.08)" />
      <ellipse cx="200" cy="588" rx="86" ry="8" fill="none" stroke="#29f0ff" strokeOpacity="0.5" />
      <ellipse
        cx="200"
        cy="588"
        rx="120"
        ry="12"
        fill="none"
        stroke="#ff2fd0"
        strokeOpacity="0.35"
      />

      <g className="chc-fig-float" style={{ transformOrigin: '200px 300px' }}>
        <g fill="#0b1636" stroke="#29f0ff" strokeWidth="1.5">
          {/* legs */}
          <path d="M162 352 L150 580 Q150 590 162 590 L186 590 Q194 590 194 580 L198 372 Z" />
          <path d="M238 352 L250 580 Q250 590 238 590 L214 590 Q206 590 206 580 L202 372 Z" />
          {/* arms */}
          <path
            className="chc-fig-arm-l"
            d="M128 140 Q104 146 100 176 L88 330 Q86 346 100 348 Q112 349 114 334 L132 196 Z"
          />
          <path
            className="chc-fig-arm-r"
            d="M272 140 Q296 146 300 176 L312 330 Q314 346 300 348 Q288 349 286 334 L268 196 Z"
          />
        </g>

        {/* Torso breathes, with its zones */}
        <g className="chc-fig-breathe">
          <path
            fill="#0b1636"
            stroke="#29f0ff"
            strokeWidth="1.5"
            d="M150 126 Q200 116 250 126 Q284 134 280 176 L262 300 Q258 330 246 360 L154 360 Q142 330 138 300 L120 176 Q116 134 150 126 Z"
          />
          <g stroke="none" className="transition-opacity duration-300">
            <g fill={zoneFill('respiratory')} opacity={zoneOpacity('respiratory')}>
              <ellipse cx="178" cy="206" rx="14" ry="28" />
            </g>
            <g className="chc-fig-beat" style={beat}>
              <path
                d="M216 214 C196 200 194 182 206 178 C212 176 216 180 216 184 C216 180 220 176 226 178 C238 182 236 200 216 214 Z"
                fill={zoneFill('heart')}
                opacity={zoneOpacity('heart')}
              />
            </g>
            <g fill={zoneFill('immune')} opacity={zoneOpacity('immune')}>
              <ellipse cx="178" cy="258" rx="12" ry="18" transform="rotate(-20 178 258)" />
              <circle cx="186" cy="124" r="4" />
              <circle cx="214" cy="124" r="4" />
              <circle cx="140" cy="186" r="4" />
              <circle cx="260" cy="186" r="4" />
            </g>
            <g
              fill="none"
              stroke={zoneFill('bone')}
              strokeWidth="9"
              strokeLinecap="round"
              opacity={zoneOpacity('bone')}
            >
              <path d="M156 330 Q200 350 244 330" />
              <path d="M170 372 L166 470" />
              <path d="M230 372 L234 470" />
            </g>
          </g>
        </g>

        {/* Neck + head sway, with the mind and eye zones */}
        <g className="chc-fig-head">
          <g fill="#0b1636" stroke="#29f0ff" strokeWidth="1.5">
            <rect x="184" y="98" width="32" height="34" rx="10" />
            <ellipse cx="200" cy="62" rx="36" ry="44" />
          </g>
          <path
            d="M176 46 Q178 26 200 24 Q222 26 224 46 Q216 40 200 40 Q184 40 176 46 Z"
            fill={zoneFill('mind')}
            opacity={zoneOpacity('mind')}
          />
          <g fill={zoneFill('eyes')} opacity={zoneOpacity('eyes')}>
            <ellipse cx="187" cy="66" rx="7" ry="4" />
            <ellipse cx="213" cy="66" rx="7" ry="4" />
          </g>
        </g>
      </g>
    </svg>
  );
}
