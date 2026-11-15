import { useEffect, useRef, useState } from 'react';
import { AnatomyViewer } from './AnatomyViewer';
import type { Layer, OrganInfo, Sex } from './organs';

// Owner B: React wrapper for the 3D anatomy viewer (models in public/models, loaded locally).
// Lazy-loaded through `./lazy` so three.js only loads where the body is shown.

export interface AnatomyStageProps {
  sex?: Sex;
  layer?: Layer;
  autoRotate?: boolean;
  interactive?: boolean;
  framing?: 'full' | 'torso';
  /** organ id → hex colour (status tint). */
  tint?: Record<string, string>;
  /** Organ to highlight (controlled). */
  selected?: string | null;
  onSelect?: (organ: OrganInfo | null) => void;
  className?: string;
}

const MODEL_BASE = `${import.meta.env.BASE_URL}models`;

export function AnatomyStage({
  sex = 'male',
  layer = 'xray',
  autoRotate = false,
  interactive = true,
  framing = 'full',
  tint,
  selected,
  onSelect,
  className,
}: AnatomyStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<AnatomyViewer | null>(null);
  const onSelectRef = useRef(onSelect);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create once; options that change later are applied by the effects below.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let v: AnatomyViewer;
    try {
      v = new AnatomyViewer(host, {
        modelBaseUrl: MODEL_BASE,
        sex,
        layer,
        autoRotate,
        interactive,
        framing,
        onSelect: (o) => onSelectRef.current?.(o),
        onLoad: () => setState('ready'),
        onError: () => setState('error'),
      });
    } catch {
      queueMicrotask(() => setState('error'));
      return;
    }
    viewer.current = v;
    return () => {
      v.dispose();
      viewer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void viewer.current?.loadSex(sex);
  }, [sex]);
  useEffect(() => viewer.current?.setLayer(layer), [layer, state]);
  useEffect(() => viewer.current?.setAutoRotate(autoRotate), [autoRotate]);
  useEffect(() => viewer.current?.setTint(tint ?? {}), [tint, state]);
  useEffect(() => {
    if (selected === undefined) return;
    viewer.current?.selectOrgan(selected, false);
  }, [selected, state]);

  return (
    <div className={className || 'relative size-full'}>
      <div ref={hostRef} className="absolute inset-0" />
      {state !== 'ready' && (
        <p className="pointer-events-none absolute inset-0 m-0 flex items-center justify-center text-[13px] text-muted">
          {state === 'loading'
            ? 'Loading the 3D body…'
            : 'This browser could not show the 3D body.'}
        </p>
      )}
    </div>
  );
}
