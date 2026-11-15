import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { IconCheckCircle } from '../components/icons';
import { toneOf } from '../components/tone';
import { PageHeader, StatusPill } from '../components/ui';
import {
  hex,
  ZOE_ENVS,
  ZOE_HAZARDS,
  ZOE_MARK_SECTIONS,
  zoeEnv,
  type ZoeEnvId,
} from '../components/zoe/zoeData';
import { createZoeScene, type ScanPhase, type ZoeControls } from '../components/zoe/zoeScene';
import { getIndicator } from '../data/content';
import { formatValue } from '../lib/format';
import { getStatus } from '../lib/status';
import type { MissionProfileId } from '../lib/types';
import { useReadings, useSync } from '../lib/useReadings';
import { ZOE_NOTE, zoeScanValues, type ScanValue } from '../lib/zoeScan';

// Owner B: the ZOĒ wearable cube (3D, three.js). Put a finger in ("Scan a finger"): the device
// takes a simulated blood check and sends pulse, oxygen, temperature and glucose to the console
// as readings, which then sync to the server when signed in.

const MISSION_ENV: Record<MissionProfileId, ZoeEnvId> = {
  iss: 'space',
  lunar: 'moon',
  mars: 'mars',
};

const SCAN_LABEL: Record<ScanPhase, string> = {
  idle: 'Scan a finger',
  inserting: 'Insert finger…',
  scanning: 'Scanning…',
  done: 'Remove finger',
};

export function Zoe() {
  const { mission } = useOutletContext<{ mission: MissionProfileId }>();
  const { readings, add } = useReadings();
  const sync = useSync();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const ctl = useRef<ZoeControls | null>(null);
  const readingsRef = useRef(readings);
  const [failed, setFailed] = useState(false);
  // The gravity setting follows the mission until you pick another one for this mission.
  const [picked, setPicked] = useState<{ mission: MissionProfileId; env: ZoeEnvId } | null>(null);
  const envId = picked?.mission === mission ? picked.env : MISSION_ENV[mission];
  const setEnvId = (env: ZoeEnvId) => setPicked({ mission, env });
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [explode, setExplode] = useState(false);
  const [flip, setFlip] = useState(false);
  const [clearCase, setClearCase] = useState(true);
  const [spin, setSpin] = useState(true);
  const [result, setResult] = useState<ScanValue[] | null>(null);

  useEffect(() => {
    readingsRef.current = readings;
  }, [readings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const c = createZoeScene(canvas, labels, {
      reduceMotion,
      fontDisplay: font,
      onScanPhase: (p) => {
        setPhase(p);
        if (p === 'done') {
          // Blood check finished: send the values to the console.
          const values = zoeScanValues(readingsRef.current);
          const timestamp = new Date().toISOString();
          for (const v of values) add({ ...v, timestamp, note: ZOE_NOTE });
          setResult(values);
        }
      },
    });
    if (!c) {
      queueMicrotask(() => setFailed(true));
      return;
    }
    ctl.current = c;
    if (reduceMotion) queueMicrotask(() => setSpin(false));
    return () => {
      c.dispose();
      ctl.current = null;
    };
  }, [add]);

  useEffect(() => ctl.current?.setEnv(envId), [envId]);

  const env = zoeEnv(envId);
  const toggle = (on: boolean, set: (v: boolean) => void, apply?: (v: boolean) => void) => {
    set(!on);
    apply?.(!on);
  };
  const pill =
    'h-10 cursor-pointer rounded-full border px-4 text-[14px] font-medium transition-colors';
  const pillCls = (on: boolean) =>
    `${pill} ${on ? 'border-[#ff7a45] bg-[#ff7a45] text-[#1b0c04]' : 'border-line-2 bg-raised text-ink hover:border-[#3fe0c5]'}`;

  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader
        title="ZOĒ device"
        meta={[
          { label: 'Setting', value: env.label },
          { label: 'Gravity', value: env.gravityLabel },
        ]}
      >
        <span className="text-sm text-muted">Drag to rotate. Scroll to zoom.</span>
      </PageHeader>

      <div className="chc-fit-cols flex flex-col gap-3.5 xl:min-h-0 xl:flex-1 xl:flex-row">
        {/* 3D stage */}
        <section
          aria-label="ZOĒ wearable cube, 3D"
          className="relative flex min-h-[460px] min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-line bg-sunk xl:min-h-0"
        >
          <canvas
            ref={canvasRef}
            aria-label="Rotatable 3D model of the ZOĒ immune monitoring cube"
            className="absolute inset-0 size-full"
          />
          <div
            ref={labelsRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          />
          {failed && (
            <p className="absolute inset-0 m-0 flex items-center justify-center p-6 text-center text-muted">
              This browser could not start 3D graphics, so the model cannot be shown here.
            </p>
          )}
          <div className="relative mt-auto flex flex-col items-center gap-2 p-3">
            <div
              role="radiogroup"
              aria-label="Gravity setting"
              className="chc-glass flex flex-wrap items-center gap-1 rounded-full border border-line p-1 pl-3.5"
            >
              <span className="mr-1 text-[13px] text-muted">Gravity</span>
              {ZOE_ENVS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={e.id === envId}
                  onClick={() => setEnvId(e.id)}
                  className="h-9 cursor-pointer rounded-full px-3.5 text-[14px] font-medium text-ink aria-checked:bg-ink aria-checked:text-bg"
                >
                  {e.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                aria-pressed={phase !== 'idle'}
                disabled={phase === 'inserting' || phase === 'scanning'}
                onClick={() => {
                  if (phase === 'idle') {
                    setExplode(false);
                    setResult(null);
                  }
                  ctl.current?.scan();
                }}
                className={`${pillCls(phase !== 'idle')} disabled:cursor-progress`}
              >
                {SCAN_LABEL[phase]}
              </button>
              <button
                type="button"
                aria-pressed={explode}
                onClick={() => toggle(explode, setExplode, (v) => ctl.current?.setExplode(v))}
                className={pillCls(explode)}
              >
                {explode ? 'Put it back together' : 'Show the layers'}
              </button>
              <button
                type="button"
                aria-pressed={flip}
                onClick={() => toggle(flip, setFlip, (v) => ctl.current?.setFlip(v))}
                className={pillCls(flip)}
              >
                {flip ? 'Show display side' : 'Show sensor side'}
              </button>
              <button
                type="button"
                aria-pressed={clearCase}
                onClick={() => toggle(clearCase, setClearCase, (v) => ctl.current?.setClearCase(v))}
                className={pillCls(clearCase)}
              >
                Clear case
              </button>
              <button
                type="button"
                aria-pressed={spin}
                onClick={() => toggle(spin, setSpin, (v) => ctl.current?.setSpin(v))}
                className={pillCls(spin)}
              >
                Auto-rotate
              </button>
            </div>
          </div>
        </section>

        {/* Info + scan results */}
        <aside className="chc-scroll flex min-w-0 flex-col gap-3.5 xl:w-[clamp(300px,25vw,400px)] xl:shrink-0">
          <section
            aria-live="polite"
            className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-4"
          >
            <h2 className="m-0 text-lg font-medium">Finger scan</h2>
            {result ? (
              <>
                <p className="m-0 flex items-center gap-2 text-[14px] text-ok">
                  <IconCheckCircle size={18} />
                  {sync.status === 'synced' || sync.status === 'syncing'
                    ? 'Sent to your console and the Aegis server.'
                    : 'Sent to your console.'}
                </p>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {result.map((v) => {
                    const ind = getIndicator(v.indicatorId);
                    if (!ind) return null;
                    const tone = toneOf(getStatus(ind, v.value).level);
                    return (
                      <li
                        key={v.indicatorId}
                        className="flex items-center justify-between gap-2 rounded-lg bg-sunk px-3 py-2"
                      >
                        <span className="text-[14px]">{ind.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[15px] font-medium">
                            {formatValue(ind, v.value)}{' '}
                            <span className="text-[12px] text-muted">{ind.unit}</span>
                          </span>
                          {tone && <StatusPill tone={tone} />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <Link to="/" className="text-[14px] text-accent no-underline hover:underline">
                  See it on Today →
                </Link>
              </>
            ) : (
              <p className="m-0 text-[14px] leading-5 text-muted">
                Press <strong className="text-ink">Scan a finger</strong>. ZOĒ checks pulse, blood
                oxygen, temperature and a micro blood sample, then sends the readings to your
                console. Concept device: values are simulated.
              </p>
            )}
          </section>

          <section
            className="flex flex-col gap-2 rounded-[18px] border border-l-[3px] border-line bg-surface p-4"
            style={{ borderLeftColor: hex(env.color) }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="m-0 text-lg font-medium">{env.name}</h2>
              <span className="font-mono text-[13px] whitespace-nowrap text-muted">
                {env.gravityLabel}
              </span>
            </div>
            <p className="m-0 text-[14px] leading-5 text-text">{env.text}</p>
            <p className="m-0 text-[13px] text-muted">
              Simulated immune index: <strong className="text-ink">{env.idx}</strong> of 100. Demo
              values, not measurements.
            </p>
          </section>

          <section className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-4">
            <h2 className="m-0 text-base font-medium">Sensors and parts</h2>
            {(() => {
              let n = 0;
              return ZOE_MARK_SECTIONS.map((sec) => (
                <div key={sec.title} className="flex flex-col gap-1">
                  <h3 className="m-0 font-mono text-[11px] tracking-[0.16em] text-accent uppercase">
                    {sec.title}
                  </h3>
                  <ol className="m-0 flex list-none flex-col gap-1 p-0">
                    {sec.items.map((it) => {
                      const num = ++n;
                      return (
                        <li
                          key={it.name}
                          tabIndex={0}
                          onMouseEnter={() => ctl.current?.highlight(num)}
                          onMouseLeave={() => ctl.current?.highlight(null)}
                          onFocus={() => ctl.current?.highlight(num)}
                          onBlur={() => ctl.current?.highlight(null)}
                          className="group flex cursor-default items-start gap-2 rounded-md px-1 py-0.5 text-[13px] leading-[18px] outline-none hover:bg-hover focus-visible:bg-hover"
                        >
                          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-[#3fe0c5] font-mono text-[11px] group-hover:border-[#ff7a45] group-hover:bg-[#ff7a45] group-hover:text-[#1b0c04]">
                            {num}
                          </span>
                          <span>
                            <span className="font-medium text-ink">{it.name}</span>
                            {it.desc && <span className="text-muted"> {it.desc}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ));
            })()}
          </section>

          <section className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-4">
            <h2 className="m-0 text-base font-medium">NASA’s five hazards here</h2>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {ZOE_HAZARDS.map((h, i) => (
                <li key={h} className="flex items-center justify-between gap-2 text-[14px]">
                  <span>{h}</span>
                  <span role="img" aria-label={`level ${env.haz[i]} of 3`} className="flex gap-1">
                    {[0, 1, 2].map((j) => (
                      <i
                        key={j}
                        className="inline-block size-2 rounded-full border"
                        style={{
                          borderColor: j < env.haz[i] ? hex(env.color) : 'var(--color-muted)',
                          background: j < env.haz[i] ? hex(env.color) : 'transparent',
                        }}
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="m-0 text-[12px] text-muted">
              Levels are our estimate. NASA names these hazards but does not rate them.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
