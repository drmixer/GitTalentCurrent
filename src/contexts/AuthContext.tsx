import { createContext, useState, useEffect, ReactNode, useContext, useRef, useCallback } from 'react';
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

// Helper function for adding timeout to promises
function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new Error('Promise timed out')
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`Promise timed out after ${ms}ms for promise:`, promise);
      reject(timeoutError);
    }, ms);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

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

  const [authUserToProcess, setAuthUserToProcess] = useState<SupabaseUser | null>(null);
  const [authProcessingEventType, setAuthProcessingEventType] = useState<string | null>(null);

  const ensureDeveloperProfile = useCallback(async (authUser: SupabaseUser): Promise<boolean> => {
    console.log(`🔄 ensureDeveloperProfile for user ${authUser.id}`);
    try {
      const { data: existingProfile, error: checkError } = await supabase.from('developers').select('*').eq('user_id', authUser.id).maybeSingle();
      if (checkError && checkError.code !== 'PGRST116') { console.error(`❌ ensureDeveloperProfile: Error checking for ${authUser.id}:`, checkError); return false; }
      if (existingProfile) {
        console.log(`✅ ensureDeveloperProfile: Developer profile already exists for user ${authUser.id}. Calling setDeveloperProfile.`);
        setDeveloperProfile(existingProfile);
        console.log(`🔄 ensureDeveloperProfile: setDeveloperProfile call completed for ${authUser.id}.`);
        return true;
      }
      console.log(`🔄 ensureDeveloperProfile: No existing developer profile for ${authUser.id}. Creating new one.`);
      const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || '';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const userBio = authUser.user_metadata?.bio || '';
      const userLocation = authUser.user_metadata?.location || '';
      const githubInstallationId = authUser.user_metadata?.installation_id || null;
      console.log(`🔄 ensureDeveloperProfile: Creating new developer profile for ${authUser.id} with GitHub handle: ${githubUsername}`);
      const { data: newDevProfileData, error: createError } = await supabase.from('developers').insert({
        user_id: authUser.id, github_handle: githubUsername, bio: userBio, location: userLocation,
        profile_pic_url: avatarUrl, github_installation_id: githubInstallationId, availability: true
      }).select().single();
      if (createError) { console.error(`❌ ensureDeveloperProfile: Error creating for ${authUser.id}:`, createError); return false; }
      if (!newDevProfileData) { console.error(`❌ ensureDeveloperProfile: No data returned after insert for ${authUser.id}`); return false; }
      console.log(`✅ ensureDeveloperProfile: Developer profile created for ${authUser.id}. Calling setDeveloperProfile.`);
      setDeveloperProfile(newDevProfileData);
      console.log(`🔄 ensureDeveloperProfile: setDeveloperProfile call completed for ${authUser.id}.`);
      return true;
    } catch (error) { console.error(`❌ ensureDeveloperProfile: Unexpected error for ${authUser.id}:`, error); return false; }
  }, []);

  const fetchDeveloperProfile = useCallback(async (userId: string): Promise<Developer | null> => {
    console.log(`🔄 fetchDeveloperProfile for ${userId}`);
    try {
      const { data: devProfile, error } = await supabase.from('developers').select('*').eq('user_id', userId).single();
      if (error) {
        if (error.code === 'PGRST116') { console.log(`🤷 fetchDeveloperProfile: No developer profile found for ${userId}. Calling setDeveloperProfile(null).`); setDeveloperProfile(null); console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile(null) call completed for ${userId}.`); return null; }
        else { console.error(`❌ fetchDeveloperProfile: Error for ${userId}:`, error.message); console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile(null) due to error for ${userId}.`); setDeveloperProfile(null); console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile(null) call completed for ${userId}.`); return null; }
      }
      console.log(`✅ fetchDeveloperProfile: Developer profile fetched for ${userId}. Calling setDeveloperProfile.`);
      setDeveloperProfile(devProfile);
      console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile call completed for ${userId}.`);
      return devProfile;
    } catch (error) { console.error(`❌ fetchDeveloperProfile: Unexpected error for ${userId}:`, error); console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile(null) due to unexpected error for ${userId}.`); setDeveloperProfile(null); console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile(null) call completed for ${userId}.`); return null; }
  }, []);

  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    console.log(`🔄 fetchUserProfile: Processing for user: ${authUser.id}`);
    setAuthError(null);
    // setLoading(true) is managed by the calling useEffect via setAuthUserToProcess
    try {
      console.log(`🔄 fetchUserProfile: User metadata for ${authUser.id}:`, authUser.user_metadata);
      const { data: profile, error } = await supabase.from('users').select('*').eq('id', authUser.id).single();

      if (error && error.code === 'PGRST116') {
        console.log(`🔄 fetchUserProfile: Profile not found for ${authUser.id}, creating one.`);
        const userRole = localStorage.getItem('gittalent_signup_role') || authUser.user_metadata?.role || (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
        const userName = localStorage.getItem('gittalent_signup_name') || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.preferred_username || authUser.user_metadata?.user_name || 'GitHub User';
        const companyName = authUser.user_metadata?.company_name || 'Company';
        console.log(`🔄 fetchUserProfile: Creating profile via RPC for ${authUser.id} with role: ${userRole}, name: ${userName}`);
        const { error: rpcError } = await supabase.rpc(
          'create_user_profile',
          { user_id: authUser.id, user_email: authUser.email || 'unknown@example.com', user_name: userName, user_role: userRole, company_name: companyName }
        );
        if (rpcError) { console.error(`❌ fetchUserProfile: Error creating profile via RPC for ${authUser.id}:`, rpcError); setAuthError('Failed to create your profile: ' + rpcError.message); return null; }
        console.log(`✅ fetchUserProfile: Profile creation RPC success for ${authUser.id}. Fetching new profile.`);
        const { data: newProfile, error: fetchError } = await supabase.from('users').select('*').eq('id', authUser.id).single();
        if (fetchError) { console.error(`❌ fetchUserProfile: Error fetching newly created profile for ${authUser.id}:`, fetchError); setAuthError('Failed to load your profile after creation.'); return null; }
        console.log(`✅ fetchUserProfile: Newly created profile fetched for ${authUser.id}.`);
        console.log(`🔄 fetchUserProfile: Calling setUserProfile for ${authUser.id}.`);
        setUserProfile(newProfile);
        console.log(`🔄 fetchUserProfile: setUserProfile call completed for ${authUser.id}.`);
        if (newProfile.role === 'developer') {
          console.log(`🔄 fetchUserProfile: User ${authUser.id} is developer. Ensuring dev profile.`);
          await ensureDeveloperProfile(authUser);
        }
        return newProfile;
      } else if (error) {
        console.error(`❌ fetchUserProfile: Error fetching profile for ${authUser.id}:`, error);
        setAuthError('Failed to load your profile.'); return null;
      }
      console.log(`✅ fetchUserProfile: Existing profile found for ${authUser.id}.`);
      console.log(`🔄 fetchUserProfile: Calling setUserProfile for ${authUser.id}.`);
      setUserProfile(profile);
      console.log(`🔄 fetchUserProfile: setUserProfile call completed for ${authUser.id}.`);
      if (profile.role === 'developer') {
        console.log(`🔄 fetchUserProfile: User ${authUser.id} is developer. Fetching/ensuring dev profile.`);
        const devProfile = await fetchDeveloperProfile(authUser.id);
        if (!devProfile) {
          console.log(`🔄 fetchUserProfile: Dev profile not found for ${authUser.id}, ensuring creation.`);
          await ensureDeveloperProfile(authUser);
        }
      }
      return profile;
    } catch (error) {
      console.error(`❌ fetchUserProfile: Unexpected error for ${authUser.id}:`, error);
      setAuthError('An unexpected error occurred while fetching your profile.'); return null;
    } finally {
      console.log(`🔄 fetchUserProfile: In finally block for ${authUser.id}.`);
      console.log(`🔄 fetchUserProfile: UserProfile state:`, userProfile ? `Exists (ID: ${userProfile.id})` : 'null');
      console.log(`🔄 fetchUserProfile: DeveloperProfile state:`, developerProfile ? `Exists (User ID: ${developerProfile.user_id})` : 'null');
      console.log(`🔄 fetchUserProfile: Calling setLoading(false) for ${authUser.id}.`);
      setLoading(false);
      console.log(`🔄 fetchUserProfile: setLoading(false) completed for ${authUser.id}.`);
    }
  }, [ensureDeveloperProfile, fetchDeveloperProfile]);

  handleGitHubSignIn = useCallback(async (authUser: SupabaseUser) => {
    console.log(`🔄 handleGitHubSignIn: Restored - Processing GitHub sign-in for user: ${authUser.id}`);
    // Log the detailed user_metadata at the very beginning of the handler
    console.log(`ℹ️ handleGitHubSignIn: authUser.user_metadata for ${authUser.id}:`, JSON.stringify(authUser.user_metadata, null, 2));
    setAuthError(null);
    // console.log(`🔄 handleGitHubSignIn: Restored - User metadata for ${authUser.id}:`, authUser.user_metadata); // Redundant if using stringify above

    try {
      console.log(`🔄 handleGitHubSignIn: Restored - Entered TRY block for user ${authUser.id}.`);
      if (!supabase) {
        console.error(`❌ handleGitHubSignIn: Restored - Supabase client is null for user ${authUser.id}.`);
        setAuthError("Auth service error.");
        return; // setLoading(false) will be called in finally
      }

      let userProfileData: User | null = null;
      let profileError: any = null;

      console.log(`🔄 handleGitHubSignIn: Restored - LOG POINT 1 - About to query 'users' table for user ${authUser.id}.`);
      try {
        console.log(`🔄 handleGitHubSignIn: Restored - LOG POINT 2 - Entering inner try for 'users' query for ${authUser.id}.`);
        const currentAuthSession = await supabase.auth.getSession();
        console.log(`🔄 handleGitHubSignIn: Restored - Current Supabase session for ${authUser.id}:`, currentAuthSession?.data?.session);
        const { data, error: queryError } = await promiseWithTimeout(
          supabase.from('users').select('*').eq('id', authUser.id).single(),
          8000, new Error(`Timeout: Supabase user query for ${authUser.id}`)
        );
        console.log(`🔄 handleGitHubSignIn: Restored - LOG POINT 3 - 'await' for 'users' query completed for ${authUser.id}.`);
        userProfileData = data;
        profileError = queryError;
        console.log(`🔄 handleGitHubSignIn: Restored - LOG POINT 4 - Query assignment done for ${authUser.id}. Profile found: ${!!userProfileData}, Error:`, profileError);
      } catch (e: unknown) {
        console.error(`❌ handleGitHubSignIn: Restored - LOG POINT 5 - INNER CATCH for 'users' query for ${authUser.id}:`, e);
        profileError = (e instanceof Error) ? e : { message: String(e), code: 'UNKNOWN_EXCEPTION' };
        userProfileData = null;
      }
      console.log(`🔄 handleGitHubSignIn: Restored - LOG POINT 6 - After 'users' query try/catch for ${authUser.id}. userProfileData:`, userProfileData, `profileError:`, profileError);

      if (profileError && (profileError.code === 'PGRST116' || profileError.message?.includes(' रिजल्ट में कोई पंक्ति नहीं') || profileError.message?.includes('Promise timed out'))) {
        console.log(`🔄 handleGitHubSignIn: Restored - User profile not found for ${authUser.id} (Error: ${profileError.message}), creating one.`);
        const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
        const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || githubUsername || 'GitHub User';
        const userRole = localStorage.getItem('gittalent_signup_role') || 'developer'; // Default to developer for GitHub sign-in
        const userName = localStorage.getItem('gittalent_signup_name') || fullName;

        console.log(`🔄 handleGitHubSignIn: Restored - Creating 'users' profile for ${authUser.id} with name: ${userName}, role: ${userRole}`);
        const { data: createdProfile, error: createError } = await supabase
          .from('users')
          .insert({ id: authUser.id, email: authUser.email || 'unknown@example.com', name: userName, role: userRole, is_approved: userRole !== 'recruiter' })
          .select().single();

        if (createError) {
          console.error(`❌ handleGitHubSignIn: Restored - Error creating 'users' profile for ${authUser.id}:`, createError);
          setAuthError('Failed to create user profile. Please try again.');
          return;
        }
        console.log(`✅ handleGitHubSignIn: Restored - 'users' profile created for ${authUser.id}.`);
        console.log(`🔄 handleGitHubSignIn: Restored - Calling setUserProfile for ${authUser.id}.`);
        setUserProfile(createdProfile);
        console.log(`🔄 handleGitHubSignIn: Restored - setUserProfile call completed for ${authUser.id}.`);
        userProfileData = createdProfile;

        if (userRole === 'developer') {
          console.log(`🔄 handleGitHubSignIn: Restored - User ${authUser.id} is developer. Ensuring 'developers' profile.`);
          await ensureDeveloperProfile(authUser); // This handles github_handle
        }
      } else if (profileError) {
        console.error(`❌ handleGitHubSignIn: Restored - Error fetching 'users' profile for ${authUser.id}:`, profileError);
        setAuthError('Failed to load your profile. Please try again.');
        return;
      } else if (userProfileData) {
        console.log(`✅ handleGitHubSignIn: Restored - Existing 'users' profile found for ${authUser.id}.`);
        console.log(`🔄 handleGitHubSignIn: Restored - Calling setUserProfile for ${authUser.id}.`);
        setUserProfile(userProfileData);
        console.log(`🔄 handleGitHubSignIn: Restored - setUserProfile call completed for ${authUser.id}.`);
        if (userProfileData.role === 'developer') {
          console.log(`🔄 handleGitHubSignIn: Restored - User ${authUser.id} is developer. Fetching/ensuring 'developers' profile.`);
          const devProfile = await fetchDeveloperProfile(authUser.id);
          if (!devProfile) {
            console.log(`🔄 handleGitHubSignIn: Restored - Dev profile not found for ${authUser.id}, ensuring creation.`);
            await ensureDeveloperProfile(authUser); // This handles github_handle
          }
        }
      } else {
        console.warn(`⚠️ handleGitHubSignIn: Restored - User profile data is null for ${authUser.id} without recognized error. This is unexpected.`);
        setAuthError('Failed to load profile data. Please try again.');
        return;
      }
      console.log(`✅ handleGitHubSignIn: Restored - Successfully processed main logic for user ${authUser.id}.`);
    } catch (error: unknown) {
      console.error(`❌ handleGitHubSignIn: Restored - CAUGHT TOP-LEVEL UNEXPECTED ERROR for user ${authUser.id}:`, error);
      if (error instanceof Error) {
        console.error(`❌ handleGitHubSignIn: Restored - Error name: ${error.name}, message: ${error.message}, stack: ${error.stack}`);
      }
      setAuthError('An unexpected error occurred during sign in.');
    } finally {
      console.log(`🔄 handleGitHubSignIn: Restored - In finally block for user ${authUser.id}. Current loading (before set): ${loading}`);
      if (loading) {
        console.log(`🔄 handleGitHubSignIn: Restored - Calling setLoading(false) in finally for ${authUser.id}.`);
        setLoading(false);
      }
      console.log(`🔄 handleGitHubSignIn: Restored - setLoading(false) called/checked. AuthContext loading state will be false in next render if true now.`);
    }
  }, [loading, ensureDeveloperProfile, fetchDeveloperProfile]);

  useEffect(() => {
    console.log('🔄 AuthProvider: Main useEffect for onAuthStateChange setup.');
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
      console.log(`🔄 AuthProvider: onAuthStateChange event: ${event}`, newSession ? `Session for user ${newSession.user?.id}` : 'No session');
      if (isProcessingAuthStateChangeRef.current && !(event === 'INITIAL_SESSION' && !authUserToProcess)) { // Allow initial session if nothing is processing
        console.log('🔄 AuthProvider: onAuthStateChange event ignored, already processing another or initial processed.');
        return;
      }
      const prevSessionStr = JSON.stringify(prevSessionRef.current);
      const newSessionStr = JSON.stringify(newSession);
      if (prevSessionStr === newSessionStr && event !== 'INITIAL_SESSION' && prevSessionRef.current !== null) {
        console.log('🔄 AuthProvider: Session unchanged and not initial, skipping update.');
        if (!newSession?.user && !user && loading) { setLoading(false); }
        return;
      }
      isProcessingAuthStateChangeRef.current = true;
      console.log('🔄 AuthProvider: Processing new auth state change.');
      prevSessionRef.current = newSession;
      const NUser = newSession?.user ?? null;
      setSession(newSession);
      setUser(NUser);
      setAuthError(null);
      if (NUser) {
        console.log(`🔄 AuthProvider: User ${NUser.id} from event ${event}. Setting loading & queueing.`);
        setLoading(true);
        setAuthUserToProcess(NUser);
        setAuthProcessingEventType(event);
      } else {
        console.log('🔄 AuthProvider: No user from event. Clearing profiles, setting loading false.');
        setUserProfile(null); setDeveloperProfile(null); setLoading(false);
        setAuthUserToProcess(null);
        setAuthProcessingEventType(null);
        isProcessingAuthStateChangeRef.current = false;
      }
    });
    return () => {
      console.log('🔄 AuthProvider: Cleaning up auth subscription.');
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authUserToProcess) {
      console.log(`🔄 AuthProvider: useEffect processing user ${authUserToProcess.id} for event type ${authProcessingEventType}`);
      const processAuthUser = async () => {
        let processed = false;
        try {
          if (authProcessingEventType === 'SIGNED_IN') {
            if (authUserToProcess.app_metadata?.provider === 'github') {
              console.log('🔄 AuthProvider (useEffect): GitHub sign-in, calling handleGitHubSignIn.');
              await handleGitHubSignIn(authUserToProcess); processed = true;
            } else {
              console.log('🔄 AuthProvider (useEffect): Non-GitHub sign-in, calling fetchUserProfile.');
              await fetchUserProfile(authUserToProcess); processed = true;
            }
          } else if (authProcessingEventType === 'INITIAL_SESSION' || authProcessingEventType === 'USER_UPDATED' || authProcessingEventType === 'TOKEN_REFRESHED' || authProcessingEventType === 'MANUAL_REFRESH') {
            console.log(`🔄 AuthProvider (useEffect): Event ${authProcessingEventType}, calling fetchUserProfile.`);
            await fetchUserProfile(authUserToProcess); processed = true;
          } else {
            console.log(`🔄 AuthProvider (useEffect): Unhandled event ${authProcessingEventType}, attempting fetchUserProfile.`);
            await fetchUserProfile(authUserToProcess); processed = true;
          }
        } catch (e) {
          console.error('❌ AuthProvider (useEffect): Error during decoupled auth processing:', e);
          setAuthError(e instanceof Error ? e.message : 'Unexpected error in decoupled processing.');
          if(loading) setLoading(false);
        } finally {
          console.log(`🔄 AuthProvider (useEffect): Finished processing for ${authUserToProcess.id}. Clearing authUserToProcess. Processed flag: ${processed}`);
          setAuthUserToProcess(null);
          setAuthProcessingEventType(null);
          // setLoading(false) is handled by the specific function (handleGitHubSignIn/fetchUserProfile)
          isProcessingAuthStateChangeRef.current = false;
          console.log('🔄 AuthProvider (useEffect): Reset isProcessingAuthStateChangeRef.');
        }
      };
      processAuthUser();
    }
  }, [authUserToProcess, authProcessingEventType, handleGitHubSignIn, fetchUserProfile, loading]); // Added loading to ensure re-check if it changes externally

  // Other methods like signUp, signIn, etc.
  const signUp = async (email: string, password: string, userData: Partial<User>): Promise<{ data?: any; error: any | null }> => {
    try {
      setAuthError(null); setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { name: userData.name, role: userData.role } }
      });
      if (error) { setAuthError(error.message); setLoading(false); return { error }; }
      if (data.user) {
         // onAuthStateChange will pick this up and trigger profile creation via setAuthUserToProcess
      } else {
        setLoading(false); // No user from signUp, so stop loading
      }
      return { data, error: null };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage); setLoading(false); return { error: { message: errorMessage } };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ user: SupabaseUser | null; error: any | null }> => {
    try {
      setAuthError(null); setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setAuthError(error.message); setLoading(false); return { user: null, error }; }
      // onAuthStateChange will handle the SIGNED_IN event. setLoading(false) will be handled by that flow.
      return { user: data.user, error: null };
    } catch (error: any) {
      setAuthError('An unexpected error occurred during sign in.'); setLoading(false);
      return { user: null, error };
    }
  };

  const signInWithGitHub = async (stateParams?: Record<string, any>) => {
    setAuthError(null); setLoading(true);
    const name = localStorage.getItem('gittalent_signup_name') || '';
    const role = localStorage.getItem('gittalent_signup_role') || 'developer';
    const stateObj = { name, role: role || 'developer', install_after_auth: true, ...(stateParams || {}) };
    const redirectTo = `${window.location.origin}/auth/callback`;
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo, scopes: 'read:user user:email', state: JSON.stringify(stateObj) } });
      if (error) { throw error; } // setLoading(false) will be handled if error caught by caller or if auth fails to change state
      return { error: null };
    } catch (error: any) {
      setAuthError(error.message || 'Failed to sign in with GitHub'); setLoading(false);
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
      setSigningOut(true); setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) { setAuthError(error.message); return { error }; }
      // State clearing and setLoading(false) handled by onAuthStateChange for SIGNED_OUT
      return { error: null };
    } catch (error: any) {
      setAuthError('An unexpected error occurred during sign out.');
      return { error };
    } finally {
      setSigningOut(false);
      // setLoading(false) should be managed by onAuthStateChange or if error caught above
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

  const refreshProfile = useCallback(async () => {
    if (!user) {
      console.warn('🔄 refreshProfile: No user to refresh.');
      return;
    }
    console.log('🔄 refreshProfile: Refreshing profiles for user:', user.id);
    setLoading(true); // Indicate loading starts
    setAuthUserToProcess(user);
    setAuthProcessingEventType('MANUAL_REFRESH');
  }, [user]); // Dependencies: user, (setLoading, setAuthUserToProcess, setAuthProcessingEventType are stable)

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