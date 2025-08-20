import { createContext, useState, useEffect, ReactNode, useContext, useRef, useCallback } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, Developer, JobRole, Assignment, AuthContextType } from '../types';

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
  const latestSessionRef = useRef<string | null>(null);
  const isProcessingAuthEventRef = useRef(false);

  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [developerProfile, setDeveloperProfile] = useState<Developer | null | undefined>(null);
  const [lastProfileUpdateTime, setLastProfileUpdateTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [authUserToProcess, setAuthUserToProcess] = useState<SupabaseUser | null>(null);
  const [authProcessingEventType, setAuthProcessingEventType] = useState<string | null>(null);
  const [onRefreshComplete, setOnRefreshComplete] = useState<(() => void) | null>(null);

  // NOTE: This helper is used only for debug + ensuring the DB row exists via RPC.
  // The .single() calls here caused 406 errors when the row did not exist yet.
  // We switch both reads to .maybeSingle() so missing rows return null instead of 406.
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

    // CRITICAL DEBUG: Check bio/location BEFORE calling RPC
    console.log('=== BEFORE RPC CALL ===');
    const { data: beforeData } = await supabase
      .from('developers')
      .select('bio, location, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('Bio BEFORE RPC:', beforeData?.bio, 'Location BEFORE RPC:', beforeData?.location);
    console.log('Updated_at BEFORE RPC:', beforeData?.updated_at);

    const rpcParams = {
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.name || user.email,
      user_role: localStorage.getItem('gittalent_signup_role') || 'developer',
      company_name: localStorage.getItem('gittalent_signup_company_name') || '',
    };

    console.log('=== RPC CALL PARAMS ===', rpcParams);

    const { error: rpcError } = await supabase.rpc('create_user_profile', rpcParams);

    // CRITICAL DEBUG: Check bio/location AFTER calling RPC
    console.log('=== AFTER RPC CALL ===');
    const { data: afterData } = await supabase
      .from('developers')
      .select('bio, location, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('Bio AFTER RPC:', afterData?.bio, 'Location AFTER RPC:', afterData?.location);
    console.log('Updated_at AFTER RPC:', afterData?.updated_at);
    console.log('DID RPC CHANGE DATA?', beforeData?.bio !== afterData?.bio || beforeData?.location !== afterData?.location);

    if (rpcError) {
      console.error('Failed to call create_user_profile RPC:', rpcError.message);
    } else {
      console.log('User profile created or already exists.');
    }
  }

  const ensureDeveloperProfile = useCallback(
    async (authUser: SupabaseUser, currentDeveloperProfile: Developer | null | undefined): Promise<boolean> => {
      try {
        const { data: existingProfileFromDb, error: checkError } = await supabase
          .from('developers')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();
        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`ensureDeveloperProfile: Error checking for ${authUser.id}:`, checkError);
          return false;
        }

        const githubUsername =
          authUser.user_metadata?.login ||
          authUser.user_metadata?.user_name ||
          authUser.user_metadata?.preferred_username ||
          '';
        const avatarUrl = authUser.user_metadata?.avatar_url || null;
        // FIXED: Get GitHub metadata but don't use it to overwrite existing data
        const githubBio = authUser.user_metadata?.bio || '';
        const githubLocation = authUser.user_metadata?.location || '';
        const currentGhInstIdInState = currentDeveloperProfile?.github_installation_id;

        if (existingProfileFromDb) {
          let profileToSet = { ...existingProfileFromDb };

          // FIXED: Always preserve the DB installation ID if it exists, don't overwrite with state
          if (existingProfileFromDb.github_installation_id) {
            console.log(
              `[AuthContext] ensureDeveloperProfile (existing): Using github_installation_id from DB: ${existingProfileFromDb.github_installation_id}`,
            );
            profileToSet.github_installation_id = existingProfileFromDb.github_installation_id;
          } else if (currentGhInstIdInState) {
            console.log(
              `[AuthContext] ensureDeveloperProfile (existing): DB has null installation_id, preserving from state: ${currentGhInstIdInState}`,
            );
            profileToSet.github_installation_id = currentGhInstIdInState;
          }

          let needsUpdate = false;
          const updates: Partial<Developer> = {};

          // Update GitHub username if it's available and different
          if (githubUsername && profileToSet.github_handle !== githubUsername) {
            updates.github_handle = githubUsername;
            needsUpdate = true;
          }

          // Update avatar if GitHub has one and we don't have one stored
          if (avatarUrl && !profileToSet.profile_pic_url) {
            updates.profile_pic_url = avatarUrl;
            needsUpdate = true;
          }

          // CRITICAL FIX: Only update bio/location from GitHub if our DB fields are EMPTY
          // This prevents overwriting user-entered data with empty/outdated GitHub data
          if (githubBio && (!profileToSet.bio || profileToSet.bio.trim() === '')) {
            updates.bio = githubBio;
            needsUpdate = true;
            console.log('[AuthContext] ensureDeveloperProfile: Updating empty bio from GitHub metadata');
          } else if (profileToSet.bio && profileToSet.bio.trim() !== '') {
            console.log('[AuthContext] ensureDeveloperProfile: Preserving existing bio, ignoring GitHub metadata');
          }

          if (githubLocation && (!profileToSet.location || profileToSet.location.trim() === '')) {
            updates.location = githubLocation;
            needsUpdate = true;
            console.log('[AuthContext] ensureDeveloperProfile: Updating empty location from GitHub metadata');
          } else if (profileToSet.location && profileToSet.location.trim() !== '') {
            console.log('[AuthContext] ensureDeveloperProfile: Preserving existing location, ignoring GitHub metadata');
          }

          if (needsUpdate) {
            // FIXED: Don't include github_installation_id in updates to avoid overwriting it
            const { data: updatedProfileFromDb, error: updateError } = await supabase
              .from('developers')
              .update(updates)
              .eq('user_id', authUser.id)
              .select()
              .single();

            if (updateError) {
              console.error(
                `ensureDeveloperProfile: Error updating developer profile for ${authUser.id}:`,
                updateError,
              );
            } else if (updatedProfileFromDb) {
              profileToSet = { ...updatedProfileFromDb };
              // FIXED: After update, preserve the installation ID we already determined
              if (existingProfileFromDb.github_installation_id) {
                profileToSet.github_installation_id = existingProfileFromDb.github_installation_id;
              } else if (currentGhInstIdInState) {
                profileToSet.github_installation_id = currentGhInstIdInState;
              }
            }
          }

          console.log(
            `[AuthContext] ensureDeveloperProfile (using existing/updated): Setting profile. ghInstId: ${profileToSet.github_installation_id}`,
          );
          setDeveloperProfile(profileToSet);
          setLastProfileUpdateTime(Date.now());
          return true;
        }

        // Creating new profile - use GitHub data as defaults for new profiles
        let newDevProfileData: Partial<Developer> = {
          user_id: authUser.id,
          github_handle: githubUsername,
          bio: githubBio,
          location: githubLocation,
          profile_pic_url: avatarUrl,
          availability: true,
        };

        if (currentGhInstIdInState) {
          newDevProfileData.github_installation_id = currentGhInstIdInState;
          console.log(
            `[AuthContext] ensureDeveloperProfile (creating new): Including ghInstId (${currentGhInstIdInState}) from current context state for new profile.`,
          );
        } else {
          console.log(
            `[AuthContext] ensureDeveloperProfile (creating new): Not including ghInstId in new profile data as it's not in current context state. It should be set by GitHub App installation flow when available.`,
          );
        }

        const { data: insertedProfile, error: createError } = await supabase
          .from('developers')
          .insert(newDevProfileData)
          .select()
          .single();
        if (createError) {
          console.error(`ensureDeveloperProfile: Error creating for ${authUser.id}:`, createError);
          return false;
        }
        if (!insertedProfile) {
          console.error(`ensureDeveloperProfile: No data returned after insert for ${authUser.id}`);
          return false;
        }

        if (insertedProfile.github_installation_id !== currentGhInstIdInState && currentGhInstIdInState) {
          console.log(
            `[AuthContext] ensureDeveloperProfile (created new, re-affirming): Preserving ghInstId (${currentGhInstIdInState}) over DB insert result ${insertedProfile.github_installation_id}`,
          );
          (insertedProfile as any).github_installation_id = currentGhInstIdInState;
        }

        console.log(
          `[AuthContext] ensureDeveloperProfile (created new): Setting profile. ghInstId: ${insertedProfile.github_installation_id}`,
        );
        setDeveloperProfile(insertedProfile as any);
        setLastProfileUpdateTime(Date.now());
        return true;
      } catch (error) {
        console.error(`ensureDeveloperProfile: Unexpected error for ${authUser.id}:`, error);
        return false;
      }
    },
    [],
  );

  const fetchDeveloperProfile = useCallback(
    async (userId: string, currentDeveloperProfile: Developer | null | undefined): Promise<Developer | null> => {
      try {
        const { data: devProfileFromDb, error } = await supabase
          .from('developers')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log('[AuthContext] fetchDeveloperProfile: No record found, setting profile to null.');
            setDeveloperProfile(null);
            setLastProfileUpdateTime(Date.now());
            return null;
          } else {
            console.error(`fetchDeveloperProfile: Error for ${userId}:`, error.message);
            setDeveloperProfile(null);
            setLastProfileUpdateTime(Date.now());
            return null;
          }
        }

        if (!devProfileFromDb) {
          setDeveloperProfile(null);
          setLastProfileUpdateTime(Date.now());
          return null;
        }

        let profileToSet = { ...devProfileFromDb };
        const currentGhInstIdInState = currentDeveloperProfile?.github_installation_id;

        // FIXED: Always use DB value if it exists, only fallback to state if DB is null
        if (devProfileFromDb.github_installation_id) {
          console.log(
            `[AuthContext] fetchDeveloperProfile: Using github_installation_id from DB: ${devProfileFromDb.github_installation_id}`,
          );
          (profileToSet as any).github_installation_id = devProfileFromDb.github_installation_id;
        } else if (currentGhInstIdInState) {
          console.log(
            `[AuthContext] fetchDeveloperProfile: DB has null installation_id, preserving from state: ${currentGhInstIdInState} for user ${userId}.`,
          );
          (profileToSet as any).github_installation_id = currentGhInstIdInState;
        }

        console.log(
          `[AuthContext] fetchDeveloperProfile: Setting profile. ghInstId: ${(
            profileToSet as any
          ).github_installation_id}`,
        );
        setDeveloperProfile(profileToSet as any);
        setLastProfileUpdateTime(Date.now());
        return profileToSet as any;
      } catch (error) {
        console.error(`fetchDeveloperProfile: Unexpected error for ${userId}:`, error);
        setDeveloperProfile(null);
        setLastProfileUpdateTime(Date.now());
        return null;
      }
    },
    [],
  );

  const fetchUserProfile = useCallback(
    async (authUser: SupabaseUser): Promise<User | null> => {
      setAuthError(null);
      await ensureUserProfileExists();
      console.log(
        `[AuthContext] fetchUserProfile START for user_id: ${authUser.id}, email: ${authUser.email}`,
      );
      try {
        const { data: profile, error, status } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        console.log(
          `[AuthContext] fetchUserProfile: Initial fetch from 'users' table - Status: ${status}, Error Code: ${error?.code}, Error Message: ${error?.message}, Profile Data:`,
          profile,
        );

        if (error && error.code === 'PGRST116') {
          console.log(
            `[AuthContext] fetchUserProfile: Profile not found for ${authUser.id} (PGRST116 / implies 406 with .single()). Attempting to create via RPC.`,
          );

          const userRole =
            localStorage.getItem('gittalent_signup_role') ||
            (authUser.user_metadata as any)?.role ||
            (authUser.app_metadata?.provider === 'github' ? 'developer' : 'recruiter');

          const userName =
            localStorage.getItem('gittalent_signup_name') ||
            (authUser.user_metadata as any)?.full_name ||
            authUser.user_metadata?.name ||
            (authUser.user_metadata as any)?.login ||
            authUser.email ||
            'User';

          const companyName =
            localStorage.getItem('gittalent_signup_company_name') ||
            (authUser.user_metadata as any)?.company_name ||
            '';

          console.log(
            `[AuthContext] fetchUserProfile: RPC 'create_user_profile' params: user_id=${authUser.id}, email=${authUser.email ||
              'unknown@example.com'}, name=${userName}, role=${userRole}, company_name=${companyName}`,
          );

          const { error: rpcError } = await supabase.rpc('create_user_profile', {
            user_id: authUser.id,
            user_email: authUser.email || 'unknown@example.com',
            user_name: userName,
            user_role: userRole,
            company_name: companyName,
          });

          if (rpcError) {
            console.error(
              `[AuthContext] fetchUserProfile: Error creating profile via RPC for ${authUser.id}:`,
              rpcError,
            );
            setAuthError('Failed to create your profile: ' + rpcError.message);
            return null;
          }

          console.log(
            `[AuthContext] fetchUserProfile: RPC 'create_user_profile' successful for ${authUser.id}. Attempting to fetch newly created profile.`,
          );
          const {
            data: newProfile,
            error: fetchErrorAfterRpc,
            status: fetchStatusAfterRpc,
          } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          console.log(
            `[AuthContext] fetchUserProfile: Fetch after RPC - Status: ${fetchStatusAfterRpc}, Error Code: ${fetchErrorAfterRpc?.code}, Error Message: ${fetchErrorAfterRpc?.message}`,
          );

          if (fetchErrorAfterRpc) {
            console.error(
              `[AuthContext] fetchUserProfile: Error fetching newly created profile for ${authUser.id}:`,
              fetchErrorAfterRpc,
            );
            setAuthError('Failed to load your profile after creation.');
            return null;
          }

          if (!newProfile) {
            console.error(
              `[AuthContext] fetchUserProfile: Profile still not found for ${authUser.id} after RPC creation and re-fetch. This is unexpected.`,
            );
            setAuthError('Profile creation seemed to succeed but could not be retrieved.');
            return null;
          }

          console.log(
            `[AuthContext] fetchUserProfile: Profile created and fetched successfully for ${authUser.id}.`,
          );
          setUserProfile(newProfile);
          if (newProfile.role === 'developer') {
            console.log(
              `[AuthContext] fetchUserProfile: User role is 'developer'. Calling ensureDeveloperProfile for ${authUser.id}.`,
            );
            await ensureDeveloperProfile(authUser, developerProfile);
          }
          return newProfile;
        } else if (error) {
          console.error(
            `[AuthContext] fetchUserProfile: Non-PGRST116 error fetching profile for ${authUser.id}: Code: ${error.code}, Message: ${error.message}`,
          );
          setAuthError('Failed to load your profile.');
          return null;
        }

        if (!profile) {
          console.error(
            `[AuthContext] fetchUserProfile: Initial fetch successful (no error, no PGRST116) but profile data is null/undefined for ${authUser.id}. This is unexpected.`,
          );
          setAuthError('Profile data was unexpectedly empty after fetch.');
          return null;
        }

        console.log(
          `[AuthContext] fetchUserProfile: Profile existed and fetched successfully for ${authUser.id}.`,
        );
        setUserProfile(profile);
        if (profile.role === 'developer') {
          console.log(
            `[AuthContext] fetchUserProfile: User role is 'developer'. Calling ensureDeveloperProfile for ${authUser.id}.`,
          );
          await ensureDeveloperProfile(authUser, developerProfile);
        }
        return profile;
      } catch (errorCatch) {
        console.error(
          `[AuthContext] fetchUserProfile: Unexpected top-level catch error for ${authUser.id}:`,
          errorCatch,
        );
        setAuthError('An unexpected error occurred while fetching your profile.');
        return null;
      } finally {
        setLoading(false);
        console.log(
          `[AuthContext] fetchUserProfile FINISHED for user_id: ${authUser.id}. Loading state will be false.`,
        );
      }
    },
    [ensureDeveloperProfile],
  );

  const handleGitHubSignIn = useCallback(
    async (authUser: SupabaseUser) => {
      setAuthError(null);
      try {
        if (!supabase) {
          console.error(`handleGitHubSignIn: Supabase client is null for user ${authUser.id}.`);
          setAuthError('Auth service error.');
          return;
        }
        await fetchUserProfile(authUser);
      } catch (error: unknown) {
        console.error(
          `handleGitHubSignIn: CAUGHT TOP-LEVEL UNEXPECTED ERROR for user ${authUser.id}:`,
          error,
        );
        if (error instanceof Error) {
          console.error(
            `handleGitHubSignIn: Error name: ${error.name}, message: ${error.message}, stack: ${error.stack}`,
          );
        }
        setAuthError('An unexpected error occurred during sign in.');
      } finally {
        if (loading) {
          setLoading(false);
        }
      }
    },
    [loading, fetchUserProfile],
  );

  // GitHub callback success handler
  const handleGitHubCallbackSuccess = useCallback(async (sessionData: any, developerProfileData?: any) => {
    try {
      console.log('[AuthContext] handleGitHubCallbackSuccess: Setting session data', sessionData);

      // Set the session in Supabase
      const { data: session, error: sessionError } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });

      if (sessionError) {
        console.error('[AuthContext] handleGitHubCallbackSuccess: Session error', sessionError);
        throw sessionError;
      }

      console.log('[AuthContext] handleGitHubCallbackSuccess: Session set successfully', session);

      // Set developer profile if provided
      if (developerProfileData) {
        console.log(
          '[AuthContext] handleGitHubCallbackSuccess: Setting developer profile',
          developerProfileData,
        );
        setResolvedDeveloperProfile(developerProfileData);
      }

      // The auth state change listener will handle the rest
      return { success: true };
    } catch (error) {
      console.error('[AuthContext] handleGitHubCallbackSuccess: Error', error);
      return { error };
    }
  }, []);

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean): Promise<boolean> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update approval status');
      }

      if (isApproved) {
        const { data, error } = await supabase.functions.invoke('approve-recruiter', {
          body: { userId },
        });

        if (error) throw error;
        if ((data as any).error) throw new Error((data as any).error);

        return (data as any).success;
      } else {
        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) {
          console.error('Error deleting user:', error);
          return false;
        }
        return true;
      }
    } catch (error: any) {
      console.error('Caught error in updateUserApprovalStatus:', error);
      return false;
    }
  };

  const updateProfileStrength = async (
    userId: string,
    strength: number,
  ): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update profile strength');
      }
      const { data, error } = await supabase
        .from('users')
        .update({ profile_strength: strength })
        .eq('id', userId)
        .select()
        .single();
      if (error) {
        throw error;
      }
      if (userId === user.id) {
        setUserProfile(data);
      }
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const refreshProfile = useCallback(
    async (onComplete?: () => void) => {
      if (!user) {
        onComplete?.();
        return;
      }

      setLoading(true);

      await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('Cache invalidation might not be fully effective:', error);
        });

      if (onComplete) {
        setOnRefreshComplete(() => onComplete);
      }

      setAuthUserToProcess(user);
      setAuthProcessingEventType('MANUAL_REFRESH');
    },
    [user],
  );

  const setResolvedDeveloperProfile = useCallback(
    (developerData: Developer) => {
      console.log('[AuthContext] setResolvedDeveloperProfile called with:', developerData);
      if (developerData && typeof developerData === 'object' && (developerData as any).user_id) {
        console.log(
          `[AuthContext] setResolvedDeveloperProfile: Setting profile. ghInstId from input data: ${(developerData as any).github_installation_id}`,
        );
        setDeveloperProfile(developerData);
        setLastProfileUpdateTime(Date.now());
      } else {
        console.warn(
          '[AuthContext] setResolvedDeveloperProfile called with invalid data, not setting:',
          developerData,
        );
      }
    },
    [setDeveloperProfile],
  );

  useEffect(() => {
    latestSessionRef.current = JSON.stringify(session);

    supabase.auth
      .getSession()
      .then(async ({ data: { session: currentSession } }) => {
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
      })
      .catch(error => {
        console.error('AuthProvider: Error in initial getSession():', error);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
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
          } else if (
            ['INITIAL_SESSION', 'USER_UPDATED', 'TOKEN_REFRESHED', 'MANUAL_REFRESH'].includes(
              authProcessingEventType!,
            )
          ) {
            await fetchUserProfile(authUserToProcess);
          } else {
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
            setOnRefreshComplete(null);
          }
        }
      };
      processIt();
    }
  }, [authUserToProcess, authProcessingEventType, handleGitHubSignIn, fetchUserProfile]);

  const signUp = async (
    email: string,
    password: string,
    userData: Partial<User>,
  ): Promise<{ data?: any; error: any | null }> => {
    try {
      setAuthError(null);
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: userData.name, role: userData.role } },
      });
      if (error) {
        setAuthError(error.message);
        setLoading(false);
        return { error };
      }
      if (data.user && userData.role === 'developer') {
        await createDeveloperProfile(data.user.id, {});
      }
      return { data, error: null };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      setLoading(false);
      return { error: { message: errorMessage } };
    }
  };

  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ user: SupabaseUser | null; error: any | null }> => {
    try {
      setAuthError(null);
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        setLoading(false);
        return { user: null, error };
      }
      return { user: data.user, error: null };
    } catch (error: any) {
      setAuthError('An unexpected error occurred during sign in.');
      setLoading(false);
      return { user: null, error };
    }
  };

  // Differentiates between signup and login for GitHub flow
  const signInWithGitHub = async (isSignup: boolean = false, stateParams?: Record<string, any>) => {
    setAuthError(null);
    setLoading(true);

    const name = localStorage.getItem('gittalent_signup_name') || '';
    const role = localStorage.getItem('gittalent_signup_role') || 'developer';

    // Store intent data for the GitHub callback to use
    const intentData = {
      name,
      role: role || 'developer',
      ...(stateParams || {}),
    };
    localStorage.setItem('github_auth_intent', JSON.stringify(intentData));
    console.log(
      `[AuthContext] signInWithGitHub: ${isSignup ? 'Signup' : 'Login'} flow - Stored github_auth_intent:`,
      intentData,
    );

    try {
      const baseUrl = window.location.origin;
      const redirectUri = `${baseUrl}/auth/github-callback`;

      // Construct state parameter with our application data
      const stateData = {
        redirect_uri: redirectUri,
        intent: intentData,
        timestamp: Date.now(),
        flow_type: isSignup ? 'signup' : 'login',
      };
      const stateParam = encodeURIComponent(JSON.stringify(stateData));

      let githubUrl: string;

      if (isSignup) {
        // NEW USERS: GitHub App installation (gets repository access + authentication)
        githubUrl = `https://github.com/apps/gittalentapp/installations/new?state=${stateParam}`;
        console.log(
          '[AuthContext] signInWithGitHub: SIGNUP flow - Redirecting to GitHub App installation:',
          githubUrl,
        );
      } else {
        // EXISTING USERS: Direct OAuth authorization (authenticates)
        const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        if (!githubClientId) {
          throw new Error('GitHub Client ID not configured');
        }
        githubUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(
          redirectUri,
        )}&state=${stateParam}&scope=read:user user:email`;
        console.log(
          '[AuthContext] signInWithGitHub: LOGIN flow - Redirecting to GitHub OAuth authorization:',
          githubUrl,
        );
      }

      window.location.href = githubUrl;

      return { error: null };
    } catch (error: any) {
      setAuthError(error.message || 'Failed to sign in with GitHub');
      setLoading(false);
      return { error };
    }
  };

  const connectGitHubApp = async (): Promise<{ error: any | null; success?: boolean }> => {
    try {
      setAuthError(null);
      if (!user) {
        throw new Error('User must be authenticated to connect GitHub App');
      }
      const GITHUB_APP_SLUG = 'GitTalentApp';
      const stateParam = encodeURIComponent(
        JSON.stringify({
          user_id: user.id,
          from_app: true,
          redirect_uri: `${window.location.origin}/github-setup`,
        }),
      );
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
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(error.message);
        setLoading(false);
        return { error };
      }
      return { error: null };
    } catch (error: any) {
      setAuthError('An unexpected error occurred during sign out.');
      setLoading(false);
      return { error };
    } finally {
      setSigningOut(false);
    }
  };

  const createDeveloperProfile = async (
    userId: string,
    profileData: Partial<Developer>,
  ): Promise<{ data: any | null; error: any | null }> => {
    try {
      const { data, error } = await supabase
        .from('developers')
        .insert([{ user_id: userId, ...profileData }])
        .select()
        .single();
      if (error) {
        throw error;
      }
      setDeveloperProfile(data as any);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const updateDeveloperProfile = async (
    updates: Partial<Developer>,
  ): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user || !developerProfile) {
        throw new Error('User and developer profile must exist to update');
      }
      const { data, error } = await supabase
        .from('developers')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) {
        throw error;
      }
      setDeveloperProfile(data as any);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const createJobRole = async (jobData: Partial<JobRole>): Promise<any> => {
    if (!user) throw new Error('User must be authenticated to create job roles');
    const { data, error } = await supabase
      .from('job_roles')
      .insert({ ...jobData, recruiter_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const updateJobRole = async (jobRoleId: string, updates: Partial<JobRole>): Promise<any> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update job roles');
      }
      const { data, error } = await supabase
        .from('job_roles')
        .update(updates)
        .eq('id', jobRoleId)
        .select()
        .single();
      if (error) {
        throw error;
      }
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const createAssignment = async (
    assignmentData: Partial<Assignment>,
  ): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create assignments');
      }

      const newAssignmentData = {
        ...assignmentData,
        recruiter_id: user.id,
        assigned_by: user.id,
        status: assignmentData.status || 'Sourced',
      };

      const { data, error } = await supabase
        .from('assignments')
        .insert([newAssignmentData])
        .select()
        .single();
      if (error) {
        throw error;
      }
      return { data, error: null };
    } catch (error: any) {
      console.error('Error creating assignment:', error.message, (error as any)?.details);
      return { data: null, error };
    }
  };

  const createHire = async (hireData: {
    assignment_id: string;
    salary: number;
    hire_date: string;
    start_date: string | null;
    notes: string;
  }) => {
    if (!user) {
      throw new Error('User is not authenticated.');
    }

    const { data, error } = await supabase
      .from('hires')
      .insert({
        ...hireData,
        marked_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating hire record:', error);
      throw error;
    }

    return data;
  };

  const updateAssignmentStatus = async (
    assignmentId: string,
    newStatus: string,
    notes: string | null = null,
  ): Promise<{ data: Assignment | null; error: any | null }> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update assignment status');
      }

      const updates: Partial<Assignment> = {
        status: newStatus as any,
        notes: notes,
      };

      const { data, error } = await supabase
        .from('assignments')
        .update(updates)
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) {
        console.error('Error updating assignment status:', error.message, (error as any)?.details);
        throw error;
      }

      console.log(`Assignment ${assignmentId} status updated to ${newStatus}.`);
      return { data: data as any, error: null };
    } catch (error: any) {
      console.error('Caught error in updateAssignmentStatus:', error.message);
      return { data: null, error };
    }
  };

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean): Promise<boolean> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update approval status');
      }

      if (isApproved) {
        const { data, error } = await supabase.functions.invoke('approve-recruiter', {
          body: { userId },
        });

        if (error) throw error;
        if ((data as any).error) throw new Error((data as any).error);

        return (data as any).success;
      } else {
        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) {
          console.error('Error deleting user:', error);
          return false;
        }
        return true;
      }
    } catch (error: any) {
      console.error('Caught error in updateUserApprovalStatus:', error);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    session,
    userProfile,
    developerProfile,
    loading,
    authError,
    signingOut,
    lastProfileUpdateTime,
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
    updateAssignmentStatus,
    updateUserApprovalStatus,
    updateProfileStrength,
    refreshProfile,
    refreshUserProfile: refreshProfile,
    setResolvedDeveloperProfile,
    handleGitHubCallbackSuccess,
    needsOnboarding: !developerProfile && userProfile?.role === 'developer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
