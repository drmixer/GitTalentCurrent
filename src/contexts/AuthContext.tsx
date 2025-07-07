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
  const [loading, setLoading] = useState(true); // Global loading for auth context
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [authUserToProcess, setAuthUserToProcess] = useState<SupabaseUser | null>(null);
  const [authProcessingEventType, setAuthProcessingEventType] = useState<string | null>(null);

  const ensureDeveloperProfile = useCallback(async (authUser: SupabaseUser): Promise<boolean> => {
    console.log(`🔄 ensureDeveloperProfile for user ${authUser.id}`);
    console.log(`ℹ️ ensureDeveloperProfile: authUser.user_metadata for ${authUser.id}:`, JSON.stringify(authUser.user_metadata, null, 2));
    try {
      const { data: existingProfile, error: checkError } = await supabase.from('developers').select('*').eq('user_id', authUser.id).maybeSingle();
      if (checkError && checkError.code !== 'PGRST116') { console.error(`❌ ensureDeveloperProfile: Error checking for ${authUser.id}:`, checkError); return false; }

      const githubUsername = authUser.user_metadata?.login || authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || '';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const userBio = authUser.user_metadata?.bio || '';
      const userLocation = authUser.user_metadata?.location || '';
      // installationId is NOT sourced from user_metadata here; it's updated by GitHubAppSetup flow

      if (existingProfile) {
        console.log(`✅ ensureDeveloperProfile: Developer profile already exists for user ${authUser.id}.`);
        let needsUpdate = false;
        const updates: Partial<Developer> = {};
        if (githubUsername && existingProfile.github_handle !== githubUsername) {
          updates.github_handle = githubUsername;
          needsUpdate = true;
        }
        // Potentially update other fields like avatar_url, bio, location if they can change
        if (avatarUrl && existingProfile.profile_pic_url !== avatarUrl) {
          updates.profile_pic_url = avatarUrl;
          needsUpdate = true;
        }
         if (userBio && existingProfile.bio !== userBio) {
          updates.bio = userBio;
          needsUpdate = true;
        }
        if (userLocation && existingProfile.location !== userLocation) {
          updates.location = userLocation;
          needsUpdate = true;
        }

        if (needsUpdate) {
          console.log(`🔄 ensureDeveloperProfile: Updating existing developer profile for ${authUser.id} with new metadata:`, updates);
          const { data: updatedProfile, error: updateError } = await supabase.from('developers').update(updates).eq('user_id', authUser.id).select().single();
          if (updateError) {
            console.error(`❌ ensureDeveloperProfile: Error updating developer profile for ${authUser.id}:`, updateError);
            // Don't return false, just means update failed, but profile exists
          } else if (updatedProfile) {
            console.log(`✅ ensureDeveloperProfile: Developer profile updated for ${authUser.id}. Calling setDeveloperProfile.`);
            setDeveloperProfile(updatedProfile);
            console.log(`🔄 ensureDeveloperProfile: setDeveloperProfile call completed for ${authUser.id}.`);
            return true;
          }
        } else {
           console.log(`🔄 ensureDeveloperProfile: Existing developer profile for ${authUser.id} is up-to-date. Calling setDeveloperProfile.`);
        }
        setDeveloperProfile(existingProfile); // Set it even if no update, to ensure state is fresh
        console.log(`🔄 ensureDeveloperProfile: setDeveloperProfile call completed for ${authUser.id} (existing).`);
        return true;
      }

      console.log(`🔄 ensureDeveloperProfile: No existing developer profile for ${authUser.id}. Creating new one.`);
      const githubInstallationId = null; // This will be set by GitHubAppSetup flow
      console.log(`🔄 ensureDeveloperProfile: Creating new developer profile for ${authUser.id} with GitHub handle: '${githubUsername}'`);
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
    try {
      console.log(`🔄 fetchUserProfile: User metadata for ${authUser.id} (used for role/name if creating):`, JSON.stringify(authUser.user_metadata, null, 2));
      const { data: profile, error } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (error && error.code === 'PGRST116') {
        console.log(`🔄 fetchUserProfile: Profile not found for ${authUser.id}, creating one.`);
        const userRole = localStorage.getItem('gittalent_signup_role') || authUser.user_metadata?.role || (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
        const userName = localStorage.getItem('gittalent_signup_name') || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.login || authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || 'GitHub User';
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
        await ensureDeveloperProfile(authUser); // Ensure dev profile exists and handle is up-to-date
      }
      return profile;
    } catch (error) {
      console.error(`❌ fetchUserProfile: Unexpected error for ${authUser.id}:`, error);
      setAuthError('An unexpected error occurred while fetching your profile.'); return null;
    } finally {
      console.log(`🔄 fetchUserProfile: In finally block for ${authUser.id}.`);
      console.log(`🔄 fetchUserProfile: Calling setLoading(false) for ${authUser.id}.`);
      setLoading(false); // This function now manages its own loading state when called.
      console.log(`🔄 fetchUserProfile: setLoading(false) completed for ${authUser.id}.`);
    }
  }, [ensureDeveloperProfile]);

  const handleGitHubSignIn = useCallback(async (authUser: SupabaseUser) => {
    console.log(`🔄 handleGitHubSignIn: Processing GitHub sign-in for user: ${authUser.id}`);
    console.log(`ℹ️ handleGitHubSignIn: authUser.user_metadata for ${authUser.id}:`, JSON.stringify(authUser.user_metadata, null, 2));
    setAuthError(null);
    try {
      console.log(`🔄 handleGitHubSignIn: Entered TRY block for user ${authUser.id}.`);
      if (!supabase) {
        console.error(`❌ handleGitHubSignIn: Supabase client is null for user ${authUser.id}.`);
        setAuthError("Auth service error."); return;
      }
      // Directly call fetchUserProfile which contains all logic for user and developer profile creation/update.
      await fetchUserProfile(authUser);
      console.log(`✅ handleGitHubSignIn: fetchUserProfile completed for ${authUser.id}.`);
    } catch (error: unknown) {
      console.error(`❌ handleGitHubSignIn: CAUGHT TOP-LEVEL UNEXPECTED ERROR for user ${authUser.id}:`, error);
      if (error instanceof Error) {
        console.error(`❌ handleGitHubSignIn: Error name: ${error.name}, message: ${error.message}, stack: ${error.stack}`);
      }
      setAuthError('An unexpected error occurred during sign in.');
    } finally {
      console.log(`🔄 handleGitHubSignIn: In finally block for user ${authUser.id}. Current loading (before set): ${loading}`);
      if (loading) {
        console.log(`🔄 handleGitHubSignIn: Calling setLoading(false) in finally for ${authUser.id}.`);
        setLoading(false);
      }
      console.log(`🔄 handleGitHubSignIn: setLoading(false) call completed/checked. Loading is now (stale read): ${loading}.`);
    }
  }, [loading, fetchUserProfile]); // Added fetchUserProfile

  useEffect(() => {
    console.log('🔄 AuthProvider: Main useEffect for onAuthStateChange setup (runs once).');
    latestSessionRef.current = JSON.stringify(session); // Initialize with current session state if any

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => { // Make async
      console.log('🔄 AuthProvider: Initial getSession() result:', currentSession ? `Session for ${currentSession.user.id}` : 'No session');
      const currentSessionStr = JSON.stringify(currentSession);

      // Set initial states
      setSession(currentSession);
      const initialUser = currentSession?.user ?? null;
      setUser(initialUser);
      latestSessionRef.current = currentSessionStr;

      if (initialUser && !authUserToProcess) {
        console.log(`🔄 AuthProvider: User ${initialUser.id} from getSession(), queueing for INITIAL_SESSION style processing.`);
        setLoading(true);
        setAuthUserToProcess(initialUser);
        setAuthProcessingEventType('INITIAL_SESSION');
      } else if (!initialUser) {
        setLoading(false);
      }
    }).catch(error => {
      console.error('❌ AuthProvider: Error in initial getSession():', error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔄 AuthProvider: onAuthStateChange event: ${event}`, session ? `Session for user ${session.user?.id}` : 'No session');

      const newSessionStr = JSON.stringify(session);
      if (latestSessionRef.current === newSessionStr && event !== 'INITIAL_SESSION') {
        console.log('🔄 AuthProvider: onAuthStateChange - Session appears unchanged by content, event:', event, '. Skipping redundant processing trigger.');
        return;
      }
      console.log('🔄 AuthProvider: onAuthStateChange - Session changed or initial. Proceeding.');
      latestSessionRef.current = newSessionStr; // Update ref for next event comparison

      // isProcessingAuthEventRef guards the new useEffect, not this callback directly.
      // This callback should be lean: update basic state and trigger the processing useEffect.
      const NUser = session?.user ?? null;
      setSession(session);
      setUser(NUser);
      setAuthError(null);

      if (NUser) {
        console.log(`🔄 AuthProvider: User ${NUser.id} from onAuthStateChange event ${event}. Setting loading & queueing.`);
        setLoading(true);
        setAuthUserToProcess(NUser);
        setAuthProcessingEventType(event);
      } else {
        console.log('🔄 AuthProvider: No user from onAuthStateChange event. Clearing profiles, loading false.');
        setUserProfile(null);
        setDeveloperProfile(null);
        setLoading(false);
        setAuthUserToProcess(null);
        setAuthProcessingEventType(null);
      }
    });
    return () => {
      console.log('🔄 AuthProvider: Cleaning up onAuthStateChange subscription.');
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array: setup listener once.

  useEffect(() => {
    if (authUserToProcess) {
      if (isProcessingAuthEventRef.current) {
        console.log(`🔄 AuthProvider: useEffect for authUserToProcess - already processing event for user ${authUserToProcess.id}. Ignoring.`);
        return;
      }
      isProcessingAuthEventRef.current = true;
      console.log(`🔄 AuthProvider: useEffect processing user ${authUserToProcess.id} for event type ${authProcessingEventType}`);

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
            console.warn(`🔄 AuthProvider (useEffect): Unhandled event type ${authProcessingEventType} with user, attempting fetchUserProfile as fallback.`);
            await fetchUserProfile(authUserToProcess);
          }
        } catch (e) {
          console.error('❌ AuthProvider (useEffect): Error during decoupled auth processing:', e);
          setAuthError(e instanceof Error ? e.message : 'Unexpected error in decoupled processing.');
          setLoading(false); // Ensure loading is false on direct error in this effect
        } finally {
          console.log(`🔄 AuthProvider (useEffect): Finished processing for ${authUserToProcess.id}. Clearing authUserToProcess.`);
          setAuthUserToProcess(null);
          setAuthProcessingEventType(null);
          isProcessingAuthEventRef.current = false;
          console.log('🔄 AuthProvider (useEffect): Reset isProcessingAuthEventRef.');
          // setLoading(false) is expected to be handled by fetchUserProfile/handleGitHubSignIn's finally
        }
      };
      processIt();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserToProcess, authProcessingEventType, handleGitHubSignIn, fetchUserProfile]); // Dependencies are stable callbacks

  const signUp = async (email: string, password: string, userData: Partial<User>): Promise<{ data?: any; error: any | null }> => {
    try {
      setAuthError(null); setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { name: userData.name, role: userData.role } }
      });
      if (error) { setAuthError(error.message); setLoading(false); return { error }; }
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
    const stateObj = { name, role: role || 'developer', install_after_auth: true, ...(stateParams || {}) };
    const redirectTo = `${window.location.origin}/auth/callback`;
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo, scopes: 'read:user user:email', state: JSON.stringify(stateObj) } });
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
    setLoading(true);
    setAuthUserToProcess(user);
    setAuthProcessingEventType('MANUAL_REFRESH');
  }, [user]);

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