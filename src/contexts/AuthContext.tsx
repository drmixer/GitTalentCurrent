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

  // Forward declarations
  let handleGitHubSignIn: (authUser: SupabaseUser) => Promise<void>;
  let fetchUserProfile: (authUser: SupabaseUser) => Promise<User | null>;
  let ensureDeveloperProfile: (authUser: SupabaseUser) => Promise<boolean>;
  let fetchDeveloperProfile: (userId: string) => Promise<Developer | null>;

  useEffect(() => {
    console.log('🔄 AuthProvider: Initializing auth state...');
    prevSessionRef.current = null;

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log('🔄 AuthProvider: Current session from getSession():', currentSession ? 'Found' : 'None');
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        console.log('🔄 AuthProvider: DEBUG_EFFECT - User found in getSession(). Testing Supabase calls.');
        try {
          console.log('🔄 AuthProvider: DEBUG_EFFECT - Test A: Before supabase.auth.getUser().');
          const { data: { user: testUser }, error: testUserError } = await supabase.auth.getUser();
          if (testUserError) {
            console.error('❌ AuthProvider: DEBUG_EFFECT - Test A: supabase.auth.getUser() FAILED:', testUserError);
          } else {
            console.log('✅ AuthProvider: DEBUG_EFFECT - Test A: supabase.auth.getUser() success. User ID:', testUser?.id);
          }
        } catch (e: unknown) {
          console.error('❌ AuthProvider: DEBUG_EFFECT - Test A: CRITICAL EXCEPTION during supabase.auth.getUser():', e);
        }

        try {
          console.log('🔄 AuthProvider: DEBUG_EFFECT - Test B: Before Supabase query users table limit 1.');
          const { data: usersTestData, error: usersTestError } = await supabase.from('users').select('id').limit(1);
          if (usersTestError) {
            console.error('❌ AuthProvider: DEBUG_EFFECT - Test B: Supabase query FAILED:', usersTestError);
          } else {
            console.log('✅ AuthProvider: DEBUG_EFFECT - Test B: Supabase query success. Data:', usersTestData);
          }
        } catch (e: unknown) {
          console.error('❌ AuthProvider: DEBUG_EFFECT - Test B: CRITICAL EXCEPTION during Supabase query:', e);
        }
      }
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
            setUserProfile(null); setDeveloperProfile(null); setLoading(false);
          } else {
            console.log(`🔄 AuthProvider: Unhandled event type ${event} with user, fetching profile.`);
            await fetchUserProfile(NUser);
          }
        } else {
          console.log('🔄 AuthProvider: No user after auth state change, clearing profiles. Event:', event);
          setUserProfile(null); setDeveloperProfile(null); setLoading(false);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  fetchUserProfile = async (authUser: SupabaseUser): Promise<User | null> => {
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
        const { error: rpcError } = await supabase.rpc(
          'create_user_profile',
          { user_id: authUser.id, user_email: authUser.email || 'unknown@example.com', user_name: userName, user_role: userRole, company_name: companyName }
        );
        if (rpcError) { console.error('❌ fetchUserProfile: Error creating user profile via RPC:', rpcError); setAuthError('Failed to create your profile: ' + rpcError.message); return null; }
        console.log('✅ fetchUserProfile: Profile creation RPC success.');
        const { data: newProfile, error: fetchError } = await supabase.from('users').select('*').eq('id', authUser.id).single();
        if (fetchError) { console.error('❌ fetchUserProfile: Error fetching newly created profile:', fetchError); setAuthError('Failed to load your profile after creation'); return null; }
        console.log('✅ fetchUserProfile: Newly created profile fetched:', newProfile);
        setUserProfile(newProfile);
        if (newProfile.role === 'developer') { await ensureDeveloperProfile(authUser); }
        return newProfile;
      } else if (error) { console.error(`❌ fetchUserProfile: Error fetching user profile for ${authUser.id}:`, error); setAuthError('Failed to load your profile.'); return null; }
      setUserProfile(profile);
      if (profile.role === 'developer') {
        const devProfile = await fetchDeveloperProfile(authUser.id);
        if (!devProfile) { await ensureDeveloperProfile(authUser); }
      }
      return profile;
    } catch (error) { console.error(`❌ fetchUserProfile: Unexpected error for user ${authUser.id}:`, error); setAuthError('An unexpected error occurred.'); return null;
    } finally { setLoading(false); console.log(`🔄 fetchUserProfile: Finished for ${authUser.id}. Loading: ${loading}`); }
  }; 

  ensureDeveloperProfile = async (authUser: SupabaseUser): Promise<boolean> => {
    console.log(`🔄 ensureDeveloperProfile for ${authUser.id}`);
    try {
      const { data: existingProfile, error: checkError } = await supabase.from('developers').select('*').eq('user_id', authUser.id).maybeSingle();
      if (checkError && checkError.code !== 'PGRST116') { console.error(`❌ ensureDeveloperProfile: Error checking for ${authUser.id}:`, checkError); return false; }
      if (existingProfile) { setDeveloperProfile(existingProfile); return true; }
      const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || '';
      const { data: newDevProfileData, error: createError } = await supabase.from('developers').insert({
        user_id: authUser.id, github_handle: githubUsername, bio: authUser.user_metadata?.bio || '', location: authUser.user_metadata?.location || '',
        profile_pic_url: authUser.user_metadata?.avatar_url || null, github_installation_id: authUser.user_metadata?.installation_id || null, availability: true
      }).select().single();
      if (createError) { console.error(`❌ ensureDeveloperProfile: Error creating for ${authUser.id}:`, createError); return false; }
      if (!newDevProfileData) { console.error(`❌ ensureDeveloperProfile: No data returned for ${authUser.id}`); return false; }
      setDeveloperProfile(newDevProfileData); return true;
    } catch (error) { console.error(`❌ ensureDeveloperProfile: Unexpected error for ${authUser.id}:`, error); return false; }
  };

  fetchDeveloperProfile = async (userId: string): Promise<Developer | null> => {
    console.log(`🔄 fetchDeveloperProfile for ${userId}`);
    try {
      const { data: devProfile, error } = await supabase.from('developers').select('*').eq('user_id', userId).single();
      if (error) {
        if (error.code === 'PGRST116') { setDeveloperProfile(null); return null; }
        else { console.error(`❌ fetchDeveloperProfile: Error for ${userId}:`, error.message); setDeveloperProfile(null); return null; }
      }
      setDeveloperProfile(devProfile); return devProfile;
    } catch (error) { console.error(`❌ fetchDeveloperProfile: Unexpected error for ${userId}:`, error); setDeveloperProfile(null); return null; }
  };

  handleGitHubSignIn = async (authUser: SupabaseUser) => {
    console.log(`🔄 handleGitHubSignIn: Processing GitHub sign-in for user: ${authUser.id}`);
    setAuthError(null);
    console.log(`🔄 handleGitHubSignIn: User metadata for ${authUser.id}:`, authUser.user_metadata);

    try {
      console.log(`🔄 handleGitHubSignIn: DEBUG Entered TRY block for user ${authUser.id}.`);

      if (!supabase) {
        console.error(`❌ handleGitHubSignIn: DEBUG Supabase client is null for user ${authUser.id}.`);
        setAuthError("Auth service error.");
        if (loading) setLoading(false);
        return;
      }

      console.log(`🔄 handleGitHubSignIn: DEBUG Test 1 - Before simple await setTimeout for user ${authUser.id}.`);
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log(`✅ handleGitHubSignIn: DEBUG Test 1 - After simple await setTimeout for user ${authUser.id}.`);

      // Introduce a short delay before Supabase calls
      console.log(`🔄 handleGitHubSignIn: DEBUG - Introducing short delay (20ms) before Supabase calls for user ${authUser.id}.`);
      await new Promise(resolve => setTimeout(resolve, 20));
      console.log(`✅ handleGitHubSignIn: DEBUG - Short delay completed for user ${authUser.id}.`);

      console.log(`🔄 handleGitHubSignIn: DEBUG Test 2 - Before supabase.auth.getUser() for user ${authUser.id}.`);
      try {
        const { data: { user: authUserTest }, error: getUserError } = await supabase.auth.getUser();
        if (getUserError) {
          console.error(`❌ handleGitHubSignIn: DEBUG Test 2 - supabase.auth.getUser() FAILED for user ${authUser.id}:`, getUserError);
        } else {
          console.log(`✅ handleGitHubSignIn: DEBUG Test 2 - supabase.auth.getUser() success for ${authUser.id}. User ID:`, authUserTest?.id);
        }
      } catch (e: unknown) {
        console.error(`❌ handleGitHubSignIn: DEBUG Test 2 - CRITICAL EXCEPTION during supabase.auth.getUser() for ${authUser.id}:`, e);
      }

      console.log(`🔄 handleGitHubSignIn: DEBUG Test 3 - Before Supabase query 'users' limit 1 for user ${authUser.id}.`);
      try {
        const { data: usersTestData, error: usersTestError } = await supabase.from('users').select('id').limit(1);
        if (usersTestError) {
          console.error(`❌ handleGitHubSignIn: DEBUG Test 3 - Supabase query FAILED for user ${authUser.id}:`, usersTestError);
        } else {
          console.log(`✅ handleGitHubSignIn: DEBUG Test 3 - Supabase query success for ${authUser.id}. Data:`, usersTestData);
        }
      } catch (e: unknown) {
        console.error(`❌ handleGitHubSignIn: DEBUG Test 3 - CRITICAL EXCEPTION during Supabase query for ${authUser.id}:`, e);
      }

      console.log(`🔄 handleGitHubSignIn: DEBUG - All tests complete. Original logic is bypassed for user ${authUser.id}.`);

    } catch (error: unknown) {
      console.error(`❌ handleGitHubSignIn: DEBUG CAUGHT TOP-LEVEL UNEXPECTED ERROR for user ${authUser.id}:`, error);
      if (error instanceof Error) {
        console.error(`❌ handleGitHubSignIn: DEBUG Error name: ${error.name}, message: ${error.message}, stack: ${error.stack}`);
      }
      setAuthError('An unexpected error occurred during sign in.');
    } finally {
      console.log(`🔄 handleGitHubSignIn: DEBUG In finally block for user ${authUser.id}. Current loading: ${loading}`);
      if (loading) {
        console.log(`🔄 handleGitHubSignIn: DEBUG Calling setLoading(false) in finally for ${authUser.id}.`);
        setLoading(false);
      }
      console.log(`🔄 handleGitHubSignIn: DEBUG setLoading(false) called/checked. Loading is now: ${loading}.`);
    }
  };

  // Other methods like signUp, signIn, etc.
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
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user, session, userProfile, developerProfile, loading, authError, signingOut,
    signUp, signIn, signInWithGitHub, connectGitHubApp, signOut,
    createDeveloperProfile, updateDeveloperProfile, createJobRole, updateJobRole,
    createAssignment, createHire, updateUserApprovalStatus, updateProfileStrength,
    refreshProfile,
    needsOnboarding: !developerProfile && userProfile?.role === 'developer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};