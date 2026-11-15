import { useEffect, useRef, useState } from 'react';
import { BACKDROP_LABELS, BACKDROP_VARIANTS, type BackdropVariant } from './backdrop/variants';
import { IconSliders } from './icons';

// Owner B: dev settings for the team (not crew-facing). Shown in `npm run dev` or with `?dev`
// in the URL. Choices are saved on this device only (`chc:v1:dev`), never synced.

export function DevPanel({
  backdrop,
  onBackdropChange,
}: {
  backdrop: BackdropVariant;
  onBackdropChange: (variant: BackdropVariant) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div
          role="dialog"
          aria-label="Dev settings"
          className="flex w-[280px] max-w-[calc(100vw-32px)] flex-col gap-3 rounded-[16px] border border-line-2 bg-raised p-4 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-medium text-ink">Dev settings</span>
            <span className="text-[12px] text-faint">this device only</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-muted">Background</span>
            <div className="inline-flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
              {BACKDROP_VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={backdrop === v}
                  onClick={() => onBackdropChange(v)}
                  className="h-8 flex-1 cursor-pointer rounded-md px-2 text-[13px] whitespace-nowrap font-medium text-muted transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg"
                >
                  {BACKDROP_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label="Dev settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line-2 bg-raised/80 text-muted backdrop-blur-sm transition-colors hover:text-ink aria-expanded:text-ink"
      >
        <IconSliders size={18} />
      </button>
    </div>
  );
}
