import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';
import { GitHubProvider } from './hooks/useGitHub.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <GitHubProvider>
        <App />
      </GitHubProvider>
    </BrowserRouter>
  </StrictMode>
);