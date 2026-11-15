import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { FigureSystem } from './figure';
import { IconMinus, IconRotate } from './icons';
import { TONE, type Tone } from './tone';
import { StatusIcon } from './ui';

// Owner B: body figure with status callouts and leader lines.
// The design uses a three.js model; this is a flat 2D SVG stand-in (no new dependency,
// works offline). Region ids are BodySystemIds, so it maps straight onto content.json.

export interface FigureCallout {
  id: FigureSystem;
  name: string;
  /** null = no current reading (neutral). */
  tone: Tone | null;
  text: string;
}

interface Props {
  systems: FigureCallout[];
  /** Body view: the picked system. Dashboard: undefined. */
  selected?: FigureSystem;
  /** Body view: callouts are buttons. Without it, callouts link to /body. */
  onSelect?: (id: FigureSystem) => void;
  hint?: string;
  minHeight?: number;
}

// Figure drawn in a 400 x 600 box. Anchors are where each leader line ends.
const VB = { w: 400, h: 600 };
const ANCHOR: Record<FigureSystem, [number, number]> = {
  mind: [200, 52],
  eyes: [212, 84],
  heart: [216, 196],
  respiratory: [180, 206],
  immune: [178, 262],
  bone: [168, 392],
};
// Callout placement: [side, top %]. Left: Mind / Lungs / Immune / Bone. Right: Eyes / Heart.
const PLACE: Record<FigureSystem, ['left' | 'right', number]> = {
  mind: ['left', 3],
  eyes: ['right', 9],
  heart: ['right', 30],
  respiratory: ['left', 18],
  immune: ['left', 33],
  bone: ['left', 62],
};
const NEUTRAL_ZONE = '#4d5a73';
/** Leader line colour for a system with no current reading. */
const NO_DATA = '#7b879c';

type Line = { id: FigureSystem; x1: number; y1: number; x2: number; y2: number };

export function BodyFigure({ systems, selected, onSelect, hint, minHeight = 480 }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Partial<Record<FigureSystem, HTMLElement | null>>>({});
  const [hover, setHover] = useState<FigureSystem | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const focus = hover ?? selected ?? null;

  // Measure callout cards and project the anchors into stage pixels.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const sr = stage.getBoundingClientRect();
      const scale = Math.min(sr.width / VB.w, sr.height / VB.h);
      const ox = (sr.width - VB.w * scale) / 2;
      const oy = (sr.height - VB.h * scale) / 2;
      const next: Line[] = [];
      for (const [id, card] of Object.entries(cardRefs.current) as [
        FigureSystem,
        HTMLElement | null,
      ][]) {
        if (!card) continue;
        const cr = card.getBoundingClientRect();
        const left = PLACE[id][0] === 'left';
        next.push({
          id,
          x1: (left ? cr.right : cr.left) - sr.left,
          y1: cr.top + cr.height / 2 - sr.top,
          x2: ox + ANCHOR[id][0] * scale,
          y2: oy + ANCHOR[id][1] * scale,
        });
      }
      setLines(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    Object.values(cardRefs.current).forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, []);

  const tone = (id: FigureSystem) => systems.find((s) => s.id === id)?.tone ?? null;
  const zoneFill = (id: FigureSystem) => {
    const t = tone(id);
    return !t || t === 'normal' ? NEUTRAL_ZONE : TONE[t].hex;
  };
  const zoneOpacity = (id: FigureSystem) => (focus && focus !== id ? 0.45 : 0.95);

  return (
    <div
      ref={stageRef}
      className="relative flex-1 overflow-hidden rounded-xl"
      style={{ minHeight }}
    >
      {/* Figure */}
      <svg
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Body figure. ${systems.map((s) => `${s.name}: ${s.text}`).join('. ')}`}
        className="absolute inset-0 size-full"
      >
        <g fill="#1a2131" stroke="rgba(233,237,243,0.16)" strokeWidth="1.5">
          {/* legs */}
          <path d="M162 352 L150 580 Q150 590 162 590 L186 590 Q194 590 194 580 L198 372 Z" />
          <path d="M238 352 L250 580 Q250 590 238 590 L214 590 Q206 590 206 580 L202 372 Z" />
          {/* arms */}
          <path d="M128 140 Q104 146 100 176 L88 330 Q86 346 100 348 Q112 349 114 334 L132 196 Z" />
          <path d="M272 140 Q296 146 300 176 L312 330 Q314 346 300 348 Q288 349 286 334 L268 196 Z" />
          {/* torso */}
          <path d="M150 126 Q200 116 250 126 Q284 134 280 176 L262 300 Q258 330 246 360 L154 360 Q142 330 138 300 L120 176 Q116 134 150 126 Z" />
          {/* neck + head */}
          <rect x="184" y="98" width="32" height="34" rx="10" />
          <ellipse cx="200" cy="62" rx="36" ry="44" />
        </g>
        {/* Zones: neutral when normal, status colour when flagged */}
        <g stroke="none" className="transition-opacity duration-300">
          <path
            d="M176 46 Q178 26 200 24 Q222 26 224 46 Q216 40 200 40 Q184 40 176 46 Z"
            fill={zoneFill('mind')}
            opacity={zoneOpacity('mind')}
          />
          <g fill={zoneFill('eyes')} opacity={zoneOpacity('eyes')}>
            <ellipse cx="187" cy="66" rx="7" ry="4" />
            <ellipse cx="213" cy="66" rx="7" ry="4" />
          </g>
          <g fill={zoneFill('respiratory')} opacity={zoneOpacity('respiratory')}>
            <ellipse cx="178" cy="206" rx="14" ry="28" />
          </g>
          <path
            d="M216 214 C196 200 194 182 206 178 C212 176 216 180 216 184 C216 180 220 176 226 178 C238 182 236 200 216 214 Z"
            fill={zoneFill('heart')}
            opacity={zoneOpacity('heart')}
          />
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
      </svg>

      {/* Leader lines and pulsing anchor dots (stage pixels) */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        {lines.map((l) => {
          const t = tone(l.id);
          const c = t ? TONE[t].hex : NO_DATA;
          const strong = focus === l.id;
          return (
            <g key={l.id}>
              <path
                d={`M${l.x1} ${l.y1} L${l.x2} ${l.y2}`}
                fill="none"
                stroke={c}
                strokeWidth={strong ? 1.6 : 1.2}
                strokeDasharray="3 4"
                strokeOpacity={strong ? 0.95 : 0.6}
              />
              <g transform={`translate(${l.x2} ${l.y2})`}>
                <circle r="4.5" fill={c} />
                <circle r="9" fill="none" stroke={c} strokeOpacity="0.45" />
                {t && t !== 'normal' && (
                  <circle r="11" fill="none" stroke={c} strokeOpacity="0.4">
                    <animate
                      attributeName="r"
                      values="9;16;9"
                      dur="3.2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            </g>
          );
        })}
      </svg>

      {/* Callout cards */}
      {systems.map((s) => {
        const [side, top] = PLACE[s.id];
        const on = selected === s.id;
        const cls = `absolute box-border flex min-h-[44px] w-[156px] items-center gap-2 rounded-xl border py-1.5 pr-2.5 pl-2.5 text-left text-ink no-underline transition-[transform,background-color,border-color] duration-150 hover:-translate-y-0.5 hover:bg-raised ${
          on
            ? 'border-ink/55 bg-raised'
            : `${s.tone === 'act' ? 'border-act-l' : 'border-ink/14'} bg-[rgba(19,24,36,0.92)]`
        }`;
        const style = { [side]: 0, top: `${top}%` };
        const body = (
          <>
            <span
              className={`inline-flex size-5 shrink-0 ${s.tone ? TONE[s.tone].text : 'text-muted'}`}
            >
              {s.tone ? (
                <StatusIcon tone={s.tone} size={20} strokeWidth={2.2} />
              ) : (
                <IconMinus size={20} strokeWidth={2.2} />
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-px">
              <span className="truncate text-sm leading-[18px] font-medium">{s.name}</span>
              <span
                className={`truncate text-[13px] leading-[17px] ${!s.tone || s.tone === 'normal' ? 'text-muted' : `font-medium ${TONE[s.tone].text}`}`}
              >
                {s.text}
              </span>
            </span>
          </>
        );
        const handlers = {
          onMouseEnter: () => setHover(s.id),
          onMouseLeave: () => setHover(null),
          onFocus: () => setHover(s.id),
          onBlur: () => setHover(null),
        };
        return onSelect ? (
          <button
            key={s.id}
            type="button"
            ref={(el) => {
              cardRefs.current[s.id] = el;
            }}
            aria-pressed={on}
            aria-label={`${s.name}: ${s.text}`}
            onClick={() => onSelect(s.id)}
            className={`${cls} cursor-pointer`}
            style={style}
            {...handlers}
          >
            {body}
          </button>
        ) : (
          <Link
            key={s.id}
            to="/body"
            ref={(el) => {
              cardRefs.current[s.id] = el;
            }}
            aria-label={`${s.name}: ${s.text}. Open body view`}
            className={cls}
            style={style}
            {...handlers}
          >
            {body}
          </Link>
        );
      })}

      {hint && (
        <span className="pointer-events-none absolute right-1 bottom-1.5 inline-flex items-center gap-1.5 font-mono text-[13px] text-muted">
          <IconRotate size={16} strokeWidth={1.8} />
          {hint}
        </span>
      )}
    </div>
  );
}
