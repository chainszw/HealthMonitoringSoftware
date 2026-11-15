import { lazy } from 'react';

/** The 3D anatomy stage, loaded on demand (it pulls in three.js and a ~10 MB model). */
export const LazyAnatomyStage = lazy(() =>
  import('./AnatomyStage').then((m) => ({ default: m.AnatomyStage })),
);
