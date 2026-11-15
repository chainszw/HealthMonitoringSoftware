import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { getScenario, pickScenario, type ScenarioId } from '../data/scenarios';
import { API_URL } from '../lib/apiConfig';
import { detectMode, startDemo, startLive, type DataMode } from '../lib/dataSource';
import { useReadings, useSession } from '../lib/useReadings';
import { FigureArt } from './FigureArt';
import { IconRotate } from './icons';
import { CalmDots } from './CalmDots';
import { closeStart, type Experience } from './startGate';

// Owner B: the start screen shown before the app, split diagonally in two: ZOĒ device on one
// side, Health Console on the other, in a graffiti style with flat space colours (layered flat
// colours, no gradients). It also checks the backend: real data when it is up and you are signed
// in, otherwise a random demo scenario with spikes.

const NEUTRAL = () => '#1f6f8b';

export function StartScreen() {
  const navigate = useNavigate();
  const { session, signIn } = useSession();
  useReadings(); // starts background sync when a backend is configured
  const [mode, setMode] = useState<DataMode | 'checking'>('checking');
  const [scenario, setScenario] = useState<ScenarioId | undefined>();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void detectMode(API_URL).then((m) => {
      if (!live) return;
      if (m === 'demo') setScenario(startDemo());
      if (m === 'live') startLive();
      setMode(m);
    });
    return () => {
      live = false;
    };
  }, []);

  const chooseDemo = () => {
    setScenario(startDemo());
    setMode('demo');
  };
  const shuffle = () => setScenario(startDemo(pickScenario(Math.random, scenario)));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await signIn(token);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    startLive();
    setMode('live');
  };
  const enter = (exp: Experience) => {
    if (mode === 'checking') return;
    if (mode === 'sign-in') {
      // Skipped sign-in: continue on demo data.
      const id = startDemo();
      closeStart('demo', id);
    } else {
      closeStart(mode, mode === 'demo' ? scenario : undefined);
    }
    navigate(exp === 'zoe' ? '/zoe' : '/');
  };

  const sc = scenario ? getScenario(scenario) : undefined;
  const ready = mode !== 'checking';

  return (
    <div className="chc-theme-neon fixed inset-0 overflow-hidden text-ink">
      <CalmDots opacity={0.55} />

      {/* ZOĒ half */}
      <button
        type="button"
        disabled={!ready}
        onClick={() => enter('zoe')}
        aria-label="Open the ZOĒ device: the 3D finger-scan cube that takes a blood check and sends the readings"
        className="chc-half chc-half-a group bg-[#120a3a]"
      >
        <Starfield tint="#ff2fd0" />
        <Planet className="absolute top-[18%] left-[6%] size-[clamp(80px,12vw,170px)]" />
        <Splat
          color="#ff2fd0"
          className="absolute top-[50%] left-[26%] size-[clamp(120px,14vw,210px)] opacity-80"
        />
        <ZoeCube className="absolute top-[55%] left-[30%] size-[clamp(80px,8.5vw,130px)]" />
        <span className="chc-half-copy chc-half-copy-a">
          <span className="chc-graffiti chc-graffiti-zoe text-[clamp(56px,9vw,140px)]">
            ZO<span className="chc-macron">E</span>
          </span>
          <Drips color="#ff2fd0" />
          <span className="chc-tagline">finger scan · blood check · sends data</span>
          <span className="chc-cta">Enter device →</span>
        </span>
      </button>

      {/* Health Console half */}
      <button
        type="button"
        disabled={!ready}
        onClick={() => enter('console')}
        aria-label="Open the Health Console: today’s vitals, live body view, trends and routine"
        className="chc-half chc-half-b group bg-[#04121f]"
      >
        <Starfield tint="#29f0ff" />
        <div className="chc-holo-grid absolute inset-0 opacity-60" />
        <div className="chc-fig-console absolute bottom-[4%] left-[47%] h-[min(46%,360px)] w-[min(18vw,230px)]">
          <FigureArt zoneFill={NEUTRAL} label="" className="size-full" />
        </div>
        <span className="chc-half-copy chc-half-copy-b">
          <span className="chc-graffiti chc-graffiti-console text-[clamp(44px,6.6vw,104px)]">
            CONSOLE
          </span>
          <Drips color="#29f0ff" />
          <span className="chc-tagline">vitals · body · trends · routine</span>
          <span className="chc-cta">Enter console →</span>
        </span>
      </button>

      {/* The diagonal seam: layered flat neon strokes */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="chc-seam pointer-events-none absolute inset-0 size-full"
      >
        <line
          x1="58"
          y1="0"
          x2="42"
          y2="100"
          stroke="#04050d"
          strokeWidth="14"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="58"
          y1="0"
          x2="42"
          y2="100"
          stroke="#f6ff3a"
          strokeWidth="8"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="58"
          y1="0"
          x2="42"
          y2="100"
          stroke="#ff2fd0"
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Title + data source, floating over the seam */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-3 px-4 pt-[clamp(14px,4vh,40px)]">
        <h1 className="chc-graffiti chc-graffiti-title m-0 text-[clamp(40px,6vw,88px)] leading-none">
          AEGIS
        </h1>
        <p className="m-0 font-mono text-[12px] tracking-[0.3em] text-acid uppercase">
          health console · pick your side
        </p>
        <section
          aria-live="polite"
          className="chc-glass pointer-events-auto flex w-full max-w-[640px] flex-col gap-2 border-2 border-[#29f0ff] px-4 py-3 shadow-[6px_6px_0_#ff2fd0]"
        >
          {mode === 'checking' && (
            <p className="m-0 flex items-center gap-2.5 font-mono text-[13px] text-muted">
              <span className="size-2.5 animate-chc-pulse bg-accent" />
              CHECKING THE AEGIS SERVER…
            </p>
          )}
          {mode === 'live' && (
            <p className="m-0 flex flex-wrap items-center gap-2.5 text-[14px]">
              <span className="size-2.5 bg-ok" />
              <strong className="font-mono font-medium tracking-[0.1em] text-ok">
                SERVER ONLINE · REAL DATA
              </strong>
              <span className="text-muted">Signed in as {session?.crew.name}.</span>
            </p>
          )}
          {mode === 'offline' && (
            <p className="m-0 flex flex-wrap items-center gap-2.5 text-[14px]">
              <span className="size-2.5 bg-watch" />
              <strong className="font-mono font-medium tracking-[0.1em] text-watch">
                SERVER UNREACHABLE
              </strong>
              <span className="text-muted">
                {session?.crew.name}’s saved readings; they sync when it’s back.
              </span>
            </p>
          )}
          {mode === 'sign-in' && (
            <form onSubmit={submit} className="flex flex-col gap-2">
              <p className="m-0 flex flex-wrap items-center gap-2.5 text-[14px]">
                <span className="size-2.5 bg-ok" />
                <strong className="font-mono font-medium tracking-[0.1em] text-ok">
                  SERVER ONLINE
                </strong>
                <span className="text-muted">Sign in with your crew token for real data.</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="start-token">
                  Crew token
                </label>
                <input
                  id="start-token"
                  type="password"
                  autoComplete="off"
                  placeholder="chc_…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="h-10 min-w-0 flex-1 border border-line-2 bg-sunk px-3 font-mono text-[14px] text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="h-10 cursor-pointer bg-accent px-4 font-mono text-[13px] font-medium tracking-[0.1em] text-accent-ink"
                >
                  {busy ? 'CHECKING…' : 'SIGN IN'}
                </button>
                <button
                  type="button"
                  onClick={chooseDemo}
                  className="h-10 cursor-pointer border border-pink px-4 font-mono text-[13px] tracking-[0.1em] text-pink"
                >
                  USE DEMO DATA
                </button>
              </div>
              {error && <p className="m-0 text-[13px] text-act">{error}</p>}
            </form>
          )}
          {mode === 'demo' && sc && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="size-2.5 bg-watch" />
              <strong className="font-mono text-[13px] font-medium tracking-[0.1em] text-watch">
                {API_URL ? 'SERVER OFFLINE' : 'NO SERVER'} · DEMO
              </strong>
              <span className="border border-pink px-2 py-0.5 text-[13px] font-medium text-pink">
                {sc.name}
              </span>
              <button
                type="button"
                onClick={shuffle}
                className="ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 border border-line-2 px-2.5 font-mono text-[12px] tracking-[0.1em] text-ink hover:border-accent"
              >
                <IconRotate size={14} />
                SHUFFLE
              </button>
              <p className="m-0 w-full text-[13px] text-muted">
                {sc.summary} Invented values; numbers stream live.
              </p>
            </div>
          )}
        </section>
      </div>

      <p className="absolute inset-x-0 bottom-2 z-20 m-0 text-center text-[12px] text-muted">
        Decision support only, not a diagnosis. Your flight surgeon has the final say.
      </p>
    </div>
  );
}

/** Flat star dots in two layers of colour. */
function Starfield({ tint }: { tint: string }) {
  return (
    <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="none">
      {Array.from({ length: 46 }, (_, i) => {
        const x = (i * 37.3) % 100;
        const y = (i * 61.7) % 100;
        return (
          <rect
            key={i}
            x={`${x}%`}
            y={`${y}%`}
            width={i % 5 === 0 ? 3 : 2}
            height={i % 5 === 0 ? 3 : 2}
            fill={i % 4 === 0 ? tint : '#e8fbff'}
            opacity={i % 3 === 0 ? 0.9 : 0.5}
          />
        );
      })}
    </svg>
  );
}

/** A flat-shaded planet: layered solid circles and a ring, no gradients. */
function Planet({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`chc-fig-float ${className}`}>
      <circle cx="50" cy="50" r="34" fill="#ff7a45" />
      <circle cx="58" cy="44" r="26" fill="#ff9a62" />
      <circle cx="40" cy="62" r="8" fill="#e05a2c" />
      <circle cx="62" cy="34" r="5" fill="#ffc29a" />
      <ellipse
        cx="50"
        cy="54"
        rx="48"
        ry="10"
        fill="none"
        stroke="#f6ff3a"
        strokeWidth="3"
        transform="rotate(-18 50 54)"
      />
    </svg>
  );
}

/** A graffiti paint splat: one flat blob and a few drops. */
function Splat({ color, className }: { color: string; className: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path
        d="M50 14c8 0 9 10 16 12s15-6 18 2-6 12-3 19 12 9 8 17-13 3-18 9-1 15-10 15-7-10-14-12-15 6-19-1 5-12 2-19-12-8-8-16 13-2 17-8 3-18 11-18z"
        fill={color}
      />
      <circle cx="12" cy="20" r="4" fill={color} />
      <circle cx="90" cy="84" r="3" fill={color} />
      <circle cx="80" cy="12" r="2.5" fill={color} />
      <path d="M44 86v10" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Paint drips under a graffiti word: flat strokes of two colours. */
function Drips({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 40" aria-hidden="true" className="-mt-2 h-7 w-[min(60%,260px)]">
      {[18, 46, 80, 118, 150, 182].map((x, i) => (
        <g key={x}>
          <path
            d={`M${x} 0v${10 + ((i * 7) % 22)}`}
            stroke="#04050d"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d={`M${x} 0v${10 + ((i * 7) % 22)}`}
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}

/** Small flat ZOĒ cube: layered solid shapes. */
function ZoeCube({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`chc-fig-float ${className}`}>
      <rect
        x="14"
        y="14"
        width="72"
        height="72"
        fill="none"
        stroke="#ff7a45"
        strokeWidth="3"
        transform="rotate(45 50 50)"
      />
      <rect x="24" y="24" width="52" height="52" rx="12" fill="#e8eaf0" />
      <rect x="24" y="60" width="52" height="16" rx="6" fill="#9aa3b8" />
      <circle cx="50" cy="44" r="12" fill="#0b1020" stroke="#ff7a45" strokeWidth="4" />
      <circle cx="50" cy="44" r="6" fill="none" stroke="#3fe0c5" strokeWidth="2" />
    </svg>
  );
}
