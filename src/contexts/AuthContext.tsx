import { createContext, useState, useEffect, ReactNode, useContext, useRef } from 'react';
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
  const prevSessionRef = useRef<Session | null>(null);
  const isProcessingAuthStateChangeRef = useRef(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [developerProfile, setDeveloperProfile] = useState<Developer | null | undefined>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Forward declare handleGitHubSignIn and fetchUserProfile if they are called by useEffect
  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    console.log(`🔄 handleGitHubSignIn: DEBUG - Processing for user ${authUser.id}. This function is currently a NO-OP for debugging.`);
    console.log(`🔄 handleGitHubSignIn: User metadata for ${authUser.id}:`, authUser.user_metadata);
    try {
      // Intentionally doing nothing here for this debug step except logging.
      console.log(`🔄 handleGitHubSignIn: DEBUG - Intentionally bypassing all profile logic.`);
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate minimal async work
      console.log(`🔄 handleGitHubSignIn: DEBUG - Minimal async work completed.`);
    } catch (error) {
      console.error(`❌ handleGitHubSignIn: DEBUG - Error in NO-OP version for user ${authUser.id}:`, error);
      setAuthError('An unexpected error occurred during sign in (debug HGS).');
    } finally {
      console.log(`🔄 handleGitHubSignIn: DEBUG - In finally block for user ${authUser.id}. Setting loading to false.`);
      setLoading(false);
      console.log(`🔄 handleGitHubSignIn: DEBUG - setLoading(false) called. Loading should be false.`);
    }
  };

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    console.log('🔄 fetchUserProfile: Fetching profile for user:', authUser.id);
    setAuthError(null);
    setLoading(true);
    try {
      console.log('🔄 fetchUserProfile: User metadata:', authUser.user_metadata);
      const { data: profile, error } = await supabase.from('users').select('*').eq('id', authUser.id).single();

      if (error && error.code === 'PGRST116') {
        console.log('🔄 fetchUserProfile: Profile not found, creating one');
        const userRole = localStorage.getItem('gittalent_signup_role') || authUser.user_metadata?.role || (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
        const userName = localStorage.getItem('gittalent_signup_name') || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.preferred_username || authUser.user_metadata?.user_name || 'GitHub User';
        const companyName = authUser.user_metadata?.company_name || 'Company';
        console.log('🔄 fetchUserProfile: Creating profile with role:', userRole, 'name:', userName);
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          'create_user_profile',
          { user_id: authUser.id, user_email: authUser.email || 'unknown@example.com', user_name: userName, user_role: userRole, company_name: companyName }
        );
        if (rpcError) {
          console.error('❌ fetchUserProfile: Error creating user profile via RPC:', rpcError);
          setAuthError('Failed to create your profile: ' + rpcError.message);
          return null;
        }
        console.log('✅ fetchUserProfile: Profile creation RPC result:', rpcResult);
        const { data: newProfile, error: fetchError } = await supabase.from('users').select('*').eq('id', authUser.id).single();
        if (fetchError) {
          console.error('❌ fetchUserProfile: Error fetching newly created profile:', fetchError);
          setAuthError('Failed to load your profile after creation');
          return null;
        }
        console.log('✅ fetchUserProfile: Newly created profile fetched:', newProfile);
        console.log(`🔄 fetchUserProfile: Calling setUserProfile for ${authUser.id} with newly created profile.`);
        setUserProfile(newProfile);
        console.log(`🔄 fetchUserProfile: setUserProfile call completed for ${authUser.id}.`);
        if (newProfile.role === 'developer') {
          console.log(`🔄 fetchUserProfile: User ${authUser.id} is a developer. Ensuring developer profile.`);
          await ensureDeveloperProfile(authUser);
        }
        return newProfile;
      } else if (error) {
        console.error(`❌ fetchUserProfile: Error fetching user profile for ${authUser.id}:`, error);
        setAuthError('Failed to load your profile. Please try again.');
        return null;
      }
      console.log(`✅ fetchUserProfile: User profile fetched for ${authUser.id}:`, profile);
      console.log(`🔄 fetchUserProfile: Calling setUserProfile for ${authUser.id} with existing profile.`);
      setUserProfile(profile);
      console.log(`🔄 fetchUserProfile: setUserProfile call completed for ${authUser.id}.`);
      if (profile.role === 'developer') {
        console.log(`🔄 fetchUserProfile: User ${authUser.id} is a developer. Fetching/Ensuring developer profile.`);
        const devProfile = await fetchDeveloperProfile(authUser.id);
        if (!devProfile) {
          console.log(`🔄 fetchUserProfile: Developer profile not found for ${authUser.id}, ensuring creation.`);
          await ensureDeveloperProfile(authUser);
        }
      }
      return profile;
    } catch (error) {
      console.error(`❌ fetchUserProfile: Unexpected error for user ${authUser.id}:`, error);
      setAuthError('An unexpected error occurred. Please try again.');
      return null;
    } finally {
      const finalUserProfile = userProfile;
      const finalDeveloperProfile = developerProfile;
      console.log(`🔄 fetchUserProfile: In finally block for user ${authUser.id}.`);
      console.log(`🔄 fetchUserProfile: UserProfile state before setLoading(false):`, finalUserProfile ? `Exists (ID: ${finalUserProfile.id})` : 'null');
      console.log(`🔄 fetchUserProfile: DeveloperProfile state before setLoading(false):`, finalDeveloperProfile ? `Exists (User ID: ${finalDeveloperProfile.user_id})` : 'null');
      console.log(`🔄 fetchUserProfile: Calling setLoading(false) for user ${authUser.id}.`);
      setLoading(false);
      console.log(`🔄 fetchUserProfile: setLoading(false) call completed for user ${authUser.id}. AuthContext loading state is now false.`);
    }
  }; 

  const ensureDeveloperProfile = async (authUser: SupabaseUser) => {
    console.log(`🔄 ensureDeveloperProfile: Attempting for user: ${authUser.id}`);
    try {
      const { data: existingProfile, error: checkError } = await supabase.from('developers').select('*').eq('user_id', authUser.id).maybeSingle();
      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`❌ ensureDeveloperProfile: Error checking for existing profile for user ${authUser.id}:`, checkError);
        return false;
      }
      if (existingProfile) {
        console.log(`✅ ensureDeveloperProfile: Developer profile already exists for user ${authUser.id}:`, existingProfile);
        console.log(`🔄 ensureDeveloperProfile: Calling setDeveloperProfile for user ${authUser.id} with existing dev profile.`);
        setDeveloperProfile(existingProfile);
        console.log(`🔄 ensureDeveloperProfile: setDeveloperProfile call completed for user ${authUser.id}.`);
        return true;
      }
      console.log(`🔄 ensureDeveloperProfile: No existing developer profile for user ${authUser.id}. Creating new one.`);
      const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || '';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const userBio = authUser.user_metadata?.bio || '';
      const userLocation = authUser.user_metadata?.location || '';
      const githubInstallationId = authUser.user_metadata?.installation_id || null;
      console.log(`🔄 ensureDeveloperProfile: Creating new developer profile for user ${authUser.id} with GitHub handle: ${githubUsername}`);
      const { data: newDevProfileData, error: createError } = await supabase
        .from('developers')
        .insert({
          user_id: authUser.id, github_handle: githubUsername, bio: userBio, location: userLocation,
          profile_pic_url: avatarUrl, github_installation_id: githubInstallationId, availability: true
        })
        .select().single();
      if (createError) {
        console.error(`❌ ensureDeveloperProfile: Error creating developer profile for user ${authUser.id}:`, createError);
        return false;
      }
      if (!newDevProfileData) {
        console.error(`❌ ensureDeveloperProfile: Developer profile creation seemed to succeed for user ${authUser.id} but no data returned.`);
        return false;
      }
      console.log(`✅ ensureDeveloperProfile: Developer profile created for user ${authUser.id}:`, newDevProfileData);
      console.log(`🔄 ensureDeveloperProfile: Calling setDeveloperProfile for user ${authUser.id} with new dev profile.`);
      setDeveloperProfile(newDevProfileData);
      console.log(`🔄 ensureDeveloperProfile: setDeveloperProfile call completed for user ${authUser.id}.`);
      return true;
    } catch (error) {
      console.error(`❌ ensureDeveloperProfile: Unexpected error for user ${authUser.id}:`, error);
      return false;
    }
  };

  const fetchDeveloperProfile = async (userId: string) => {
    console.log(`🔄 fetchDeveloperProfile: Attempting for user: ${userId}`);
    try {
      const { data: devProfile, error } = await supabase.from('developers').select('*').eq('user_id', userId).single();
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`🤷 fetchDeveloperProfile: No developer profile found for user ${userId}.`);
          console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile(null) for user ${userId}.`);
          setDeveloperProfile(null);
          console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile(null) call completed for user ${userId}.`);
          return null;
        } else {
          console.error(`❌ fetchDeveloperProfile: Error fetching developer profile for user ${userId}:`, error.message);
          console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile(null) due to error for user ${userId}.`);
          setDeveloperProfile(null);
          console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile(null) call completed for user ${userId}.`);
          return null;
        }
      }
      console.log(`✅ fetchDeveloperProfile: Developer profile fetched for user ${userId}:`, devProfile);
      console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile for user ${userId}.`);
      setDeveloperProfile(devProfile);
      console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile call completed for user ${userId}.`);
      return devProfile;
    } catch (error) {
      console.error(`❌ fetchDeveloperProfile: Unexpected error for user ${userId}:`, error instanceof Error ? error.message : error);
      console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile(null) due to unexpected error for user ${userId}.`);
      setDeveloperProfile(null);
      console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile(null) call completed for user ${userId}.`);
      return null;
    }
  };

  useEffect(() => {
    console.log('🔄 AuthProvider: Initializing auth state...');
    prevSessionRef.current = null;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log('🔄 AuthProvider: Current session from getSession():', currentSession ? 'Found' : 'None');
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (!currentSession?.user) {
        setLoading(false);
      }
    }).catch(error => {
      console.error('❌ AuthProvider: Error in getSession():', error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`🔄 AuthProvider: Auth state changed: ${event}`, newSession ? `Session for user ${newSession.user?.id}` : 'No session');

      if (isProcessingAuthStateChangeRef.current) {
        console.log('🔄 AuthProvider: Auth state change event ignored, already processing.');
        return;
      }

      const prevSessionStr = JSON.stringify(prevSessionRef.current);
      const newSessionStr = JSON.stringify(newSession);

      if (prevSessionStr === newSessionStr && event !== 'INITIAL_SESSION' && prevSessionRef.current !== null) {
        console.log('🔄 AuthProvider: Session unchanged and not initial, skipping update. Current loading state:', loading);
        if (!newSession?.user && !user && loading) {
            setLoading(false);
        }
        return;
      }

      isProcessingAuthStateChangeRef.current = true;
      console.log('🔄 AuthProvider: Processing auth state change.');

      try {
        prevSessionRef.current = newSession;
        const NUser = newSession?.user ?? null;
        setSession(newSession);
        setUser(NUser);
        setAuthError(null);

        if (NUser) {
          console.log(`🔄 AuthProvider: User ${NUser.id} detected. Event: ${event}. Setting loading true.`);
          setLoading(true);

          if (event === 'SIGNED_IN') {
            if (NUser.app_metadata?.provider === 'github') {
              console.log('🔄 AuthProvider: GitHub sign-in detected, handling GitHub auth');
              await handleGitHubSignIn(NUser);
            } else {
              console.log('🔄 AuthProvider: Non-GitHub sign-in detected, fetching profile');
              await fetchUserProfile(NUser);
            }
          } else if (event === 'INITIAL_SESSION' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
            console.log(`🔄 AuthProvider: Event ${event} for user ${NUser.id}, fetching profile`);
            await fetchUserProfile(NUser);
          } else if (event === 'SIGNED_OUT') {
            console.log('🔄 AuthProvider: SIGNED_OUT event explicitly handled, clearing profiles');
            setUserProfile(null);
            setDeveloperProfile(null);
            setLoading(false);
          } else {
            console.log(`🔄 AuthProvider: Unhandled event type ${event} with user, fetching profile.`);
            await fetchUserProfile(NUser);
          }
        } else {
          console.log('🔄 AuthProvider: No user after auth state change, clearing profiles. Event:', event);
          setUserProfile(null);
          setDeveloperProfile(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ AuthProvider: Error in onAuthStateChange handler:', error);
        setAuthError(error instanceof Error ? error.message : 'An unexpected error occurred in auth state handler.');
        setLoading(false);
      } finally {
        isProcessingAuthStateChangeRef.current = false;
        console.log('🔄 AuthProvider: Finished processing auth state change. Current loading state:', loading);
      }
    });

    return () => {
      console.log('🔄 AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []); // This useEffect should only have handleGitHubSignIn and fetchUserProfile in its dep array if they are stable useCallback refs.
           // For now, assuming they are stable or defined outside/above this AuthProvider component scope if needed.
           // Given they are defined within AuthProvider, they will be recreated on each render,
           // which can cause issues with useEffect if not memoized. This is a separate potential improvement.

  // signUp, signIn, etc. methods (original implementations assumed to be here and correct)
  const signUp = async (email: string, password: string, userData: Partial<User>): Promise<{ data?: any; error: any | null }> => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { name: userData.name, role: userData.role } }
      });
      if (error) { setAuthError(error.message); return { error }; }
      if (data.user) {
        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id, email, name: userData.name, role: userData.role, is_approved: userData.role === 'developer'
        });
        if (profileError) { setAuthError(profileError.message); return { error: profileError }; }
      }
      return { data, error: null };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage); return { error: { message: errorMessage } };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ user: SupabaseUser | null; error: any | null }> => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setAuthError(error.message); return { user: null, error }; }
      return { user: data.user, error: null };
    } catch (error: any) {
      setAuthError('An unexpected error occurred during sign in. Please try again.');
      return { user: null, error };
    }
  };

  const signInWithGitHub = async (stateParams?: Record<string, any>) => {
    setAuthError(null);
    const name = localStorage.getItem('gittalent_signup_name') || '';
    const role = localStorage.getItem('gittalent_signup_role') || 'developer';
    const stateObj = { name, role: role || 'developer', install_after_auth: true, ...(stateParams || {}) };
    const redirectTo = `${window.location.origin}/auth/callback`;
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo, scopes: 'read:user user:email', state: JSON.stringify(stateObj) } });
      if (error) { throw error; }
      return { error: null };
    } catch (error: any) {
      setAuthError(error.message || 'Failed to sign in with GitHub');
      return { error };
    }
  };

  const connectGitHubApp = async (): Promise<{ error: any | null; success?: boolean }> => {
    try {
      setAuthError(null);
      if (!user) { throw new Error('User must be authenticated to connect GitHub App'); }
      const GITHUB_APP_SLUG = 'GitTalentApp';
      const stateParam = encodeURIComponent(JSON.stringify({ user_id: user.id, from_app: true, redirect_uri: `${window.location.origin}/github-setup` }));
      const redirectUrl = encodeURIComponent(`${window.location.origin}/github-setup`);
      const githubAppUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${stateParam}&redirect_uri=${redirectUrl}`;
      window.location.href = githubAppUrl;
      return { error: null, success: true };
    } catch (error: any) {
      setAuthError('Failed to connect GitHub App. Please try again.');
      return { error };
    }
  };

  const signOut = async (): Promise<{ error: any | null }> => {
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) { setAuthError(error.message); return { error }; }
      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setAuthError(null);
      return { error: null };
    } catch (error: any) {
      setAuthError('An unexpected error occurred during sign out. Please try again.');
      return { error };
    } finally {
      setSigningOut(false);
    }
  };

  const createDeveloperProfile = async (profileData: Partial<Developer>): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) { throw new Error('User must be authenticated to create developer profile'); }
      const { data, error } = await supabase.from('developers').insert([{ user_id: user.id, ...profileData }]).select().single();
      if (error) { throw error; }
      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const updateDeveloperProfile = async (updates: Partial<Developer>): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user || !developerProfile) { throw new Error('User and developer profile must exist to update'); }
      const { data, error } = await supabase.from('developers').update(updates).eq('user_id', user.id).select().single();
      if (error) { throw error; }
      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const createJobRole = async (jobData: Partial<JobRole>): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) { throw new Error('User must be authenticated to create job roles'); }
      const { data, error } = await supabase.from('job_roles').insert([jobData]).select().single();
      if (error) { throw error; }
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const updateJobRole = async (jobRoleId: number, updates: Partial<JobRole>): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) { throw new Error('User must be authenticated to update job roles'); }
      const { data, error } = await supabase.from('job_roles').update(updates).eq('id', jobRoleId).select().single();
      if (error) { throw error; }
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const createAssignment = async (assignmentData: Partial<Assignment>): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) { throw new Error('User must be authenticated to create assignments'); }
      const { data, error } = await supabase.from('assignments').insert([assignmentData]).select().single();
      if (error) { throw error; }
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const createHire = async (hireData: Partial<Hire>): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) { throw new Error('User must be authenticated to create hires'); }
      const { data, error } = await supabase.from('hires').insert([hireData]).select().single();
      if (error) { throw error; }
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) { throw new Error('User must be authenticated to update approval status'); }
      const { data, error } = await supabase.from('users').update({ is_approved: isApproved }).eq('id', userId).select().single();
      if (error) { throw error; }
      if (userId === user.id) { setUserProfile(data); }
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const updateProfileStrength = async (userId: string, strength: number): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) { throw new Error('User must be authenticated to update profile strength'); }
      const { data, error } = await supabase.from('users').update({ profile_strength: strength }).eq('id', userId).select().single();
      if (error) { throw error; }
      if (userId === user.id) { setUserProfile(data); }
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    console.log('🔄 refreshProfile: Refreshing profiles for user:', user.id);
    setLoading(true);
    try {
      await fetchUserProfile(user);
    } catch (error) {
      console.error('❌ refreshProfile: Error refreshing profile:', error);
    }
    setLoading(false); // This should ideally be in fetchUserProfile's finally
  };

  const value: AuthContextType = {
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
    createDeveloperProfile, // This function now delegates to ensureDeveloperProfile
    updateDeveloperProfile,
    createJobRole,
    updateJobRole,
    createAssignment,
    createHire,
    updateUserApprovalStatus,
    updateProfileStrength,
    refreshProfile,
    needsOnboarding: !developerProfile && userProfile?.role === 'developer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};