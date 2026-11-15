import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { StartScreen } from './components/StartScreen';
import { useStart } from './components/startGate';
import { Body } from './pages/Body';
import { Dashboard } from './pages/Dashboard';
import { Log } from './pages/Log';
import { Routine } from './pages/Routine';
import { Sources } from './pages/Sources';

// Trends pulls in Recharts (~400 kB), so it is loaded on demand.
const Trends = lazy(() => import('./pages/Trends').then((m) => ({ default: m.Trends })));
// The ZOĒ device bundles three.js (3D), so it is loaded only when opened.
const Zoe = lazy(() => import('./pages/Zoe').then((m) => ({ default: m.Zoe })));
// Earth-side console; only used with the sync server.
const Surgeon = lazy(() => import('./pages/Surgeon').then((m) => ({ default: m.Surgeon })));

/** The start screen comes first on every load; then the app. */
function Gate() {
  const { open } = useStart();
  if (open) return <StartScreen />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="zoe" element={<Zoe />} />
        <Route path="log" element={<Log />} />
        <Route path="body" element={<Body />} />
        <Route path="trends" element={<Trends />} />
        <Route path="routine" element={<Routine />} />
        <Route path="sources" element={<Sources />} />
        <Route path="surgeon" element={<Surgeon />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Gate />
    </BrowserRouter>
  );
}
