import { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, Developer, JobRole, Assignment, Hire, AuthContextType } from '../types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [developerProfile, setDeveloperProfile] = useState<Developer | null | undefined>(null);

  useEffect(() => {
    console.log('🔄 AuthProvider: Initializing auth state...');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔄 AuthProvider: Initial session:', session ? 'Found' : 'None');
      setSession(session);
      setUser(session?.user ?? null);
      setAuthError(null);
      
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 AuthProvider: Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        // Check for GitHub installation_id in URL state parameter
        try {
          const url = new URL(window.location.href);
          const stateParam = url.searchParams.get('state');
          
          if (stateParam && session?.user) {
            try {
              const stateObj = JSON.parse(stateParam);
              if (stateObj.installation_id) {
                console.log('🔄 AuthProvider: Found installation_id in state param:', stateObj.installation_id);
                
                // Only inject if not already present
                if (!session.user.user_metadata?.app_installation_id) {
                  console.log('🔄 AuthProvider: Injecting installation_id into user metadata');
                  // We can't directly modify user metadata, but we'll use it in our profile update
                }
              }
            } catch (e) {
              console.log('🔄 AuthProvider: Error parsing state param:', e);
            }
          }
        } catch (e) {
          console.log('🔄 AuthProvider: Error processing URL params:', e);
        }
        
        setSession(session);
        const newUser = session?.user ?? null;
        setUser(newUser);
        setAuthError(null);
        
        if (newUser) {
          if (event === 'SIGNED_IN') {
            if (newUser.app_metadata?.provider === 'github') {
              await handleGitHubSignIn(newUser);
            } else {
              await fetchUserProfile(newUser);
            }
          } else {
            await fetchUserProfile(newUser);
          }
        } else {
          setUserProfile(null);
          setDeveloperProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      console.log('🔄 AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  // ... rest of the code remains the same ...

  const value = {
    user,
    session,
    userProfile,
    developerProfile,
    loading,
    authError,
    signingOut,
    signUp,
    signIn,
    signInWithGitHub,
    connectGitHubApp,
    signOut,
    createDeveloperProfile,
    updateDeveloperProfile,
    createJobRole,
    updateJobRole,
    createAssignment,
    createHire,
    updateUserApprovalStatus,
    updateProfileStrength,
    refreshProfile,
    needsOnboarding: !developerProfile && userProfile?.role === 'developer'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};