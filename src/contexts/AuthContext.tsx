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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const latestSessionRef = useRef<string | null>(null); // Used to compare incoming sessions
  const isProcessingAuthEventRef = useRef(false); // Guards the new useEffect processor

  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [developerProfile, setDeveloperProfile] = useState<Developer | null | undefined>(null);
  const [lastProfileUpdateTime, setLastProfileUpdateTime] = useState<number | null>(null); // New state
  const [loading, setLoading] = useState(true); // Global loading for auth context
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [authUserToProcess, setAuthUserToProcess] = useState<SupabaseUser | null>(null);
  const [authProcessingEventType, setAuthProcessingEventType] = useState<string | null>(null);
  const [onRefreshComplete, setOnRefreshComplete] = useState<(() => void) | null>(null);

  async function ensureUserProfileExists() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('Failed to get session:', sessionError);
      return;
    }

    const user = session.user;

    const { error: rpcError } = await supabase.rpc('create_user_profile', {
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.name || user.email,
      user_role: localStorage.getItem('gittalent_signup_role') || 'developer',
      company_name: localStorage.getItem('gittalent_signup_company_name') || ''
    });

    if (rpcError) {
      console.error('Failed to call create_user_profile RPC:', rpcError.message);
    } else {
      console.log('User profile created or already exists.');
    }
  }

  const ensureDeveloperProfile = useCallback(async (authUser: SupabaseUser, currentDeveloperProfile: Developer | null | undefined): Promise<boolean> => {
    try {
      const { data: existingProfileFromDb, error: checkError } = await supabase.from('developers').select('*').eq('user_id', authUser.id).maybeSingle();
      if (checkError && checkError.code !== 'PGRST116') { console.error(`ensureDeveloperProfile: Error checking for ${authUser.id}:`, checkError); return false; }

      const githubUsername = authUser.user_metadata?.login || authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || '';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const userBio = authUser.user_metadata?.bio || '';
      const userLocation = authUser.user_metadata?.location || '';
      const currentGhInstIdInState = currentDeveloperProfile?.github_installation_id; // Get ID from current React state

      if (existingProfileFromDb) {
        let profileToSet = { ...existingProfileFromDb }; // Clone to make mutable

        // Preserve ghInstId from state if DB is null and state has a valid one
        if ((profileToSet.github_installation_id === null || profileToSet.github_installation_id === undefined) && currentGhInstIdInState) {
          console.log(`[AuthContext] ensureDeveloperProfile (existing): Preserving ghInstId (${currentGhInstIdInState}) from state over DB's null.`);
          profileToSet.github_installation_id = currentGhInstIdInState;
        }
        
        let needsUpdate = false;
        const updates: Partial<Developer> = {};
        if (githubUsername && profileToSet.github_handle !== githubUsername) {
          updates.github_handle = githubUsername;
          needsUpdate = true;
        }
        if (avatarUrl && !profileToSet.profile_pic_url) {
          updates.profile_pic_url = avatarUrl;
          needsUpdate = true;
        }
         if (userBio && profileToSet.bio !== userBio) {
          updates.bio = userBio;
          needsUpdate = true;
        }
        if (userLocation && profileToSet.location !== userLocation) {
          updates.location = userLocation;
          needsUpdate = true;
        }

        if (needsUpdate) {
          const { data: updatedProfileFromDb, error: updateError } = await supabase.from('developers').update(updates).eq('user_id', authUser.id).select().single();
          if (updateError) {
            console.error(`ensureDeveloperProfile: Error updating developer profile for ${authUser.id}:`, updateError);
            // Even if update fails, proceed with profileToSet which has the original existing data + potential ghInstId preservation
          } else if (updatedProfileFromDb) {
            profileToSet = { ...updatedProfileFromDb }; // Use the updated data from DB
            // Preserve ghInstId again if the update somehow nulled it and state still has it
            if ((profileToSet.github_installation_id === null || profileToSet.github_installation_id === undefined) && currentGhInstIdInState) {
              console.log(`[AuthContext] ensureDeveloperProfile (after DB update): Preserving ghInstId (${currentGhInstIdInState}) from state over DB's null.`);
              profileToSet.github_installation_id = currentGhInstIdInState;
            }
          }
        }
        console.log(`[AuthContext] ensureDeveloperProfile (using existing/updated): Setting profile. ghInstId: ${profileToSet.github_installation_id}`);
        setDeveloperProfile(profileToSet);
        setLastProfileUpdateTime(Date.now());
        return true;
      }

      // Creating a new profile
      let newDevProfileData: Partial<Developer> = {
        user_id: authUser.id, 
        github_handle: githubUsername, 
        bio: userBio, 
        location: userLocation,
        profile_pic_url: avatarUrl,
        // github_installation_id: currentGhInstIdInState || null, // Let this be set by GitHubAppSetup or DB default initially
        availability: true
      };
      // Only include github_installation_id in the insert if it's already available in the context's state.
      // For a brand new user, this would typically be null/undefined, so it won't be included,
      // allowing the GitHub app installation callback to set it cleanly.
      if (currentGhInstIdInState) {
         newDevProfileData.github_installation_id = currentGhInstIdInState;
         console.log(`[AuthContext] ensureDeveloperProfile (creating new): Including ghInstId (${currentGhInstIdInState}) from current context state for new profile.`);
      } else {
         console.log(`[AuthContext] ensureDeveloperProfile (creating new): Not including ghInstId in new profile data as it's not in current context state. It should be set by GitHub App installation flow.`);
      }

      const { data: insertedProfile, error: createError } = await supabase.from('developers').insert(newDevProfileData).select().single();
      if (createError) { console.error(`ensureDeveloperProfile: Error creating for ${authUser.id}:`, createError); return false; }
      if (!insertedProfile) { console.error(`ensureDeveloperProfile: No data returned after insert for ${authUser.id}`); return false; }
      
      // The insertedProfile should ideally have the ghInstId if we passed it.
      // If it's different (e.g. DB default took over), and state had one, re-affirm.
      if (insertedProfile.github_installation_id !== currentGhInstIdInState && currentGhInstIdInState) {
          console.log(`[AuthContext] ensureDeveloperProfile (created new, re-affirming): Preserving ghInstId (${currentGhInstIdInState}) over DB insert result ${insertedProfile.github_installation_id}.`);
          insertedProfile.github_installation_id = currentGhInstIdInState;
      }

      console.log(`[AuthContext] ensureDeveloperProfile (created new): Setting profile. ghInstId: ${insertedProfile.github_installation_id}`);
      setDeveloperProfile(insertedProfile);
      setLastProfileUpdateTime(Date.now());
      return true;
    } catch (error) { console.error(`ensureDeveloperProfile: Unexpected error for ${authUser.id}:`, error); return false; }
  }, []);

  const fetchDeveloperProfile = useCallback(async (userId: string, currentDeveloperProfile: Developer | null | undefined): Promise<Developer | null> => {
    try {
      const { data: devProfileFromDb, error } = await supabase.from('developers').select('*').eq('user_id', userId).single();
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[AuthContext] fetchDeveloperProfile: No record found, setting profile to null.');
          setDeveloperProfile(null); // Intentionally null, no ID to preserve
          setLastProfileUpdateTime(Date.now());
          return null;
        }
        else { console.error(`fetchDeveloperProfile: Error for ${userId}:`, error.message); setDeveloperProfile(null); setLastProfileUpdateTime(Date.now()); return null; }
      }
      if (!devProfileFromDb) {
        setDeveloperProfile(null); // Intentionally null
        setLastProfileUpdateTime(Date.now());
        return null;
      }

      let profileToSet = { ...devProfileFromDb };
      const currentGhInstIdInState = currentDeveloperProfile?.github_installation_id;

      if ((profileToSet.github_installation_id === null || profileToSet.github_installation_id === undefined) && currentGhInstIdInState) {
        console.log(`[AuthContext] fetchDeveloperProfile: Preserving ghInstId (${currentGhInstIdInState}) from state over DB's null for user ${userId}.`);
        profileToSet.github_installation_id = currentGhInstIdInState;
      }
      
      console.log(`[AuthContext] fetchDeveloperProfile: Setting profile. ghInstId: ${profileToSet.github_installation_id}`);
      setDeveloperProfile(profileToSet);
      setLastProfileUpdateTime(Date.now());
      return profileToSet;
    } catch (error) { console.error(`fetchDeveloperProfile: Unexpected error for ${userId}:`, error); setDeveloperProfile(null); setLastProfileUpdateTime(Date.now()); return null; }
  }, []);

const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
  setAuthError(null);
  await ensureUserProfileExists();
  console.log(`[AuthContext] fetchUserProfile START for user_id: ${authUser.id}, email: ${authUser.email}`);
  try {
    const { data: profile, error, status } = await supabase // Added status here
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    console.log(`[AuthContext] fetchUserProfile: Initial fetch from 'users' table - Status: ${status}, Error Code: ${error?.code}, Error Message: ${error?.message}, Profile Data:`, profile);

    // PGRST116 is the error code when .single() finds no rows, which can result in status 406.
    if (error && error.code === 'PGRST116') { // This also covers the 406 scenario for .single()
      console.log(`[AuthContext] fetchUserProfile: Profile not found for ${authUser.id} (PGRST116 / implies 406 with .single()). Attempting to create via RPC.`);
      
      const userRole = localStorage.getItem('gittalent_signup_role') || authUser.user_metadata?.role || (authUser.app_metadata?.provider === 'github' ? 'developer' : 'recruiter');
      const userName = localStorage.getItem('gittalent_signup_name') || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.login || authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || 'User';
      const companyName = localStorage.getItem('gittalent_signup_company_name') || authUser.user_metadata?.company_name || '';
      
      console.log(`[AuthContext] fetchUserProfile: RPC 'create_user_profile' params: user_id=${authUser.id}, email=${authUser.email || 'unknown@example.com'}, name=${userName}, role=${userRole}, company=${companyName}`);

      const { error: rpcError } = await supabase.rpc(
        'create_user_profile',
        { user_id: authUser.id, user_email: authUser.email || 'unknown@example.com', user_name: userName, user_role: userRole, company_name: companyName }
      );

      if (rpcError) {
        console.error(`[AuthContext] fetchUserProfile: Error creating profile via RPC for ${authUser.id}:`, rpcError);
        setAuthError('Failed to create your profile: ' + rpcError.message);
        return null;
      }
      
      console.log(`[AuthContext] fetchUserProfile: RPC 'create_user_profile' successful for ${authUser.id}. Attempting to fetch newly created profile.`);
      const { data: newProfile, error: fetchErrorAfterRpc, status: fetchStatusAfterRpc } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      console.log(`[AuthContext] fetchUserProfile: Fetch after RPC - Status: ${fetchStatusAfterRpc}, Error Code: ${fetchErrorAfterRpc?.code}, Error Message: ${fetchErrorAfterRpc?.message}, New Profile Data:`, newProfile);

      if (fetchErrorAfterRpc) {
        console.error(`[AuthContext] fetchUserProfile: Error fetching newly created profile for ${authUser.id}:`, fetchErrorAfterRpc);
        setAuthError('Failed to load your profile after creation.');
        return null;
      }
      
      if (!newProfile) {
        console.error(`[AuthContext] fetchUserProfile: Profile still not found for ${authUser.id} after RPC creation and re-fetch. This is unexpected.`);
        setAuthError('Profile creation seemed to succeed but could not be retrieved.');
        return null;
      }
      
      console.log(`[AuthContext] fetchUserProfile: Profile created and fetched successfully for ${authUser.id}.`);
      setUserProfile(newProfile); // Set the main user profile
      if (newProfile.role === 'developer') {
        console.log(`[AuthContext] fetchUserProfile: User role is 'developer'. Calling ensureDeveloperProfile for ${authUser.id}.`);
        await ensureDeveloperProfile(authUser, developerProfile);
      }
      return newProfile;

    } else if (error) { // Other errors during initial fetch (not PGRST116)
      console.error(`[AuthContext] fetchUserProfile: Non-PGRST116 error fetching profile for ${authUser.id}: Code: ${error.code}, Message: ${error.message}`);
      setAuthError('Failed to load your profile.'); return null;
    }

    // Profile existed, fetched successfully on the first try
    if (!profile) {
        console.error(`[AuthContext] fetchUserProfile: Initial fetch successful (no error, no PGRST116) but profile data is null/undefined for ${authUser.id}. This is unexpected.`);
        setAuthError('Profile data was unexpectedly empty after fetch.');
        return null;
    }
      
    console.log(`[AuthContext] fetchUserProfile: Profile existed and fetched successfully for ${authUser.id}.`);
    setUserProfile(profile);
    if (profile.role === 'developer') {
      console.log(`[AuthContext] fetchUserProfile: User role is 'developer'. Calling ensureDeveloperProfile for ${authUser.id}.`);
      await ensureDeveloperProfile(authUser, developerProfile);
    }
    return profile;

  } catch (errorCatch) { // Renamed to avoid conflict with 'error' from supabase calls
    console.error(`[AuthContext] fetchUserProfile: Unexpected top-level catch error for ${authUser.id}:`, errorCatch);
    setAuthError('An unexpected error occurred while fetching your profile.'); return null;
  } finally {
    setLoading(false); 
    // The log message below might show stale 'loading' state due to closure.
    // console.log(`[AuthContext] fetchUserProfile FINISHED for user_id: ${authUser.id}. Loading: ${loading}`); 
    console.log(`[AuthContext] fetchUserProfile FINISHED for user_id: ${authUser.id}. Loading state will be false.`);
  }
}, [ensureDeveloperProfile, setLoading, setAuthError, setUserProfile]); // Added dependencies based on usage

  const handleGitHubSignIn = useCallback(async (authUser: SupabaseUser) => {
    setAuthError(null);
    try {
      if (!supabase) {
        console.error(`handleGitHubSignIn: Supabase client is null for user ${authUser.id}.`);
        setAuthError("Auth service error."); return;
      }
      await fetchUserProfile(authUser);
    } catch (error: unknown) {
      console.error(`handleGitHubSignIn: CAUGHT TOP-LEVEL UNEXPECTED ERROR for user ${authUser.id}:`, error);
      if (error instanceof Error) {
        console.error(`handleGitHubSignIn: Error name: ${error.name}, message: ${error.message}, stack: ${error.stack}`);
      }
      setAuthError('An unexpected error occurred during sign in.');
    } finally {
      if (loading) {
        setLoading(false);
      }
    }
  }, [loading, fetchUserProfile]);

  useEffect(() => {
    latestSessionRef.current = JSON.stringify(session);

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      const currentSessionStr = JSON.stringify(currentSession);

      setSession(currentSession);
      const initialUser = currentSession?.user ?? null;
      setUser(initialUser);
      latestSessionRef.current = currentSessionStr;

      if (initialUser && !authUserToProcess) {
        setLoading(true);
        setAuthUserToProcess(initialUser);
        setAuthProcessingEventType('INITIAL_SESSION');
      } else if (!initialUser) {
        setLoading(false);
      }
    }).catch(error => {
      console.error('AuthProvider: Error in initial getSession():', error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newSessionStr = JSON.stringify(session);
      if (latestSessionRef.current === newSessionStr && event !== 'INITIAL_SESSION') {
        return;
      }
      latestSessionRef.current = newSessionStr;

      const NUser = session?.user ?? null;
      setSession(session);
      setUser(NUser);
      setAuthError(null);

      if (NUser) {
        setLoading(true);
        setAuthUserToProcess(NUser);
        setAuthProcessingEventType(event);
      } else {
        setUserProfile(null);
        setDeveloperProfile(null);
        setLoading(false);
        setAuthUserToProcess(null);
        setAuthProcessingEventType(null);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authUserToProcess) {
      if (isProcessingAuthEventRef.current) {
        return;
      }
      isProcessingAuthEventRef.current = true;

      const processIt = async () => {
        try {
          if (authProcessingEventType === 'SIGNED_IN') {
            if (authUserToProcess.app_metadata?.provider === 'github') {
              await handleGitHubSignIn(authUserToProcess);
            } else {
              await fetchUserProfile(authUserToProcess);
            }
          } else if (['INITIAL_SESSION', 'USER_UPDATED', 'TOKEN_REFRESHED', 'MANUAL_REFRESH'].includes(authProcessingEventType!)) {
            await fetchUserProfile(authUserToProcess);
          } else {
            // console.warn(`AuthProvider (useEffect): Unhandled event type ${authProcessingEventType} with user, attempting fetchUserProfile as fallback.`);
            await fetchUserProfile(authUserToProcess);
          }
        } catch (e) {
          console.error('AuthProvider (useEffect): Error during decoupled auth processing:', e);
          setAuthError(e instanceof Error ? e.message : 'Unexpected error in decoupled processing.');
          setLoading(false);
        } finally {
          setAuthUserToProcess(null);
          setAuthProcessingEventType(null);
          isProcessingAuthEventRef.current = false;
          if (authProcessingEventType === 'MANUAL_REFRESH' && onRefreshComplete) {
            onRefreshComplete();
            setOnRefreshComplete(null); // Reset the callback
          }
        }
      };
      processIt();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserToProcess, authProcessingEventType, handleGitHubSignIn, fetchUserProfile]);

  const signUp = async (email: string, password: string, userData: Partial<User>): Promise<{ data?: any; error: any | null }> => {
    try {
      setAuthError(null); setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { name: userData.name, role: userData.role } }
      });
      if (error) { setAuthError(error.message); setLoading(false); return { error }; }
      if (data.user && userData.role === 'developer') {
        await createDeveloperProfile(data.user.id, {});
      }
      // onAuthStateChange will pick this up. setLoading(true) remains until processing completes.
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
    
    // Data to be available after OAuth callback
    const intentData = { 
      name, 
      role: role || 'developer', 
      install_after_auth: true, 
      ...(stateParams || {}) 
    };
    localStorage.setItem('oauth_intent_data', JSON.stringify(intentData));
    console.log('[AuthContext] signInWithGitHub: Stored in localStorage oauth_intent_data:', intentData);

    const redirectTo = `${window.location.origin}/auth/callback`; // Standard callback URL
    console.log('[AuthContext] signInWithGitHub: Using redirectTo:', redirectTo);
    try {
      // We don't need to pass our application state in options.state if using localStorage bridge
      // Supabase handles its own state for CSRF if needed.
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'github', 
        options: { 
          redirectTo, 
          scopes: 'read:user user:email'
          // Not passing 'state' here, relying on localStorage bridge for app-specific state
        } 
      });
      if (error) { throw error; }
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
      if (error) { setAuthError(error.message); setLoading(false); return { error }; }
      return { error: null };
    } catch (error: any) {
      setAuthError('An unexpected error occurred during sign out.'); setLoading(false);
      return { error };
    } finally {
      setSigningOut(false);
    }
  };

  const createDeveloperProfile = async (userId: string, profileData: Partial<Developer>): Promise<{ data: any | null; error: any | null }> => {
    try {
      const { data, error } = await supabase.from('developers').insert([{ user_id: userId, ...profileData }]).select().single();
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

  const refreshProfile = useCallback(async (onComplete?: () => void) => {
    if (!user) {
      onComplete?.();
      return;
    }

    setLoading(true);

    // Invalidate the cache for the 'users' table for the specific user
    await supabase.from('users').select('*').eq('id', user.id).then(({ data, error }) => {
      if (error) console.error("Cache invalidation might not be fully effective:", error);
    });

    if (onComplete) {
      setOnRefreshComplete(() => onComplete);
    }

    setAuthUserToProcess(user);
    setAuthProcessingEventType('MANUAL_REFRESH');
  }, [user, supabase]);

  const setResolvedDeveloperProfile = useCallback((developerData: Developer) => {
    console.log('[AuthContext] setResolvedDeveloperProfile called with:', developerData);
    if (developerData && typeof developerData === 'object' && developerData.user_id) {
      console.log(`[AuthContext] setResolvedDeveloperProfile: Setting profile. ghInstId from input data: ${developerData.github_installation_id}`);
      setDeveloperProfile(developerData);
      setLastProfileUpdateTime(Date.now()); // Update time
    } else {
      console.warn('[AuthContext] setResolvedDeveloperProfile called with invalid data, not setting:', developerData);
    }
  }, [setDeveloperProfile, setLastProfileUpdateTime]); // Added dependencies


  const value: AuthContextType = {
    user, session, userProfile, developerProfile, loading, authError, signingOut,
    lastProfileUpdateTime,
    signUp, signIn, signInWithGitHub, connectGitHubApp, signOut,
    createDeveloperProfile, updateDeveloperProfile, createJobRole, updateJobRole,
    createAssignment, createHire, updateUserApprovalStatus, updateProfileStrength,
    refreshProfile,
    refreshUserProfile: refreshProfile,
    setResolvedDeveloperProfile, // This is the one called by GitHubAppSetup
    needsOnboarding: !developerProfile && userProfile?.role === 'developer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
