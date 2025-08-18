import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.tsx';
import ScrollToTop from './components/ScrollToTop.tsx';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { GitHubProvider } from './hooks/useGitHub.tsx'; // Ensured only one import
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <HelmetProvider>
        {/* Default site-wide title, overridden by pages that set their own */}
        <Helmet>
          <title>GitTalent - Connecting Devs and Recruiters</title>
        </Helmet>
        <ScrollToTop />
        <AuthProvider>
          <App />
        </AuthProvider>
      </HelmetProvider>
    </BrowserRouter>
  </StrictMode>
);
