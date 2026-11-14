import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Body } from './pages/Body';
import { Dashboard } from './pages/Dashboard';
import { Log } from './pages/Log';

// Trends pulls in Recharts (~400 kB), so it is loaded on demand.
const Trends = lazy(() => import('./pages/Trends').then((m) => ({ default: m.Trends })));

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="log" element={<Log />} />
          <Route path="body" element={<Body />} />
          <Route path="trends" element={<Trends />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
