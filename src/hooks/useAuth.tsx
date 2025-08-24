import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext.tsx';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  // Add debugging for GitHub auth issues
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 useAuth Debug Info:', {
      hasUser: !!context.user,
      userId: context.user?.id,
      hasUserProfile: !!context.userProfile,
      hasDeveloperProfile: !!context.developerProfile,
      githubHandle: context.developerProfile?.github_handle || context.user?.user_metadata?.login,
      installationId: context.developerProfile?.github_installation_id || context.user?.user_metadata?.github_installation_id,
      loading: context.loading,
      authError: context.authError
    });
  }
  
  return context;
};

export { AuthProvider } from '../contexts/AuthContext.tsx';
