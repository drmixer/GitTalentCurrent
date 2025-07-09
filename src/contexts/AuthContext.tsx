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

  // Helper to preserve a recently set ghInstId if DB returns null for it
  const mergeProfileWithExistingGhId = useCallback((profileFromDbOrNew: Developer): Developer => {
    const currentGhInstIdInState = developerProfile?.github_installation_id;
    // Only preserve if the ID in state was set recently (e.g. by GitHubAppSetup)
    // and the new data from DB has a null/undefined ID.
    const lastUpdateWasRecent = lastProfileUpdateTime && (Date.now() - lastProfileUpdateTime < 5000); // 5 seconds window

    if (
      (profileFromDbOrNew.github_installation_id === null || profileFromDbOrNew.github_installation_id === undefined) &&
      currentGhInstIdInState &&
      lastUpdateWasRecent
    ) {
      console.log(`[AuthContext] mergeProfileWithExistingGhId: Preserving ghInstId (${currentGhInstIdInState}) from recent state over null/undefined from DB/new record for user ${profileFromDbOrNew.user_id}`);
      return { ...profileFromDbOrNew, github_installation_id: currentGhInstIdInState };
    }
    return profileFromDbOrNew;
  }, [developerProfile, lastProfileUpdateTime]); // Dependencies: current developerProfile and its update time

  const ensureDeveloperProfile = useCallback(async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      const { data: existingProfile, error: checkError } = await supabase.from('developers').select('*').eq('user_id', authUser.id).maybeSingle();
      if (checkError && checkError.code !== 'PGRST116') { console.error(`ensureDeveloperProfile: Error checking for ${authUser.id}:`, checkError); return false; }

      const githubUsername = authUser.user_metadata?.login || authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || '';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const userBio = authUser.user_metadata?.bio || '';
      const userLocation = authUser.user_metadata?.location || '';

      if (existingProfile) {
        let needsUpdate = false;
        const updates: Partial<Developer> = {};
        if (githubUsername && existingProfile.github_handle !== githubUsername) {
          updates.github_handle = githubUsername;
          needsUpdate = true;
        }
        // Only set profile_pic_url from GitHub if it's currently empty
        // Custom uploads will be handled by DeveloperProfileForm
        // "Use GitHub Avatar" button will provide explicit override
        if (avatarUrl && !existingProfile.profile_pic_url) {
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
          const { data: updatedProfile, error: updateError } = await supabase.from('developers').update(updates).eq('user_id', authUser.id).select().single();
          if (updateError) {
            console.error(`ensureDeveloperProfile: Error updating developer profile for ${authUser.id}:`, updateError);
          } else if (updatedProfile) {
            const finalUpdatedProfile = mergeProfileWithExistingGhId(updatedProfile);
            console.log(`[AuthContext] ensureDeveloperProfile (updated existing): Setting profile. ghInstId: ${finalUpdatedProfile.github_installation_id}`);
            setDeveloperProfile(finalUpdatedProfile);
            setLastProfileUpdateTime(Date.now());
            return true;
          }
        }
        const finalExistingProfile = mergeProfileWithExistingGhId(existingProfile);
        console.log(`[AuthContext] ensureDeveloperProfile (using existing): Setting profile. ghInstId: ${finalExistingProfile.github_installation_id}`);
        setDeveloperProfile(finalExistingProfile);
        setLastProfileUpdateTime(Date.now());
        return true;
      }

      const githubInstallationId = null; // Default for new profile, should be updated by GitHubAppSetup flow
      const { data: newDevProfileDataFromDb, error: createError } = await supabase.from('developers').insert({
        user_id: authUser.id, github_handle: githubUsername, bio: userBio, location: userLocation,
        profile_pic_url: avatarUrl, github_installation_id: githubInstallationId, availability: true
      }).select().single();
      if (createError) { console.error(`ensureDeveloperProfile: Error creating for ${authUser.id}:`, createError); return false; }
      if (!newDevProfileDataFromDb) { console.error(`ensureDeveloperProfile: No data returned after insert for ${authUser.id}`); return false; }
      const finalNewProfile = mergeProfileWithExistingGhId(newDevProfileDataFromDb);
      console.log(`[AuthContext] ensureDeveloperProfile (created new): Setting profile. ghInstId: ${finalNewProfile.github_installation_id}`);
      setDeveloperProfile(finalNewProfile);
      setLastProfileUpdateTime(Date.now());
      return true;
    } catch (error) { console.error(`ensureDeveloperProfile: Unexpected error for ${authUser.id}:`, error); return false; }
  }, [mergeProfileWithExistingGhId]); // Added mergeProfileWithExistingGhId to dependencies

  const fetchDeveloperProfile = useCallback(async (userId: string): Promise<Developer | null> => {
    try {
      const { data: devProfileFromDb, error } = await supabase.from('developers').select('*').eq('user_id', userId).single();
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[AuthContext] fetchDeveloperProfile: No record found, setting profile to null.');
          setDeveloperProfile(null);
          setLastProfileUpdateTime(Date.now());
          return null;
        }
        else { console.error(`fetchDeveloperProfile: Error for ${userId}:`, error.message); setDeveloperProfile(null); setLastProfileUpdateTime(Date.now()); return null; }
      }
      if (!devProfileFromDb) { // Should be caught by PGRST116, but as a safeguard
        setDeveloperProfile(null);
        setLastProfileUpdateTime(Date.now());
        return null;
      }
      const finalDevProfile = mergeProfileWithExistingGhId(devProfileFromDb);
      console.log(`[AuthContext] fetchDeveloperProfile: Setting profile. ghInstId: ${finalDevProfile?.github_installation_id}`);
      setDeveloperProfile(finalDevProfile);
      setLastProfileUpdateTime(Date.now());
      return finalDevProfile; // Return the potentially merged profile
    } catch (error) { console.error(`fetchDeveloperProfile: Unexpected error for ${userId}:`, error); setDeveloperProfile(null); setLastProfileUpdateTime(Date.now()); return null; }
  }, [mergeProfileWithExistingGhId]); // Added mergeProfileWithExistingGhId to dependencies

  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    setAuthError(null);
    try {
      const { data: profile, error } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (error && error.code === 'PGRST116') {
        const userRole = localStorage.getItem('gittalent_signup_role') || authUser.user_metadata?.role || (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
        const userName = localStorage.getItem('gittalent_signup_name') || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.login || authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || 'GitHub User';
        const companyName = authUser.user_metadata?.company_name || 'Company';
        const { error: rpcError } = await supabase.rpc(
          'create_user_profile',
          { user_id: authUser.id, user_email: authUser.email || 'unknown@example.com', user_name: userName, user_role: userRole, company_name: companyName }
        );
        if (rpcError) { console.error(`fetchUserProfile: Error creating profile via RPC for ${authUser.id}:`, rpcError); setAuthError('Failed to create your profile: ' + rpcError.message); return null; }
        const { data: newProfile, error: fetchError } = await supabase.from('users').select('*').eq('id', authUser.id).single();
        if (fetchError) { console.error(`fetchUserProfile: Error fetching newly created profile for ${authUser.id}:`, fetchError); setAuthError('Failed to load your profile after creation.'); return null; }
        setUserProfile(newProfile);
        if (newProfile.role === 'developer') {
          await ensureDeveloperProfile(authUser);
        }
        return newProfile;
      } else if (error) {
        console.error(`fetchUserProfile: Error fetching profile for ${authUser.id}:`, error);
        setAuthError('Failed to load your profile.'); return null;
      }
      setUserProfile(profile);
      if (profile.role === 'developer') {
        await ensureDeveloperProfile(authUser);
      }
      return profile;
    } catch (error) {
      console.error(`fetchUserProfile: Unexpected error for ${authUser.id}:`, error);
      setAuthError('An unexpected error occurred while fetching your profile.'); return null;
    } finally {
      setLoading(false);
    }
  }, [ensureDeveloperProfile]);

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
      // console.warn('refreshProfile: No user to refresh.'); // Keep this commented or remove if not essential
      return;
    }
    setLoading(true);
    setAuthUserToProcess(user);
    setAuthProcessingEventType('MANUAL_REFRESH');
  }, [user, fetchUserProfile]); // Added fetchUserProfile as it's part of the logic path now

  const setResolvedDeveloperProfile = useCallback((developerData: Developer) => {
    console.log('[AuthContext] setResolvedDeveloperProfile called with:', developerData);
    if (developerData && typeof developerData === 'object' && developerData.user_id) {
      console.log(`[AuthContext] setResolvedDeveloperProfile: Setting profile. ghInstId from input data: ${developerData.github_installation_id}`);
      setDeveloperProfile(developerData);
      setLastProfileUpdateTime(Date.now()); // Update time
    } else {
      console.warn('[AuthContext] setResolvedDeveloperProfile called with invalid data, not setting:', developerData);
    }
  }, []);


  const value: AuthContextType = {
    user, session, userProfile, developerProfile, loading, authError, signingOut,
    lastProfileUpdateTime,
    signUp, signIn, signInWithGitHub, connectGitHubApp, signOut,
    createDeveloperProfile, updateDeveloperProfile, createJobRole, updateJobRole,
    createAssignment, createHire, updateUserApprovalStatus, updateProfileStrength,
    refreshProfile,
    setResolvedDeveloperProfile, // This is the one called by GitHubAppSetup
    needsOnboarding: !developerProfile && userProfile?.role === 'developer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};