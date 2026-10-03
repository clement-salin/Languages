import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { lastLang, lastPath } from './language';
import { ConjugationPage } from './pages/de/ConjugationPage';
import { ExpressionsPage } from './pages/en/ExpressionsPage';
import { PhrasalPage } from './pages/en/PhrasalPage';
import { SettingsPage } from './pages/SettingsPage';

/** L'accueil ramène à la dernière langue ouverte, là où on l'avait laissée. */
function Home() {
  return <Navigate to={lastPath(lastLang())} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'de', element: <ConjugationPage /> },
      { path: 'de/:verbId', element: <ConjugationPage /> },
      { path: 'en', element: <PhrasalPage /> },
      { path: 'en/expressions', element: <ExpressionsPage /> },
      { path: 'en/:mode/:key', element: <PhrasalPage /> },
      { path: 'reglages', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
