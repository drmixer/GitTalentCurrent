import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext.tsx';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthProvider } from '../contexts/AuthContext.tsx';