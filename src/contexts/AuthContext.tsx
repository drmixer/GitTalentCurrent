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
  const [developerProfile, setDeveloperProfile] = useState<Developer | null>(null);

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
        
        setSession(session);
        setUser(session?.user ?? null);
        setAuthError(null);
        
        if (session?.user) {
          if (event === 'SIGNED_IN') {
            if (session.user.app_metadata?.provider === 'github') {
              await handleGitHubSignIn(session.user);
            } else {
              await fetchUserProfile(session.user);
            }
          } else {
            await fetchUserProfile(session.user);
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

  const fetchUserProfile = async (user: SupabaseUser) => {
    try {
      console.log('🔄 AuthProvider: Fetching user profile for:', user.id);
      
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error fetching user profile:', error);
        setAuthError(error.message);
        setLoading(false);
        return;
      }

      console.log('✅ AuthProvider: User profile fetched:', profile);
      setUserProfile(profile);

      // If user is a developer, fetch developer profile
      if (profile?.role === 'developer') {
        await fetchDeveloperProfile(user.id);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error fetching user profile:', error);
      setAuthError('Failed to fetch user profile');
      setLoading(false);
    }
  };

  const fetchDeveloperProfile = async (userId: string) => {
    try {
      const { data: devProfile, error } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ AuthProvider: Error fetching developer profile:', error);
        return;
      }

      if (devProfile) {
        console.log('✅ AuthProvider: Developer profile fetched:', devProfile);
        setDeveloperProfile(devProfile);
      }
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error fetching developer profile:', error);
    }
  };

  const handleGitHubSignIn = async (user: SupabaseUser) => {
    try {
      console.log('🔄 AuthProvider: Handling GitHub sign in for:', user.id);
      
      // Check if user profile exists
      const { data: existingProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        // Create user profile for GitHub user
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.full_name || user.user_metadata?.name || 'GitHub User',
            role: 'developer',
            is_approved: true
          });

        if (profileError) {
          console.error('❌ AuthProvider: Error creating GitHub user profile:', profileError);
          setAuthError(profileError.message);
          setLoading(false);
          return;
        }
      }

      await fetchUserProfile(user);
    } catch (error) {
      console.error('❌ AuthProvider: Error handling GitHub sign in:', error);
      setAuthError('Failed to complete GitHub sign in');
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: 'developer' | 'recruiter') => {
    try {
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing up user:', email, role);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role
          }
        }
      });

      if (error) {
        console.error('❌ AuthProvider: Sign up error:', error);
        setAuthError(error.message);
        return { error };
      }

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email,
            name,
            role,
            is_approved: role === 'developer' // Auto-approve developers
          });

        if (profileError) {
          console.error('❌ AuthProvider: Error creating user profile:', profileError);
          setAuthError(profileError.message);
          return { error: profileError };
        }

        console.log('✅ AuthProvider: User signed up successfully');
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected sign up error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing in user:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ AuthProvider: Sign in error:', error);
        setAuthError(error.message);
        return { error };
      }

      console.log('✅ AuthProvider: User signed in successfully');
      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signInWithGitHub = async () => {
    try {
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing in with GitHub');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('❌ AuthProvider: GitHub sign in error:', error);
        setAuthError(error.message);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected GitHub sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signInWithGitHubApp = async () => {
    try {
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing in with GitHub App');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/github-app-setup`,
          scopes: 'read:user user:email'
        }
      });

      if (error) {
        console.error('❌ AuthProvider: GitHub App sign in error:', error);
        setAuthError(error.message);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected GitHub App sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signOut = async () => {
    try {
      setSigningOut(true);
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing out user');

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('❌ AuthProvider: Sign out error:', error);
        setAuthError(error.message);
        return { error };
      }

      setUser(null);
      setSession(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      console.log('✅ AuthProvider: User signed out successfully');
      return { error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected sign out error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    } finally {
      setSigningOut(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  };

  const createDeveloperProfile = async (profileData: Partial<Developer>) => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('developers')
        .insert({
          user_id: user.id,
          ...profileData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error creating developer profile:', error);
        return { error };
      }

      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error creating developer profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const updateDeveloperProfile = async (profileData: Partial<Developer>) => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('developers')
        .update(profileData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error updating developer profile:', error);
        return { error };
      }

      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error updating developer profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const createJobRole = async (jobData: Partial<JobRole>) => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('job_roles')
        .insert({
          recruiter_id: user.id,
          ...jobData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error creating job role:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error creating job role:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const updateJobRole = async (jobId: string, jobData: Partial<JobRole>) => {
    try {
      const { data, error } = await supabase
        .from('job_roles')
        .update(jobData)
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error updating job role:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error updating job role:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const createAssignment = async (assignmentData: Partial<Assignment>) => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('assignments')
        .insert({
          assigned_by: user.id,
          ...assignmentData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error creating assignment:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error creating assignment:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const createHire = async (hireData: Partial<Hire>) => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('hires')
        .insert({
          marked_by: user.id,
          ...hireData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error creating hire:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error creating hire:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ is_approved: isApproved })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error updating user approval status:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error updating user approval status:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const updateProfileStrength = async (userId: string, strength: number) => {
    try {
      const { data, error } = await supabase
        .from('developers')
        .update({ profile_strength: strength })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error updating profile strength:', error);
        return { error };
      }

      if (userId === user?.id) {
        setDeveloperProfile(data);
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error updating profile strength:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const value = {
    user,
    session,
    userProfile,
    developerProfile,
    loading,
    signingOut,
    authError,
    signUp,
    signIn,
    signInWithGitHub,
    signInWithGitHubApp,
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