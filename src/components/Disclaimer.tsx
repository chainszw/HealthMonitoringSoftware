import { content } from '../data/content';

/** Shown on every page. Text lives in content.json (`disclaimer`). */
export function Disclaimer() {
  return (
    <p role="note" className="text-xs text-slate-400">
      ⚠️ {content.disclaimer}
    </p>
  );
}
