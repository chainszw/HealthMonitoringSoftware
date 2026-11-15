import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { FIGURE_VB as VB, type FigureSystem } from './figure';
import { FigureArt } from './FigureArt';
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
  /** Seconds per heartbeat for the animated figure (from the latest heart rate). */
  beatSeconds?: number;
  /**
   * 3D character slot: a node (e.g. a three.js canvas) drawn in place of the 2D figure, filling
   * the stage. Keep the model in the same 400 x 600 framing so the leader lines still land.
   */
  model?: ReactNode;
}

// Anchors (in the 400 x 600 figure box) are where each leader line ends.
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
const NEUTRAL_ZONE = '#1f6f8b';
/** Leader line colour for a system with no current reading. */
const NO_DATA = '#7f97bd';

type Line = { id: FigureSystem; x1: number; y1: number; x2: number; y2: number };

export function BodyFigure({
  systems,
  selected,
  onSelect,
  hint,
  minHeight = 480,
  beatSeconds,
  model,
}: Props) {
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
      {/* Figure: the 3D model when one is plugged in, else the animated 2D figure */}
      {model ? (
        <div data-slot="3d-character" className="absolute inset-0">
          {model}
        </div>
      ) : (
        <FigureArt
          zoneFill={zoneFill}
          zoneOpacity={zoneOpacity}
          beatSeconds={beatSeconds}
          label={`Body figure. ${systems.map((s) => `${s.name}: ${s.text}`).join('. ')}`}
          className="absolute inset-0 size-full"
        />
      )}

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
                <g className={model ? undefined : 'chc-fig-bob'}>
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
            : `${s.tone === 'act' ? 'border-act-l' : 'border-ink/14'} bg-[rgba(14,32,66,0.62)] backdrop-blur-md`
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
