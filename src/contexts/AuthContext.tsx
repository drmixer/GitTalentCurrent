import { createContext, useState, useEffect, ReactNode, useContext, useRef, useCallback } from 'react'; // Added useCallback
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

  // New state for decoupling
  const [authUserToProcess, setAuthUserToProcess] = useState<SupabaseUser | null>(null);
  const [authProcessingEventType, setAuthProcessingEventType] = useState<string | null>(null);


  const ensureDeveloperProfile = useCallback(async (authUser: SupabaseUser): Promise<boolean> => {
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
  }, []); // Dependencies: supabase (stable), setDeveloperProfile (stable)

  const fetchDeveloperProfile = useCallback(async (userId: string): Promise<Developer | null> => {
    console.log(`🔄 fetchDeveloperProfile for ${userId}`);
    try {
      const { data: devProfile, error } = await supabase.from('developers').select('*').eq('user_id', userId).single();
      if (error) {
        if (error.code === 'PGRST116') { setDeveloperProfile(null); return null; }
        else { console.error(`❌ fetchDeveloperProfile: Error for ${userId}:`, error.message); setDeveloperProfile(null); return null; }
      }
      setDeveloperProfile(devProfile); return devProfile;
    } catch (error) { console.error(`❌ fetchDeveloperProfile: Unexpected error for ${userId}:`, error); setDeveloperProfile(null); return null; }
  }, []); // Dependencies: supabase (stable), setDeveloperProfile (stable)

  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    console.log('🔄 fetchUserProfile: Fetching profile for user:', authUser.id);
    setAuthError(null);
    // setLoading(true) is called by the initiator of this process (onAuthStateChange or new useEffect)
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
    } finally {
      // setLoading(false) is now handled by the calling useEffect or the main finally of handleGitHubSignIn
      console.log(`🔄 fetchUserProfile: Finished for ${authUser.id}.`);
    }
  }, [ensureDeveloperProfile, fetchDeveloperProfile]); // setUserProfile, setAuthError are stable

  const handleGitHubSignIn = useCallback(async (authUser: SupabaseUser) => {
    console.log(`🔄 handleGitHubSignIn: Processing GitHub sign-in for user: ${authUser.id}`);
    setAuthError(null);
    console.log(`🔄 handleGitHubSignIn: User metadata for ${authUser.id}:`, authUser.user_metadata);
    try {
      console.log(`🔄 handleGitHubSignIn: DEBUG Entered TRY block for user ${authUser.id}.`);
      if (!supabase) {
        console.error(`❌ handleGitHubSignIn: DEBUG Supabase client is null for user ${authUser.id}.`);
        setAuthError("Auth service error.");
        // setLoading(false) handled by finally
        return;
      }
      console.log(`🔄 handleGitHubSignIn: DEBUG Test 1 - Before simple await setTimeout for user ${authUser.id}.`);
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log(`✅ handleGitHubSignIn: DEBUG Test 1 - After simple await setTimeout for user ${authUser.id}.`);

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
      console.log(`🔄 handleGitHubSignIn: DEBUG In finally block for user ${authUser.id}. Current loading (before set): ${loading}`);
      if (loading) {
        console.log(`🔄 handleGitHubSignIn: DEBUG Calling setLoading(false) in finally for ${authUser.id}.`);
        setLoading(false);
      }
      // Note: `loading` state read here will be stale due to closure.
      // The effect of setLoading(false) will be seen in next render.
      console.log(`🔄 handleGitHubSignIn: DEBUG setLoading(false) call issued. AuthContext loading state will be false in next render if true now.`);
    }
  }, [loading]); // Added loading to dep array, setAuthError, setLoading are stable

  useEffect(() => {
    console.log('🔄 AuthProvider: Main useEffect for onAuthStateChange setup.');
    prevSessionRef.current = null;
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log('🔄 AuthProvider: Current session from getSession():', currentSession ? 'Found' : 'None');
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (!currentSession?.user) {
        setLoading(false); // Initial loading state if no session
      }
    }).catch(error => {
      console.error('❌ AuthProvider: Error in getSession():', error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`🔄 AuthProvider: onAuthStateChange event: ${event}`, newSession ? `Session for user ${newSession.user?.id}` : 'No session');
      if (isProcessingAuthStateChangeRef.current) {
        console.log('🔄 AuthProvider: onAuthStateChange event ignored, already processing another.');
        return;
      }
      const prevSessionStr = JSON.stringify(prevSessionRef.current);
      const newSessionStr = JSON.stringify(newSession);
      if (prevSessionStr === newSessionStr && event !== 'INITIAL_SESSION' && prevSessionRef.current !== null) {
        console.log('🔄 AuthProvider: Session unchanged and not initial, skipping update.');
        if (!newSession?.user && !user && loading) { setLoading(false); }
        return;
      }

      isProcessingAuthStateChangeRef.current = true; // Mark as processing THIS event
      console.log('🔄 AuthProvider: Processing new auth state change.');

      prevSessionRef.current = newSession; // Update ref for *next* event comparison
      const NUser = newSession?.user ?? null;
      setSession(newSession);
      setUser(NUser);
      setAuthError(null);

      if (NUser) {
        console.log(`🔄 AuthProvider: User ${NUser.id} detected from event ${event}. Setting loading true and queueing for processing.`);
        setLoading(true);
        setAuthUserToProcess(NUser); // Trigger the other useEffect
        setAuthProcessingEventType(event); // Store event type
      } else {
        console.log('🔄 AuthProvider: No user from event. Clearing profiles, setting loading false.');
        setUserProfile(null);
        setDeveloperProfile(null);
        setLoading(false);
        setAuthUserToProcess(null); // Clear any pending user
        setAuthProcessingEventType(null);
        isProcessingAuthStateChangeRef.current = false; // Reset immediately if no user
      }
      // Note: isProcessingAuthStateChangeRef is reset in the new useEffect's finally or if no NUser
    });
    return () => {
      console.log('🔄 AuthProvider: Cleaning up auth subscription.');
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Main subscription useEffect, runs once.

  // New useEffect to handle processing triggered by authUserToProcess state change
  useEffect(() => {
    if (authUserToProcess) {
      console.log(`🔄 AuthProvider: useEffect processing user ${authUserToProcess.id} for event type ${authProcessingEventType}`);
      const processAuthUser = async () => {
        try {
          if (authProcessingEventType === 'SIGNED_IN') {
            if (authUserToProcess.app_metadata?.provider === 'github') {
              console.log('🔄 AuthProvider (useEffect): GitHub sign-in detected, calling handleGitHubSignIn.');
              await handleGitHubSignIn(authUserToProcess);
            } else {
              console.log('🔄 AuthProvider (useEffect): Non-GitHub sign-in, calling fetchUserProfile.');
              await fetchUserProfile(authUserToProcess);
            }
          } else if (authProcessingEventType === 'INITIAL_SESSION' || authProcessingEventType === 'USER_UPDATED' || authProcessingEventType === 'TOKEN_REFRESHED') {
            console.log(`🔄 AuthProvider (useEffect): Event ${authProcessingEventType}, calling fetchUserProfile.`);
            await fetchUserProfile(authUserToProcess);
          } else {
            console.log(`🔄 AuthProvider (useEffect): Unhandled event type ${authProcessingEventType} with user, attempting fetchUserProfile.`);
            await fetchUserProfile(authUserToProcess); // Fallback for safety
          }
        } catch (e) {
          console.error('❌ AuthProvider (useEffect): Error during decoupled auth processing:', e);
          setAuthError(e instanceof Error ? e.message : 'Unexpected error in decoupled processing.');
          setLoading(false); // Ensure loading is false on error here
        } finally {
          console.log(`🔄 AuthProvider (useEffect): Finished processing for ${authUserToProcess.id}. Clearing authUserToProcess.`);
          setAuthUserToProcess(null);
          setAuthProcessingEventType(null);
          // setLoading(false) should be handled by handleGitHubSignIn/fetchUserProfile's finally block.
          // isProcessingAuthStateChangeRef is reset here as the processing for this user is done.
          isProcessingAuthStateChangeRef.current = false;
          console.log('🔄 AuthProvider (useEffect): Reset isProcessingAuthStateChangeRef.');
        }
      };
      processAuthUser();
    }
  }, [authUserToProcess, authProcessingEventType, handleGitHubSignIn, fetchUserProfile]);


  // Other methods like signUp, signIn, etc.
  const signUp = async (email: string, password: string, userData: Partial<User>): Promise<{ data?: any; error: any | null }> => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { name: userData.name, role: userData.role } }
      });
      if (error) { setAuthError(error.message); return { error }; }
      if (data.user) {
        // This insert should ideally be part of fetchUserProfile or handleGitHubSignIn logic if profile doesn't exist
        // For now, keeping it as per original structure for non-OAuth signups
        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id, email, name: userData.name, role: userData.role, is_approved: userData.role === 'developer'
        });
        if (profileError) { setAuthError(profileError.message); return { error: profileError }; }
         // After sign up, trigger profile processing
        setAuthUserToProcess(data.user);
        setAuthProcessingEventType('SIGNED_IN'); // Treat as SIGNED_IN for profile creation
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
      // onAuthStateChange will handle the SIGNED_IN event and trigger profile processing
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
      return { error: null }; // Supabase handles redirect, onAuthStateChange will pick up
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
      const { error } = await supabase.auth.signOut(); // This will trigger onAuthStateChange with SIGNED_OUT
      if (error) { setAuthError(error.message); return { error }; }
      // Clearing local state is mostly handled by onAuthStateChange now
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
    setAuthUserToProcess(user); // Use the new mechanism to trigger profile fetch
    setAuthProcessingEventType('MANUAL_REFRESH'); // Custom event type for clarity
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