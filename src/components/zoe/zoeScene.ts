import * as THREE from 'three';
import { hex, ZOE_BARS, zoeEnv, type ZoeEnv, type ZoeEnvId } from './zoeData';

// Owner B: the ZOĒ wearable cube in three.js, ported from the team's "ZOĒ clear-case sensor
// model" artifact (bundled, so it works offline): a see-through case showing the finger well,
// board, batteries and sensors, with numbered markers (legend in pages/Zoe.tsx, names in
// ZOE_MARK_SECTIONS). Imperative scene; the React page owns the buttons. Light intensities are
// scaled by PI with decay 0 to match the artifact's pre-r155 lighting.

export type ScanPhase = 'idle' | 'inserting' | 'scanning' | 'done';

export interface ZoeControls {
  setEnv(id: ZoeEnvId): void;
  setExplode(on: boolean): void;
  setFlip(on: boolean): void;
  setClearCase(on: boolean): void;
  setSpin(on: boolean): void;
  /** Highlight marker n (1-based), or none. */
  highlight(n: number | null): void;
  /** Start a scan (idle) or remove the finger (done). */
  scan(): void;
  dispose(): void;
}

interface Options {
  reduceMotion: boolean;
  onScanPhase(phase: ScanPhase): void;
  fontDisplay: string;
}

interface Part {
  g: THREE.Group;
  y0: number;
  off: number;
}

const PI = Math.PI;

function rbox(w: number, h: number, d: number, r: number, hole?: number): THREE.ExtrudeGeometry {
  const b = Math.min(0.06, h / 4);
  w -= 2 * b;
  d -= 2 * b;
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  if (hole) {
    const hp = new THREE.Path();
    hp.absarc(0, 0, hole, 0, PI * 2, true);
    s.holes.push(hp);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - 2 * b,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 14,
  });
  g.rotateX(-PI / 2);
  g.center();
  return g;
}

function std(
  color: number,
  roughness: number,
  metalness: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

const glow = (color: number, intensity: number) => ({
  emissive: new THREE.Color(color),
  emissiveIntensity: intensity,
});

/** Marker positions in the order of ZOE_MARK_SECTIONS: [group, x, y, z]. */
type MarkPos = [THREE.Group, number, number, number];

export function createZoeScene(
  canvas: HTMLCanvasElement,
  labelBox: HTMLElement,
  opts: Options,
): ZoeControls | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x141a30, 0.85 * PI));
  const key = new THREE.DirectionalLight(0xffffff, 1.1 * PI);
  key.position.set(5, 8, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0xff7a45, 1.2 * PI, 40, 0);
  rim.position.set(-7, -2, -6);
  scene.add(rim);
  const fill = new THREE.PointLight(0x3fe0c5, 0.6 * PI, 40, 0);
  fill.position.set(6, -5, 4);
  scene.add(fill);

  // Stars
  {
    const n = 420;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 45 + Math.random() * 40;
      const a = Math.random() * PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(b) * Math.cos(a);
      pos[i * 3 + 1] = r * Math.cos(b);
      pos[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(
      new THREE.Points(
        g,
        new THREE.PointsMaterial({ color: 0xaab6e6, size: 0.22, transparent: true, opacity: 0.7 }),
      ),
    );
  }

  const model = new THREE.Group();
  model.scale.setScalar(0.82);
  scene.add(model);
  // Clear case: shell and top plate are see-through so the parts inside show.
  const shellMat = std(0xe8eaf0, 0.25, 0.1, {
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const glassMat = std(0x9fb4d8, 0.1, 0.2, { transparent: true, opacity: 0.22, depthWrite: false });
  const parts: Part[] = [];
  const addPart = (g: THREE.Group, y0: number, off: number) => {
    g.position.y = y0;
    model.add(g);
    parts.push({ g, y0, off });
  };
  const add = (
    g: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  // Finger port with the display texture
  const HOLE = 0.62;
  const dispCanvas = document.createElement('canvas');
  dispCanvas.width = 512;
  dispCanvas.height = 212;
  const dctx = dispCanvas.getContext('2d')!;
  const dispTex = new THREE.CanvasTexture(dispCanvas);
  dispTex.colorSpace = THREE.SRGBColorSpace;
  const ringMat = std(0xff7a45, 0.35, 0.3, glow(0xff7a45, 0.5));
  const gDisplay = new THREE.Group();
  gDisplay.add(new THREE.Mesh(rbox(2.9, 0.12, 2.9, 0.5, HOLE), glassMat));
  const collar = new THREE.Mesh(new THREE.TorusGeometry(HOLE + 0.05, 0.07, 12, 60), ringMat);
  collar.rotation.x = PI / 2;
  collar.position.y = 0.07;
  gDisplay.add(collar);
  addPart(gDisplay, 1.44, 2.6);

  // Upper shell
  const gUpper = new THREE.Group();
  gUpper.add(new THREE.Mesh(rbox(3, 1.2, 3, 0.55, HOLE), shellMat));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.95),
    new THREE.MeshBasicMaterial({ map: dispTex }),
  );
  screen.position.set(0, 0, 1.506);
  gUpper.add(screen);
  for (const [color, side] of [
    [0xff3b3b, -1],
    [0x10151f, 1],
  ] as const) {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.16, 0.2),
      std(color, 0.3, 0, glow(color, 1.2)),
    );
    led.position.set(side * (HOLE - 0.01), 0.25, 0);
    gUpper.add(led);
  }
  const bioMat = std(0x3fe0c5, 0.4, 0.2, glow(0x3fe0c5, 0.6));
  const scanRing = new THREE.Mesh(new THREE.TorusGeometry(HOLE - 0.04, 0.03, 8, 48), bioMat);
  scanRing.rotation.x = PI / 2;
  gUpper.add(scanRing);
  const btn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.1, 24),
    std(0xff7a45, 0.4, 0.5),
  );
  btn.rotation.z = PI / 2;
  btn.position.set(1.52, 0.1, 0.5);
  gUpper.add(btn);
  addPart(gUpper, 0.78, 1.6);

  // Main board
  const gPcb = new THREE.Group();
  gPcb.add(new THREE.Mesh(rbox(2.5, 0.08, 2.5, 0.4, HOLE), std(0x0f5a52, 0.6, 0.1)));
  [
    [-0.95, 0.75, 0.6, 0.5],
    [0.9, -0.8, 0.6, 0.5],
    [0.9, 0.85, 0.5, 0.4],
    [-0.9, -0.85, 0.5, 0.3],
  ].forEach(([x, z, w, d], i) => {
    add(
      gPcb,
      new THREE.BoxGeometry(w, 0.1, d),
      std(i === 0 ? 0x1a1d26 : 0x2a2f3d, 0.5, 0.3),
      x,
      0.09,
      z,
    );
  });
  const gold = std(0xd9b24a, 0.3, 0.9);
  for (let i = 0; i < 6; i++)
    add(gPcb, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), gold, -1 + i * 0.4, 0.05, -1.05);
  add(gPcb, new THREE.CylinderGeometry(0.18, 0.18, 0.14, 24), gold, -1.0, 0.11, 0.1);
  addPart(gPcb, 0.4, 0.75);

  // Status ring
  const gRing = new THREE.Group();
  gRing.add(new THREE.Mesh(rbox(3.04, 0.16, 3.04, 0.57, HOLE), ringMat));
  addPart(gRing, 0, 0);

  // Batteries
  const gBat = new THREE.Group();
  for (const x of [-0.98, 0.98])
    add(gBat, rbox(0.55, 0.5, 2.0, 0.15), std(0x8fa0c4, 0.3, 0.7), x, 0, 0);
  addPart(gBat, -0.4, -0.85);

  // Lower shell
  const gLower = new THREE.Group();
  gLower.add(new THREE.Mesh(rbox(3, 1.2, 3, 0.55, HOLE), shellMat));
  for (const z of [-1, 1])
    add(
      gLower,
      new THREE.BoxGeometry(0.25, 0.3, 0.05),
      std(0xcfd3dc, 0.2, 0.95),
      0,
      0.1,
      z * (HOLE - 0.01),
    );
  for (let i = 0; i < 3; i++)
    add(
      gLower,
      new THREE.BoxGeometry(0.06, 0.07, 0.9),
      std(0x0b1020, 0.5, 0.2),
      1.5,
      -0.25 + i * 0.16,
      0,
    );
  add(
    gLower,
    new THREE.BoxGeometry(0.08, 0.14, 1.0),
    std(0x0b1020, 0.3, 0.3, glow(0x3fe0c5, 0.35)),
    -1.5,
    -0.2,
    0,
  );
  addPart(gLower, -0.78, -1.75);

  // Well floor
  const gSens = new THREE.Group();
  gSens.add(new THREE.Mesh(rbox(2.9, 0.12, 2.9, 0.5), std(0x161b2b, 0.3, 0.3)));
  add(gSens, rbox(0.8, 0.06, 0.8, 0.15), std(0x0e3f48, 0.4, 0.2), 0, 0.08, 0);
  const needleGeo = new THREE.ConeGeometry(0.035, 0.13, 8);
  const steel = std(0xcfd3dc, 0.2, 0.95);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      add(gSens, needleGeo, steel, -0.16 + i * 0.16, 0.17, -0.16 + j * 0.16);
  const ledLight = new THREE.PointLight(0x3fe0c5, 0, 6, 0);
  ledLight.position.y = 0.6;
  gSens.add(ledLight);
  addPart(gSens, -1.44, -2.7);

  // Component detail (visible through the clear case)
  const dark = std(0x1a1d26, 0.5, 0.3);
  const tan = std(0xc9a26b, 0.6, 0.1);
  const trace = std(0x2fae8f, 0.5, 0.2);
  const liner = add(
    model,
    new THREE.CylinderGeometry(HOLE - 0.01, HOLE - 0.01, 2.88, 48, 1, true),
    std(0x3fe0c5, 0.3, 0, {
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    0,
    0.06,
    0,
  );
  const tdisc = add(
    gUpper,
    new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20),
    std(0xc77b4a, 0.3, 0.8),
    0,
    0,
    -(HOLE - 0.01),
  );
  tdisc.rotation.x = PI / 2;
  add(gPcb, new THREE.BoxGeometry(0.4, 0.03, 0.32), steel, -0.95, 0.155, 0.75);
  for (let i = 0; i < 5; i++) {
    add(gPcb, new THREE.BoxGeometry(0.03, 0.03, 0.06), steel, -1.19 + i * 0.12, 0.06, 1.03);
    add(gPcb, new THREE.BoxGeometry(0.03, 0.03, 0.06), steel, -1.19 + i * 0.12, 0.06, 0.47);
  }
  add(gPcb, new THREE.BoxGeometry(0.5, 0.06, 0.4), steel, 0.9, 0.17, -0.8);
  add(gPcb, new THREE.BoxGeometry(0.5, 0.015, 0.03), gold, 0.45, 0.05, -1.1);
  add(gPcb, new THREE.BoxGeometry(0.03, 0.015, 0.3), gold, 0.2, 0.05, -0.96);
  add(gPcb, new THREE.BoxGeometry(0.22, 0.04, 0.22), std(0x7a5cff, 0.4, 0.4), 0.9, 0.16, 0.85);
  add(gPcb, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), steel, -0.9, 0.16, -0.85);
  add(gPcb, new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8), dark, -0.9, 0.215, -0.85);
  for (const [x, z] of [
    [-0.3, 1.05],
    [0.0, 1.05],
    [0.3, 1.05],
    [1.1, 0.2],
    [1.1, -0.1],
    [-1.1, -0.4],
  ])
    add(gPcb, new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), tan, x, 0.09, z);
  for (const [x, z, w, d] of [
    [-0.95, 0.3, 0.02, 0.5],
    [0.9, 0.3, 0.02, 0.7],
    [-0.4, -0.95, 0.9, 0.02],
    [0.3, 0.95, 0.9, 0.02],
    [-1.1, -0.2, 0.02, 0.9],
  ])
    add(gPcb, new THREE.BoxGeometry(w, 0.012, d), trace, x, 0.046, z);
  add(gPcb, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24), dark, -1.0, 0.19, 0.1);
  for (const x of [-0.98, 0.98]) {
    add(gBat, new THREE.BoxGeometry(0.3, 0.3, 0.06), gold, x, 0, -1.0);
    add(gBat, new THREE.BoxGeometry(0.3, 0.3, 0.06), steel, x, 0, 1.0);
    add(gBat, new THREE.BoxGeometry(0.56, 0.51, 0.3), std(0xff7a45, 0.5, 0.2), x, 0, 0.3);
  }
  add(gLower, new THREE.BoxGeometry(0.4, 0.3, 0.7), std(0x0f5a52, 0.6, 0.1), 1.2, -0.17, 0);
  add(gLower, new THREE.BoxGeometry(0.2, 0.2, 0.3), steel, 1.2, -0.17, 0);
  add(gLower, new THREE.BoxGeometry(0.4, 0.2, 0.95), std(0x0f5a52, 0.6, 0.1), -1.2, -0.2, 0);
  add(
    gLower,
    new THREE.BoxGeometry(0.3, 0.03, 0.7),
    std(0x3fe0c5, 0.4, 0.1, glow(0x3fe0c5, 0.5)),
    -1.2,
    -0.09,
    0,
  );
  add(
    gDisplay,
    new THREE.CylinderGeometry(0.09, 0.09, 0.03, 20),
    std(0xf2f4fa, 0.2, 0.1, glow(0xffffff, 0.25)),
    1.0,
    0.07,
    1.0,
  );
  add(gDisplay, new THREE.CylinderGeometry(0.09, 0.09, 0.03, 20), dark, -1.0, 0.07, 1.0);
  for (const [dx, dz] of [
    [-0.03, 0],
    [0.03, 0.03],
    [0.03, -0.03],
  ])
    add(
      gDisplay,
      new THREE.CylinderGeometry(0.012, 0.012, 0.035, 6),
      steel,
      -1.0 + dx,
      0.072,
      1.0 + dz,
    );
  const rr = add(gSens, new THREE.TorusGeometry(0.5, 0.03, 8, 40), gold, 0, 0.07, 0);
  rr.rotation.x = PI / 2;

  // Finger
  const finger = new THREE.Group();
  const fMat = std(0xdfe6f5, 0.7, 0);
  finger.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 24), fMat));
  const ftip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), fMat);
  ftip.position.y = -1.5;
  finger.add(ftip);
  finger.visible = false;
  model.add(finger);

  // Environment
  let env: ZoeEnv = zoeEnv('space');
  const cur = { idx: env.idx, bars: [...env.bars] };
  const envCol = new THREE.Color(env.color);
  const planetMat = new THREE.MeshLambertMaterial({
    color: 0x2f6fd0,
    emissive: 0x2f6fd0,
    emissiveIntensity: 0.35,
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(9, 48, 32), planetMat);
  planet.position.set(-13, -12, -34);
  planet.scale.setScalar(0.001);
  camera.add(planet);
  let planetScale = 0;

  // Floating particles (fall with gravity, drift when weightless)
  const PN = 90;
  const ppos = new Float32Array(PN * 3);
  const pvel = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) {
    ppos[i * 3] = (Math.random() - 0.5) * 12;
    ppos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    ppos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    pvel[i * 3] = (Math.random() - 0.5) * 0.3;
    pvel[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
    pvel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  scene.add(
    new THREE.Points(
      pgeo,
      new THREE.PointsMaterial({ color: 0xe9edf7, size: 0.07, transparent: true, opacity: 0.75 }),
    ),
  );

  // Numbered markers (order = ZOE_MARK_SECTIONS)
  const MARK_POS: MarkPos[] = [
    [gUpper, -0.61, 0.25, 0],
    [gUpper, 0.61, 0.25, 0],
    [gUpper, 0, 0, -0.61],
    [gLower, 0, 0.1, 0.61],
    [gSens, 0, 0.2, 0],
    [gPcb, -1.0, 0.2, 0.1],
    [gPcb, 0.9, 0.18, 0.85],
    [gPcb, -0.9, 0.22, -0.85],
    [gLower, 1.2, -0.02, 0],
    [gDisplay, 1.0, 0.1, 1.0],
    [gDisplay, -1.0, 0.1, 1.0],
    [gLower, -1.2, -0.08, 0],
    [gDisplay, 0.67, 0.12, 0],
    [gUpper, 0.95, 0, 1.51],
    [gPcb, -0.95, 0.18, 0.75],
    [gPcb, 0.9, 0.2, -0.8],
    [gRing, 1.5, 0, -1.0],
    [gBat, 0.98, 0.26, -0.5],
    [gUpper, 1.56, 0.1, 0.5],
  ];
  const marks = MARK_POS.map(([g, x, y, z], i) => {
    const el = document.createElement('div');
    el.className = 'zoe-marker';
    el.textContent = String(i + 1);
    labelBox.append(el);
    return { el, g, pos: new THREE.Vector3(x, y, z) };
  });

  // State
  let theta = 0.7;
  let phi = 1.05;
  let phiTarget = 1.05;
  let dist = 11.5;
  let explode = 0;
  let explodeTarget = 0;
  let spin = !opts.reduceMotion;
  let dragging = false;
  let lx = 0;
  let ly = 0;
  let scan: 0 | 1 | 2 | 3 = 0;
  let scanClock = 0;
  let fingerT = 0;
  let fingerTarget = 0;
  const setPhase = (s: 0 | 1 | 2 | 3) => {
    scan = s;
    opts.onScanPhase((['idle', 'inserting', 'scanning', 'done'] as const)[s]);
  };

  const onDown = (e: PointerEvent) => {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
    canvas.style.cursor = 'grabbing';
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    theta -= (e.clientX - lx) * 0.008;
    phiTarget = Math.max(0.2, Math.min(2.9, phiTarget - (e.clientY - ly) * 0.008));
    phi = phiTarget;
    lx = e.clientX;
    ly = e.clientY;
  };
  const onUp = () => {
    dragging = false;
    canvas.style.cursor = 'grab';
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    dist = Math.max(6.5, Math.min(22, dist + e.deltaY * 0.01));
  };
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  let W = 1;
  let H = 1;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const drawDisplay = () => {
    const c = dctx;
    c.fillStyle = '#070b18';
    c.fillRect(0, 0, 512, 212);
    c.textAlign = 'left';
    c.fillStyle = '#8b95b3';
    c.font = `500 22px ${opts.fontDisplay}`;
    c.fillText('ZOĒ', 20, 34);
    if (scan === 1 || scan === 2) {
      c.fillStyle = '#e9edf7';
      c.font = `600 34px ${opts.fontDisplay}`;
      c.fillText('Scanning finger', 20, 112);
      c.fillStyle = '#1b2444';
      c.fillRect(20, 140, 472, 14);
      c.fillStyle = '#3fe0c5';
      c.fillRect(20, 140, 472 * (scan === 2 ? Math.min(1, scanClock / 2.4) : 0), 14);
      dispTex.needsUpdate = true;
      return;
    }
    c.fillStyle = '#e9edf7';
    c.font = `600 84px ${opts.fontDisplay}`;
    c.fillText(String(Math.round(cur.idx)), 18, 122);
    c.fillStyle = '#8b95b3';
    c.font = `400 17px ${opts.fontDisplay}`;
    c.fillText(scan === 3 ? 'sent to Aegis' : 'immune index', 20, 150);
    c.fillStyle = hex(env.color);
    c.font = `500 20px ${opts.fontDisplay}`;
    c.fillText(env.status, 20, 190);
    c.fillStyle = '#8b95b3';
    c.textAlign = 'right';
    c.font = `400 16px ${opts.fontDisplay}`;
    c.fillText(env.name.split(',')[0], 492, 34);
    c.textAlign = 'left';
    for (let i = 0; i < 5; i++) {
      const y = 58 + i * 29;
      c.fillStyle = '#8b95b3';
      c.font = `400 16px ${opts.fontDisplay}`;
      c.fillText(ZOE_BARS[i], 210, y + 12);
      c.fillStyle = '#1b2444';
      c.fillRect(300, y, 192, 12);
      c.fillStyle = i === 0 ? '#3fe0c5' : '#ff7a45';
      c.fillRect(300, y, (192 * cur.bars[i]) / 100, 12);
    }
    dispTex.needsUpdate = true;
  };

  const v = new THREE.Vector3();
  let last = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    // The scan runs on wall-clock time (up to 1 s per frame) so it still finishes on schedule
    // when the browser throttles frames, e.g. in a background tab.
    const scanDt = Math.min(1, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    if (spin && !dragging) theta += dt * 0.35;
    phi += (phiTarget - phi) * Math.min(1, dt * 4);
    explode += (explodeTarget - explode) * Math.min(1, dt * 3.2);
    const k = explode * explode * (3 - 2 * explode);
    for (const p of parts) p.g.position.y = p.y0 + p.off * k;
    liner.visible = k < 0.05;

    const e = Math.min(1, dt * 2.5);
    cur.idx += (env.idx - cur.idx) * e;
    for (let i = 0; i < 5; i++) cur.bars[i] += (env.bars[i] - cur.bars[i]) * e;
    envCol.setHex(env.color);
    ringMat.color.lerp(envCol, e);
    ringMat.emissive.lerp(envCol, e);
    planetScale += ((env.planet === null ? 0 : 1) - planetScale) * e;
    planet.scale.setScalar(Math.max(0.001, planetScale));

    if (!opts.reduceMotion) {
      for (let q = 0; q < PN; q++) {
        const ix = q * 3;
        if (env.g === 0)
          pvel[ix + 1] += (((q % 7) - 3) * 0.04 - pvel[ix + 1]) * Math.min(1, dt * 2);
        else pvel[ix + 1] -= env.g * 9 * dt;
        ppos[ix] += pvel[ix] * dt;
        ppos[ix + 1] += pvel[ix + 1] * dt;
        ppos[ix + 2] += pvel[ix + 2] * dt;
        if (ppos[ix + 1] < -5) {
          ppos[ix + 1] = 5;
          pvel[ix + 1] = 0;
        }
        if (ppos[ix + 1] > 5.2) ppos[ix + 1] = -5;
        if (Math.abs(ppos[ix]) > 6) ppos[ix] *= -0.98;
        if (Math.abs(ppos[ix + 2]) > 6) ppos[ix + 2] *= -0.98;
      }
      pgeo.attributes.position.needsUpdate = true;
    }
    ledLight.intensity = (0.4 + 0.8 * (0.5 + 0.5 * Math.sin(t * 2))) * PI;
    ringMat.emissiveIntensity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.6));
    fingerT += (fingerTarget - fingerT) * Math.min(1, scanDt * 2.5);
    finger.position.y = 5.4 - fingerT * 4.3;
    finger.visible = fingerT > 0.02 && k < 0.05;
    if (scan === 1 && fingerT > 0.97) {
      scanClock = 0;
      setPhase(2);
    }
    if (scan === 2) {
      scanClock += scanDt;
      if (scanClock > 2.4) {
        // Results in: the display counts back up from zero.
        cur.idx = 0;
        cur.bars = [0, 0, 0, 0, 0];
        setPhase(3);
      }
    }
    scanRing.position.y = scan === 2 ? Math.sin(scanClock * 5) * 0.45 : 0;
    bioMat.emissiveIntensity = scan === 2 ? 2.2 : 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2));
    if (scan === 2) ledLight.intensity = 2 * PI;
    drawDisplay();

    const dd = dist + k * 7;
    const sp = Math.sin(phi);
    camera.position.set(dd * sp * Math.sin(theta), dd * Math.cos(phi), dd * sp * Math.cos(theta));
    camera.lookAt(0, -0.05 * k, 0);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);

    model.updateMatrixWorld(true);
    for (const m of marks) {
      v.copy(m.pos);
      m.g.localToWorld(v);
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * W;
      const y = (-v.y * 0.5 + 0.5) * H;
      m.el.style.transform = `translate(${(x - 10).toFixed(1)}px,${(y - 10).toFixed(1)}px)`;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    setEnv(id) {
      env = zoeEnv(id);
      if (env.planet !== null) {
        planetMat.color.setHex(env.planet);
        planetMat.emissive.setHex(env.planet);
      }
    },
    setExplode(on) {
      if (on && scan !== 0) {
        fingerTarget = 0;
        setPhase(0);
      }
      explodeTarget = on ? 1 : 0;
    },
    setFlip(on) {
      phiTarget = on ? 2.25 : 1.05;
    },
    setClearCase(on) {
      shellMat.opacity = on ? 0.16 : 1;
      shellMat.depthWrite = !on;
      glassMat.opacity = on ? 0.22 : 0.9;
      glassMat.depthWrite = !on;
    },
    setSpin(on) {
      spin = on;
    },
    highlight(n) {
      marks.forEach((m, i) => m.el.classList.toggle('hot', n === i + 1));
    },
    scan() {
      if (scan === 0) {
        explodeTarget = 0;
        fingerTarget = 1;
        scanClock = 0;
        setPhase(1);
      } else if (scan === 3) {
        fingerTarget = 0;
        setPhase(0);
      }
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      labelBox.replaceChildren();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
        }
      });
      dispTex.dispose();
      renderer.dispose();
    },
  };
}
