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

  const ensureDeveloperProfile = useCallback(async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      const { data: existingProfileFromDb, error: checkError } = await supabase.from('developers').select('*').eq('user_id', authUser.id).maybeSingle();
      if (checkError && checkError.code !== 'PGRST116') { console.error(`ensureDeveloperProfile: Error checking for ${authUser.id}:`, checkError); return false; }

      const githubUsername = authUser.user_metadata?.login || authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || '';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const userBio = authUser.user_metadata?.bio || '';
      const userLocation = authUser.user_metadata?.location || '';
      const currentGhInstIdInState = developerProfile?.github_installation_id;

      if (existingProfileFromDb) {
        let profileToSet = { ...existingProfileFromDb }; 

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
          } else if (updatedProfileFromDb) {
            profileToSet = { ...updatedProfileFromDb };
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

      let newDevProfileData: Partial<Developer> = {
        user_id: authUser.id, 
        github_handle: githubUsername, 
        bio: userBio, 
        location: userLocation,
        profile_pic_url: avatarUrl,
        availability: true
      };
      if (currentGhInstIdInState) {
         newDevProfileData.github_installation_id = currentGhInstIdInState;
         console.log(`[AuthContext] ensureDeveloperProfile (creating new): Including ghInstId (${currentGhInstIdInState}) from current context state for new profile.`);
      } else {
         console.log(`[AuthContext] ensureDeveloperProfile (creating new): Not including ghInstId in new profile data as it's not in current context state. It should be set by GitHub App installation flow.`);
      }

      const { data: insertedProfile, error: createError } = await supabase.from('developers').insert(newDevProfileData).select().single();
      if (createError) { console.error(`ensureDeveloperProfile: Error creating for ${authUser.id}:`, createError); return false; }
      if (!insertedProfile) { console.error(`ensureDeveloperProfile: No data returned after insert for ${authUser.id}`); return false; }
      
      if (insertedProfile.github_installation_id !== currentGhInstIdInState && currentGhInstIdInState) {
          console.log(`[AuthContext] ensureDeveloperProfile (created new, re-affirming): Preserving ghInstId (${currentGhInstIdInState}) over DB insert result ${insertedProfile.github_installation_id}.`);
          insertedProfile.github_installation_id = currentGhInstIdInState;
      }

      console.log(`[AuthContext] ensureDeveloperProfile (created new): Setting profile. ghInstId: ${insertedProfile.github_installation_id}`);
      setDeveloperProfile(insertedProfile);
      setLastProfileUpdateTime(Date.now());
      return true;
    } catch (error) { console.error(`ensureDeveloperProfile: Unexpected error for ${authUser.id}:`, error); return false; }
  }, [developerProfile, lastProfileUpdateTime]);

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
      if (!devProfileFromDb) {
        setDeveloperProfile(null);
        setLastProfileUpdateTime(Date.now());
        return null;
      }

      let profileToSet = { ...devProfileFromDb };
      const currentGhInstIdInState = developerProfile?.github_installation_id;

      if ((profileToSet.github_installation_id === null || profileToSet.github_installation_id === undefined) && currentGhInstIdInState) {
        console.log(`[AuthContext] fetchDeveloperProfile: Preserving ghInstId (${currentGhInstIdInState}) from state over DB's null for user ${userId}.`);
        profileToSet.github_installation_id = currentGhInstIdInState;
      }
      
      console.log(`[AuthContext] fetchDeveloperProfile: Setting profile. ghInstId: ${profileToSet.github_installation_id}`);
      setDeveloperProfile(profileToSet);
      setLastProfileUpdateTime(Date.now());
      return profileToSet;
    } catch (error) { console.error(`fetchDeveloperProfile: Unexpected error for ${userId}:`, error); setDeveloperProfile(null); setLastProfileUpdateTime(Date.now()); return null; }
  }, [developerProfile, lastProfileUpdateTime]);

const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
  setAuthError(null);
  console.log(`[AuthContext] fetchUserProfile START for user_id: ${authUser.id}, email: ${authUser.email}`);
  try {
    const { data: profile, error, status } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    console.log(`[AuthContext] fetchUserProfile: Initial fetch from 'users' table - Status: ${status}, Error Code: ${error?.code}, Error Message: ${error?.message}, Profile Data:`, profile);

    if (error && error.code === 'PGRST116') {
      console.log(`[AuthContext] fetchUserProfile: Profile not found for ${authUser.id} (PGRST116 / implies 406 with .single()). Attempting to create via RPC.`);
      
      const userRole = localStorage.getItem('gittalent_signup_role') || authUser.user_metadata?.role || (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
      const userName = localStorage.getItem('gittalent_signup_name') || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.login || authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || 'GitHub User';
      const companyName = authUser.user_metadata?.company_name || 'Company';
      
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
      setUserProfile(newProfile);
      if (newProfile.role === 'developer') {
        console.log(`[AuthContext] fetchUserProfile: User role is 'developer'. Calling ensureDeveloperProfile for ${authUser.id}.`);
        await ensureDeveloperProfile(authUser);
      }
      return newProfile;

    } else if (error) {
      console.error(`[AuthContext] fetchUserProfile: Non-PGRST116 error fetching profile for ${authUser.id}: Code: ${error.code}, Message: ${error.message}`);
      setAuthError('Failed to load your profile.'); return null;
    }

    if (!profile) {
        console.error(`[AuthContext] fetchUserProfile: Initial fetch successful (no error, no PGRST116) but profile data is null/undefined for ${authUser.id}. This is unexpected.`);
        setAuthError('Profile data was unexpectedly empty after fetch.');
        return null;
    }
      
    console.log(`[AuthContext] fetchUserProfile: Profile existed and fetched successfully for ${authUser.id}.`);
    setUserProfile(profile);
    if (profile.role === 'developer') {
      console.log(`[AuthContext] fetchUserProfile: User role is 'developer'. Calling ensureDeveloperProfile for ${authUser.id}.`);
      await ensureDeveloperProfile(authUser);
    }
    return profile;

  } catch (errorCatch) {
    console.error(`[AuthContext] fetchUserProfile: Unexpected top-level catch error for ${authUser.id}:`, errorCatch);
    setAuthError('An unexpected error occurred while fetching your profile.'); return null;
  } finally {
    setLoading(false); 
    console.log(`[AuthContext] fetchUserProfile FINISHED for user_id: ${authUser.id}. Loading state will be false.`);
  }
}, [ensureDeveloperProfile, setLoading, setAuthError, setUserProfile]);

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
  }, [authUserToProcess, authProcessingEventType, handleGitHubSignIn, fetchUserProfile]);

  const signUp = async (email: string, password: string, userData: Partial<User>): Promise<{ data?: any; error: any | null }> => {
    try {
      setAuthError(null); setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { name: userData.name, role: userData.role } }
      });
      if (error) { setAuthError(error.message); setLoading(false); return { error }; }
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
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'github', 
        options: { 
          redirectTo, 
          scopes: 'read:user user:email'
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
      return;
    }
    setLoading(true);
    setAuthUserToProcess(user);
    setAuthProcessingEventType('MANUAL_REFRESH');
  }, [user, fetchUserProfile]);

  const setResolvedDeveloperProfile = useCallback((developerData: Developer) => {
    console.log('[AuthContext] setResolvedDeveloperProfile called with:', developerData);
    if (developerData && typeof developerData === 'object' && developerData.user_id) {
      console.log(`[AuthContext] setResolvedDeveloperProfile: Setting profile. ghInstId from input data: ${developerData.github_installation_id}`);
      setDeveloperProfile(developerData);
      setLastProfileUpdateTime(Date.now());
    } else {
      console.warn('[AuthContext] setResolvedDeveloperProfile called with invalid data, not setting:', developerData);
    }
  }, [setDeveloperProfile, setLastProfileUpdateTime]); 


  const value: AuthContextType = {
    user, session, userProfile, developerProfile, loading, authError, signingOut,
    lastProfileUpdateTime,
    signUp, signIn, signInWithGitHub, connectGitHubApp, signOut,
    createDeveloperProfile, updateDeveloperProfile, createJobRole, updateJobRole,
    createAssignment, createHire, updateUserApprovalStatus, updateProfileStrength,
    refreshProfile,
    setResolvedDeveloperProfile,
    needsOnboarding: !developerProfile && userProfile?.role === 'developer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
Next, src/pages/GitHubAppSetup.tsx.

Here is the complete content for src/pages/GitHubAppSetup.tsx:

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, AlertCircle, Github, ArrowLeft, RefreshCw } from 'lucide-react';
import { Developer } from '../types'; // Ensure Developer type is imported

export const GitHubAppSetup: React.FC = () => {
  const { user, developerProfile, refreshProfile, loading: authLoading, setResolvedDeveloperProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;

  const [uiState, setUiState] = useState<'loading' | 'success' | 'error' | 'info' | 'redirect'>('info');
  const [message, setMessage] = useState('Connecting GitHub...');
  const [processingInstallation, setProcessingInstallation] = useState(false);

  const redirectToGitHubAppInstall = useCallback(() => {
    const GITHUB_APP_SLUG = 'GitTalentApp';
    const stateObj = {
      redirect_uri: `${window.location.origin}/github-setup`,
      user_id: user?.id,
      timestamp: Date.now()
    };
    const state = encodeURIComponent(JSON.stringify(stateObj));
    const redirectUrl = encodeURIComponent(`${window.location.origin}/github-setup`);
    const githubAppInstallUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${state}&redirect_uri=${redirectUrl}`;
    
    setUiState('redirect');
    setMessage('Redirecting to GitHub App installation page...');
    setTimeout(() => {
      window.location.href = githubAppInstallUrl;
    }, 1000);
  }, [user]);

  const handleSuccess = useCallback((
    successMessage: string,
    redirectDelay: number = 2000,
    navState?: { freshGitHubHandle?: string; freshGitHubInstallationId?: string | number; isFreshGitHubSetup?: boolean }
  ) => {
    setUiState('success');
    setMessage(successMessage);
    setTimeout(() => {
      navigate('/developer?tab=github-activity', {
        replace: true,
        state: navState
      });
    }, redirectDelay);
  }, [navigate]);

  const handleError = useCallback((errorMessage: string) => {
    console.error('[GitHubAppSetup] Error - ', errorMessage);
    setUiState('error');
    setMessage(errorMessage);
  }, []);

  useEffect(() => {
    console.log('[GitHubAppSetup] useEffect triggered. Current user:', user?.id, 'Params:', location.search);
    const handleSetup = async () => {
      const searchParams = new URLSearchParams(location.search);
      const installationId = searchParams.get('installation_id'); 
      const setupAction = searchParams.get('setup_action');
      const errorParam = searchParams.get('error'); 
      const errorDescription = searchParams.get('error_description'); 
      
      if (installationId || errorParam) {
        setRetryCount(0);
      }
  
      if (errorParam) {
        handleError(`GitHub Error: ${errorDescription || errorParam}`);
        return;
      }
  
      if (authLoading && !user) {
        if (retryCount >= maxRetries) {
          handleError('Authentication is taking too long. Please try logging in again.');
        } else {
          setUiState('loading');
          setMessage(`Verifying your session... (Attempt ${retryCount + 1}/${maxRetries})`);
          const timer = setTimeout(() => setRetryCount(prev => prev + 1), 2000);
          return () => clearTimeout(timer);
        }
        return;
      } 
  
      if (!user) {
        console.log('[GitHubAppSetup] No user session found. Redirecting to login.');
        navigate('/login', { replace: true });
        return;
      }
  
      if (user && installationId && developerProfile?.github_installation_id && String(developerProfile.github_installation_id) === String(installationId)) {
        console.log('[GitHubAppSetup] Installation ID already matches profile. Likely a refresh or re-config.');
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('installation_id');
        cleanUrl.searchParams.delete('setup_action');
        cleanUrl.searchParams.delete('state');
        window.history.replaceState({}, '', cleanUrl.toString());
        handleSuccess(setupAction === 'install' ? 'GitHub App successfully installed!' : 'GitHub App connection updated!', 1000, {
          freshGitHubHandle: developerProfile.github_handle,
          freshGitHubInstallationId: developerProfile.github_installation_id,
          isFreshGitHubSetup: true
        });
        return;
      } 
      
      if (user && installationId && !processingInstallation) {
        setProcessingInstallation(true);
        setUiState('loading');
        setMessage(`Connecting GitHub App... (Installation ID: ${installationId})`);
  
        try {
          const { data: functionResponse, error: functionError } = await supabase.functions.invoke('update-github-installation', {
            body: { userId: user.id, installationId: String(installationId) }, 
          });

          if (functionError) {
            console.error('[GitHubAppSetup] Error invoking update-github-installation:', functionError);
            setProcessingInstallation(false);
            handleError(`Failed to save GitHub installation: ${functionError.message}`);
            return;
          }

          console.log('[GitHubAppSetup] Raw functionResponse from update-github-installation:', JSON.stringify(functionResponse));
          
          let freshDeveloperData: Developer | null = null;
          if (functionResponse) {
            if (Array.isArray(functionResponse)) {
                freshDeveloperData = functionResponse[0] as Developer;
                 console.log('[GitHubAppSetup] functionResponse was an array, took first element.');
            } else if (functionResponse.data && typeof functionResponse.data === 'object') { 
                if(Array.isArray(functionResponse.data)) {
                    freshDeveloperData = functionResponse.data[0] as Developer;
                    console.log('[GitHubAppSetup] functionResponse.data was an array, took first element.');
                } else {
                    freshDeveloperData = functionResponse.data as Developer;
                    console.log('[GitHubAppSetup] Used functionResponse.data directly as it is an object.');
                }
            } else if (typeof functionResponse === 'object' && functionResponse !== null) {
                freshDeveloperData = functionResponse as Developer;
                console.log('[GitHubAppSetup] Used functionResponse directly as it is an object (and not array/no .data).');
            }
          }
          
          console.log('[GitHubAppSetup] Parsed freshDeveloperData:', JSON.stringify(freshDeveloperData));

          if (freshDeveloperData && typeof freshDeveloperData === 'object' && freshDeveloperData.user_id && setResolvedDeveloperProfile) {
            console.log('[GitHubAppSetup] Developer data from function seems valid, calling setResolvedDeveloperProfile.');
            setResolvedDeveloperProfile(freshDeveloperData);
          } else {
            console.warn('[GitHubAppSetup] Did not get valid fresh developer data from function to set in context. Attempting refreshProfile(). Parsed data:', freshDeveloperData);
            if (refreshProfile) await refreshProfile();
          }
          
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('installation_id');
          cleanUrl.searchParams.delete('setup_action');
          cleanUrl.searchParams.delete('state'); 
          window.history.replaceState({}, '', cleanUrl.toString());
          
          setProcessingInstallation(false);
          
          if (freshDeveloperData && freshDeveloperData.github_handle && freshDeveloperData.github_installation_id) {
            console.log(`[GitHubAppSetup] Navigating WITH state: handle=${freshDeveloperData.github_handle}, instId=${freshDeveloperData.github_installation_id}.`);
            handleSuccess(
              setupAction === 'install' ? 'GitHub App successfully installed and connected!' : 'GitHub App connection updated successfully!', 
              1000, 
              {
                freshGitHubHandle: freshDeveloperData.github_handle,
                freshGitHubInstallationId: freshDeveloperData.github_installation_id,
                isFreshGitHubSetup: true
              }
            );
          } else {
            console.warn('[GitHubAppSetup] Missing critical data from Edge Function for navState. Navigating WITHOUT state or with partial success.', freshDeveloperData);
            handleSuccess(setupAction === 'install' ? 'GitHub App installed (profile data may take a moment to update).' : 'GitHub App connection updated (profile data may take a moment to update).', 2000);
          }
        } catch (err: any) { 
          console.error('[GitHubAppSetup] Error processing GitHub installation (outer catch):', err.message ? err.message : err);
          setProcessingInstallation(false);
          handleError(err.message || 'Failed to process GitHub installation.');
        }
        return; 

      } else if (user && installationId && processingInstallation) {
        setUiState('loading');
        setMessage('Processing GitHub App installation...');
        return;
      }

      if (user && !installationId) {
        console.log('[GitHubAppSetup] No installation_id in URL. Checking current developer profile state.');
        const hasInstallationId = developerProfile?.github_installation_id && String(developerProfile.github_installation_id).length > 0;
                                 
        if (hasInstallationId) {
          handleSuccess('GitHub App is already connected! Redirecting to dashboard...', 1000, {
             freshGitHubHandle: developerProfile.github_handle,
             freshGitHubInstallationId: developerProfile.github_installation_id,
             isFreshGitHubSetup: false // Not a fresh setup, but data is present
          });
        } else {
          if (developerProfile === undefined && retryCount < maxRetries && !authLoading) {
            setUiState('loading'); 
            setMessage(`Loading your profile to check GitHub status... (Attempt ${retryCount + 1}/${maxRetries})`); 
            const timer = setTimeout(() => {
              if(refreshProfile) refreshProfile();
              setRetryCount(prev => prev + 1);
            }, 1500);
            return () => clearTimeout(timer);
          } else if (developerProfile === null || (developerProfile && !developerProfile.github_installation_id)) {
            setUiState('info');
            setMessage('Connect the GitHub App to display your contributions and repositories.');
          } else if (developerProfile === undefined && (authLoading || retryCount >= maxRetries)) {
             handleError('Could not load your profile to check GitHub status. Please try again or return to dashboard.');
          } else {
            setUiState('info');
            setMessage('Checking GitHub connection status...');
          }
        }
        return;
      }
      
      if (!installationId) {
        console.log('[GitHubAppSetup] No installation ID in URL and not an existing connection. Showing info.');
        setUiState('info');
        setMessage('Ready to connect your GitHub account.');
      }
    };

    handleSetup();
  }, [user, developerProfile, authLoading, location.search, navigate, refreshProfile, 
      handleSuccess, handleError, processingInstallation, retryCount, setResolvedDeveloperProfile, redirectToGitHubAppInstall]);

  let iconToShow = <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />;
  if (uiState === 'success') iconToShow = <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />;
  if (uiState === 'error') iconToShow = <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />;
  if (uiState === 'redirect') iconToShow = <Github className="h-12 w-12 text-blue-600 mx-auto mb-4" />;
  if (uiState === 'info') iconToShow = <Github className="h-12 w-12 text-gray-400 mx-auto mb-4" />;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          {iconToShow}
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          {uiState === 'loading' && 'Connecting GitHub...'}
          {uiState === 'success' && 'GitHub Connected!'}
          {uiState === 'error' && 'Connection Error'}
          {uiState === 'redirect' && 'Redirecting to GitHub...'}
          {uiState === 'info' && 'Connect to GitHub'}
        </h1>
        <p className="text-gray-600 mb-6">{message}</p>
        
        {uiState === 'info' && (
          <button
            onClick={redirectToGitHubAppInstall}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center"
            disabled={authLoading || !user}
          >
            <Github className="w-5 h-5 mr-2" />
            Connect GitHub App
          </button>
        )}

        {(uiState === 'error') && (
          <div className="space-y-3 mt-6">
            <button
              onClick={() => {
                setRetryCount(0); 
                if(refreshProfile) refreshProfile();
                setUiState('loading');
                setMessage('Retrying connection...');
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
            <button
              onClick={() => navigate('/developer')}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}
         {(authLoading && retryCount >= maxRetries && uiState !== 'error') && (
            <p className="text-sm text-orange-600 mt-4">Authentication is taking a while. If this persists, please try returning to the dashboard and connecting from your profile settings.</p>
        )}
      </div>
    </div>
  );
};
