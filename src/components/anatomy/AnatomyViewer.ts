import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { organs, type Layer, type OrganInfo, type Sex } from './organs';

// Owner B: framework-independent 3D anatomy viewer, adapted from the team's crew-anatomy kit
// (HRA v1.5 models in public/models, CC BY 4.0). Adds `setTint` so organs can take the status
// colour of their body system, and a gentle idle "breathing" pulse. Mount in a sized element;
// call dispose() on unmount.

export interface AnatomyOptions {
  /** Directory containing male.glb and female.glb (served locally; no CDN). */
  modelBaseUrl: string;
  sex?: Sex;
  layer?: Layer;
  autoRotate?: boolean;
  /** Allow drag-rotate and zoom (off for small previews). */
  interactive?: boolean;
  /** Camera framing: 'full' body, or 'torso' (closer, for small panels). */
  framing?: 'full' | 'torso';
  onSelect?: (organ: OrganInfo | null) => void;
  onLoad?: (sex: Sex, available: OrganInfo[]) => void;
  onError?: (error: Error) => void;
}

interface Original {
  color: THREE.Color;
  opacity: number;
}

const BONES = ['spine', 'pelvis', 'knee_left', 'knee_right'];

export class AnatomyViewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
  readonly controls: OrbitControls;
  private host: HTMLElement;
  private options: AnatomyOptions;
  private loader = new GLTFLoader();
  private model: THREE.Group | null = null;
  private meshes: THREE.Mesh[] = [];
  private request = 0;
  private frame = 0;
  private disposed = false;
  private observer: ResizeObserver;
  private layer: Layer;
  private selected: string | null = null;
  private tint: Record<string, string> = {};
  private ray = new THREE.Raycaster();
  private down = new THREE.Vector2();
  private tooltip: HTMLDivElement;
  private originals = new Map<THREE.Mesh, Original>();
  private rotation: boolean;
  private clock = new THREE.Clock();
  private reduceMotion: boolean;

  constructor(host: HTMLElement, options: AnatomyOptions) {
    this.host = host;
    this.options = options;
    this.layer = options.layer ?? 'xray';
    this.rotation = options.autoRotate ?? false;
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // The tooltip is positioned inside the host; keep the host's own positioning if it has one.
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x071225, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
    canvas.tabIndex = options.interactive === false ? -1 : 0;
    canvas.setAttribute(
      'aria-label',
      'Interactive reference anatomy. Drag to rotate; scroll to zoom. Press Escape to clear the selection.',
    );
    host.appendChild(canvas);
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText =
      'display:none;position:absolute;pointer-events:none;padding:6px 10px;border:1px solid #6bbcff66;border-radius:8px;color:#e6f2ff;background:#0d2240f0;font:12px system-ui;z-index:2';
    host.appendChild(this.tooltip);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.16;
    this.controls.maxDistance = 5;
    this.controls.maxPolarAngle = Math.PI * 0.95;
    this.controls.enabled = options.interactive !== false;
    this.scene.add(new THREE.HemisphereLight(0xbcdcff, 0x0a1330, 2));
    const lights: [number[], number, number][] = [
      [[-2, 3, 3], 0xb9dcff, 3],
      [[2, 2, -2], 0x347bff, 5],
      [[2, 1, 3], 0x6abaff, 1.5],
    ];
    for (const [p, c, intensity] of lights) {
      const l = new THREE.DirectionalLight(c, intensity);
      l.position.set(p[0], p[1], p[2]);
      this.scene.add(l);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.382, 128),
      new THREE.MeshBasicMaterial({
        color: 0x6bbcff,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.01;
    this.scene.add(ring);
    this.reset();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    canvas.addEventListener('keydown', this.keyDown);
    this.animate();
    void this.loadSex(options.sex ?? 'male');
  }

  private animate = () => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    if (this.model && !this.reduceMotion) {
      if (this.rotation) this.model.rotation.y += dt * 0.16;
      // Calm idle motion: a slow breath and a gentle float.
      this.model.position.y = Math.sin(t * 0.9) * 0.008;
      this.model.scale.set(1 + Math.sin(t * 1.4) * 0.004, 1, 1 + Math.sin(t * 1.4) * 0.006);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.animate);
  };

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  async loadSex(sex: Sex): Promise<void> {
    const token = ++this.request;
    try {
      const url = `${this.options.modelBaseUrl.replace(/\/$/, '')}/${sex}.glb`;
      const gltf = await this.loader.loadAsync(url);
      if (this.disposed || token !== this.request) {
        this.release(gltf.scene);
        return;
      }
      if (this.model) {
        this.scene.remove(this.model);
        this.release(this.model);
      }
      this.model = gltf.scene;
      this.meshes = [];
      this.originals.clear();
      this.selected = null;
      this.model.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const id = String(o.userData.organId ?? o.name.toLowerCase());
        o.userData.organId = id;
        const source = (
          Array.isArray(o.material) ? o.material[0] : o.material
        ) as THREE.MeshStandardMaterial;
        const material = new THREE.MeshPhysicalMaterial({
          color: source.color.clone(),
          roughness: 0.3,
          metalness: 0.18,
          clearcoat: 0.55,
          clearcoatRoughness: 0.25,
          side: THREE.DoubleSide,
        });
        const opacity = id === 'skin' ? 0.17 : id.startsWith('lung') ? 0.48 : 1;
        material.opacity = opacity;
        material.transparent = opacity < 1;
        material.depthWrite = opacity === 1;
        material.emissive.copy(source.color);
        material.emissiveIntensity = 0.08;
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
        o.material = material;
        o.renderOrder = id === 'skin' ? 4 : opacity < 1 ? 2 : 0;
        this.originals.set(o, { color: material.color.clone(), opacity });
        this.meshes.push(o);
      });
      this.scene.add(this.model);
      this.applyLayer();
      this.reset();
      this.options.onSelect?.(null);
      this.options.onLoad?.(
        sex,
        this.meshes
          .map((m) => organs[m.userData.organId as string])
          .filter((x): x is OrganInfo => !!x),
      );
    } catch (e) {
      if (token === this.request && !this.disposed)
        this.options.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  selectOrgan(id: string | null, notify = true): void {
    if (id && !this.meshes.some((m) => m.userData.organId === id)) return;
    this.selected = id;
    this.applyLayer();
    if (notify) this.options.onSelect?.(id ? (organs[id] ?? null) : null);
  }

  setLayer(layer: Layer): void {
    this.layer = layer;
    this.applyLayer();
  }

  setAutoRotate(enabled: boolean): void {
    this.rotation = enabled;
  }

  /** Colour organs by status: organ id → hex colour (organs not listed keep their own). */
  setTint(tint: Record<string, string>): void {
    this.tint = tint;
    this.applyLayer();
  }

  private applyLayer() {
    for (const mesh of this.meshes) {
      const id = mesh.userData.organId as string;
      const skin = id === 'skin';
      const layer = this.layer;
      mesh.visible =
        layer === 'surface'
          ? skin
          : layer === 'organs'
            ? !skin
            : layer === 'bones'
              ? skin || BONES.includes(id)
              : true;
      if (layer === 'muscles') mesh.visible = skin || id === 'muscles';
      if (layer === 'nervous') mesh.visible = skin || ['brain', 'eyes', 'spinal_cord'].includes(id);
      if (layer === 'circulatory') mesh.visible = skin || ['heart', 'blood_vessels'].includes(id);
      if (this.selected === id) mesh.visible = true;
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      const original = this.originals.get(mesh)!;
      const selected = this.selected === id;
      const tint = this.tint[id];
      material.color.copy(original.color);
      if (tint && !skin) material.color.set(tint);
      material.opacity = layer === 'surface' ? 0.95 : original.opacity;
      if (layer === 'bones' && skin) material.opacity = 0.07;
      if (['muscles', 'nervous', 'circulatory'].includes(layer) && skin) material.opacity = 0.07;
      if (this.selected) material.opacity = selected ? 1 : skin ? 0.035 : 0.09;
      material.emissiveIntensity = selected ? 0.6 : tint && !skin ? 0.35 : 0.08;
      material.emissive.set(selected ? 0x3197da : tint && !skin ? tint : original.color);
      material.transparent = material.opacity < 1;
      material.depthWrite = material.opacity >= 1;
      material.needsUpdate = true;
    }
  }

  focusSelected(): void {
    const part = this.meshes.find((m) => m.userData.organId === this.selected);
    if (!part) return;
    this.model?.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(part);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(0.06, 0.015, Math.max(0.24, size * 2)));
    this.controls.update();
  }

  reset(): void {
    if (this.model) this.model.rotation.y = 0;
    if (this.options.framing === 'torso') {
      this.camera.position.set(0.06, 1.12, 2.1);
      this.controls.target.set(0, 1.0, 0);
    } else {
      this.camera.position.set(0.08, 0.9, 3.45);
      this.controls.target.set(0, 0.86, 0);
    }
    this.controls.update();
  }

  private hit(e: PointerEvent): THREE.Mesh | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const candidates = this.meshes.filter(
      (m) => m.visible && (this.layer === 'surface' || m.userData.organId !== 'skin'),
    );
    return this.ray.intersectObjects(candidates, false)[0]?.object as THREE.Mesh | undefined;
  }

  private pointerDown = (e: PointerEvent) => this.down.set(e.clientX, e.clientY);
  private pointerUp = (e: PointerEvent) => {
    if (this.options.interactive === false) return;
    if (this.down.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) < 5)
      this.selectOrgan((this.hit(e)?.userData.organId as string | undefined) ?? null);
  };
  private pointerMove = (e: PointerEvent) => {
    if (this.options.interactive === false || e.buttons) {
      this.tooltip.style.display = 'none';
      return;
    }
    const hit = this.hit(e);
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    if (!hit) {
      this.tooltip.style.display = 'none';
      return;
    }
    const r = this.host.getBoundingClientRect();
    this.tooltip.textContent = organs[hit.userData.organId as string]?.label ?? hit.name;
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${Math.min(e.clientX - r.left + 16, r.width - 160)}px`;
    this.tooltip.style.top = `${e.clientY - r.top + 12}px`;
  };
  private pointerLeave = () => {
    this.tooltip.style.display = 'none';
  };
  private keyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.selectOrgan(null);
    if (e.key.toLowerCase() === 'r') this.reset();
  };

  private release(root: THREE.Object3D) {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) =>
          m.dispose(),
        );
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    ++this.request;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    const c = this.renderer.domElement;
    c.removeEventListener('pointerdown', this.pointerDown);
    c.removeEventListener('pointerup', this.pointerUp);
    c.removeEventListener('pointermove', this.pointerMove);
    c.removeEventListener('pointerleave', this.pointerLeave);
    c.removeEventListener('keydown', this.keyDown);
    this.release(this.scene);
    this.renderer.dispose();
    c.remove();
    this.tooltip.remove();
  }
}
