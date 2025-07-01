import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { GitHubProvider } from './hooks/useGitHub.tsx';
import { initializeStorage } from './lib/supabase.ts';
import './index.css';

// Initialize Supabase storage buckets
initializeStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GitHubProvider>
          <App />
        </GitHubProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);