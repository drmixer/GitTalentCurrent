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

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 fetchUserProfile: Fetching profile for user:', authUser.id);
      
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('❌ fetchUserProfile: Error fetching user profile:', error);
        setAuthError('Failed to load your profile. Please try again.');
        setLoading(false);
        return null;
      }

      console.log('✅ fetchUserProfile: User profile fetched:', profile);
      setUserProfile(profile);

      if (profile.role === 'developer') {
        await fetchDeveloperProfile(authUser.id);
      }

      setLoading(false);
      return profile;
    } catch (error) {
      console.error('❌ fetchUserProfile: Unexpected error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
      setLoading(false);
      return null;
    }
  };

  const fetchDeveloperProfile = async (userId: string) => {
    try {
      console.log('🔄 fetchDeveloperProfile: Fetching developer profile for user:', userId);
      
      const { data: devProfile, error } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ fetchDeveloperProfile: Error fetching developer profile:', error);
        setDeveloperProfile(null);
        return;
      }

      console.log('✅ fetchDeveloperProfile: Developer profile fetched:', devProfile);
      setDeveloperProfile(devProfile || null);
    } catch (error) {
      console.error('❌ fetchDeveloperProfile: Unexpected error:', error);
      setDeveloperProfile(null);
    }
  };

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    console.log('🔄 handleGitHubSignIn: Processing GitHub sign-in for user:', authUser.id);
    
    try {
      const userProfile = await fetchUserProfile(authUser);
      
      if (!userProfile) {
        console.error('❌ handleGitHubSignIn: Failed to fetch user profile after GitHub sign in');
        setAuthError('Failed to load your profile. Please try again.');
      } else {
        console.log('✅ handleGitHubSignIn: User profile fetched successfully');
        
        if (userProfile.role === 'developer') {
          const { data: developerProfile, error: devError } = await supabase
            .from('developers')
            .select('*')
            .eq('user_id', authUser.id)
            .single();

          if (devError && devError.code !== 'PGRST116') {
            console.error('❌ handleGitHubSignIn: Error fetching developer profile:', devError);
          } else if (developerProfile) {
            console.log('✅ handleGitHubSignIn: Developer profile found');
            setDeveloperProfile(developerProfile);
          } else {
            console.log('🔄 handleGitHubSignIn: No developer profile found, will need onboarding');
            setDeveloperProfile(null);
          }
        }
      }
    } catch (error) {
      console.error('❌ handleGitHubSignIn: Unexpected error:', error);
      setAuthError('An unexpected error occurred during GitHub sign-in. Please try again.');
    }
  };

  const signUp = async (email: string, password: string, role: 'developer' | 'recruiter', additionalData?: any) => {
    try {
      setAuthError(null);
      console.log('🔄 signUp: Attempting to sign up user with role:', role);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            ...additionalData
          }
        }
      });

      if (error) {
        console.error('❌ signUp: Error during sign up:', error);
        setAuthError(error.message);
        return { user: null, error };
      }

      console.log('✅ signUp: User signed up successfully:', data.user?.id);
      return { user: data.user, error: null };
    } catch (error: any) {
      console.error('❌ signUp: Unexpected error:', error);
      setAuthError('An unexpected error occurred during sign up. Please try again.');
      return { user: null, error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setAuthError(null);
      console.log('🔄 signIn: Attempting to sign in user');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ signIn: Error during sign in:', error);
        setAuthError(error.message);
        return { user: null, error };
      }

      console.log('✅ signIn: User signed in successfully:', data.user?.id);
      return { user: data.user, error: null };
    } catch (error: any) {
      console.error('❌ signIn: Unexpected error:', error);
      setAuthError('An unexpected error occurred during sign in. Please try again.');
      return { user: null, error };
    }
  };

  const signInWithGitHub = async () => {
    try {
      setAuthError(null);
      console.log('🔄 signInWithGitHub: Attempting GitHub sign in');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('❌ signInWithGitHub: Error during GitHub sign in:', error);
        setAuthError(error.message);
        return { error };
      }

      console.log('✅ signInWithGitHub: GitHub sign in initiated');
      return { error: null };
    } catch (error: any) {
      console.error('❌ signInWithGitHub: Unexpected error:', error);
      setAuthError('An unexpected error occurred during GitHub sign in. Please try again.');
      return { error };
    }
  };

  const connectGitHubApp = async () => {
    try {
      console.log('🔄 connectGitHubApp: Initiating GitHub App connection');
      
      if (!user) {
        throw new Error('User must be authenticated to connect GitHub App');
      }

      const githubAppUrl = `https://github.com/apps/devhire-talent-scout/installations/new?state=${encodeURIComponent(JSON.stringify({ user_id: user.id }))}`;
      
      console.log('🔄 connectGitHubApp: Redirecting to GitHub App installation:', githubAppUrl);
      window.location.href = githubAppUrl;
      
      return { error: null };
    } catch (error: any) {
      console.error('❌ connectGitHubApp: Error:', error);
      setAuthError('Failed to connect GitHub App. Please try again.');
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setSigningOut(true);
      console.log('🔄 signOut: Attempting to sign out user');

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('❌ signOut: Error during sign out:', error);
        setAuthError(error.message);
        return { error };
      }

      console.log('✅ signOut: User signed out successfully');
      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setAuthError(null);
      return { error: null };
    } catch (error: any) {
      console.error('❌ signOut: Unexpected error:', error);
      setAuthError('An unexpected error occurred during sign out. Please try again.');
      return { error };
    } finally {
      setSigningOut(false);
    }
  };

  const createDeveloperProfile = async (profileData: Partial<Developer>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create developer profile');
      }

      console.log('🔄 createDeveloperProfile: Creating developer profile for user:', user.id);

      const { data, error } = await supabase
        .from('developers')
        .insert([{
          user_id: user.id,
          ...profileData
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ createDeveloperProfile: Error creating developer profile:', error);
        throw error;
      }

      console.log('✅ createDeveloperProfile: Developer profile created successfully');
      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ createDeveloperProfile: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const updateDeveloperProfile = async (updates: Partial<Developer>) => {
    try {
      if (!user || !developerProfile) {
        throw new Error('User and developer profile must exist to update');
      }

      console.log('🔄 updateDeveloperProfile: Updating developer profile for user:', user.id);

      const { data, error } = await supabase
        .from('developers')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ updateDeveloperProfile: Error updating developer profile:', error);
        throw error;
      }

      console.log('✅ updateDeveloperProfile: Developer profile updated successfully');
      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ updateDeveloperProfile: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const createJobRole = async (jobData: Partial<JobRole>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create job role');
      }

      console.log('🔄 createJobRole: Creating job role for user:', user.id);

      const { data, error } = await supabase
        .from('job_roles')
        .insert([{
          recruiter_id: user.id,
          ...jobData
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ createJobRole: Error creating job role:', error);
        throw error;
      }

      console.log('✅ createJobRole: Job role created successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ createJobRole: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const updateJobRole = async (jobId: string, updates: Partial<JobRole>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update job role');
      }

      console.log('🔄 updateJobRole: Updating job role:', jobId);

      const { data, error } = await supabase
        .from('job_roles')
        .update(updates)
        .eq('id', jobId)
        .eq('recruiter_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ updateJobRole: Error updating job role:', error);
        throw error;
      }

      console.log('✅ updateJobRole: Job role updated successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ updateJobRole: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const createAssignment = async (assignmentData: Partial<Assignment>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create assignment');
      }

      console.log('🔄 createAssignment: Creating assignment for user:', user.id);

      const { data, error } = await supabase
        .from('assignments')
        .insert([{
          assigned_by: user.id,
          ...assignmentData
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ createAssignment: Error creating assignment:', error);
        throw error;
      }

      console.log('✅ createAssignment: Assignment created successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ createAssignment: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const createHire = async (hireData: Partial<Hire>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create hire');
      }

      console.log('🔄 createHire: Creating hire for user:', user.id);

      const { data, error } = await supabase
        .from('hires')
        .insert([{
          marked_by: user.id,
          ...hireData
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ createHire: Error creating hire:', error);
        throw error;
      }

      console.log('✅ createHire: Hire created successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ createHire: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update approval status');
      }

      console.log('🔄 updateUserApprovalStatus: Updating approval status for user:', userId);

      const { data, error } = await supabase
        .from('users')
        .update({ is_approved: isApproved })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ updateUserApprovalStatus: Error updating approval status:', error);
        throw error;
      }

      console.log('✅ updateUserApprovalStatus: Approval status updated successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ updateUserApprovalStatus: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const updateProfileStrength = async (strength: number) => {
    try {
      if (!user || !developerProfile) {
        throw new Error('User and developer profile must exist to update profile strength');
      }

      console.log('🔄 updateProfileStrength: Updating profile strength for user:', user.id);

      const { data, error } = await supabase
        .from('developers')
        .update({ profile_strength: strength })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ updateProfileStrength: Error updating profile strength:', error);
        throw error;
      }

      console.log('✅ updateProfileStrength: Profile strength updated successfully');
      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ updateProfileStrength: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const refreshProfile = async () => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to refresh profile');
      }

      console.log('🔄 refreshProfile: Refreshing profile for user:', user.id);
      await fetchUserProfile(user);
      return { error: null };
    } catch (error: any) {
      console.error('❌ refreshProfile: Unexpected error:', error);
      return { error };
    }
  };

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