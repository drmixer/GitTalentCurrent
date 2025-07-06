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

  useEffect(() => {
    console.log('🔄 AuthProvider: Initializing auth state...');
    prevSessionRef.current = null; // Initialize prevSessionRef for onAuthStateChange

    // Get current session for initial synchronous state, but don't trigger async profile loads from here.
    // onAuthStateChange will handle profile loading.
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log('🔄 AuthProvider: Current session from getSession():', currentSession ? 'Found' : 'None');
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      // If no user is found by getSession, we can confidently say we are not loading a session.
      // onAuthStateChange will take over if a sign-in occurs.
      if (!currentSession?.user) {
        setLoading(false);
      }
    }).catch(error => {
      console.error('❌ AuthProvider: Error in getSession():', error);
      setLoading(false); // Ensure loading is false if getSession fails
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`🔄 AuthProvider: Auth state changed: ${event}`, newSession ? `Session for user ${newSession.user?.id}` : 'No session');

      if (isProcessingAuthStateChangeRef.current) {
        console.log('🔄 AuthProvider: Auth state change event ignored, already processing.');
        return;
      }

      const prevSessionStr = JSON.stringify(prevSessionRef.current);
      const newSessionStr = JSON.stringify(newSession);

      // Skip if session is identical and it's not the initial auth event.
      // INITIAL_SESSION should always be processed to ensure profile is loaded.
      if (prevSessionStr === newSessionStr && event !== 'INITIAL_SESSION' && prevSessionRef.current !== null) {
        console.log('🔄 AuthProvider: Session unchanged and not initial, skipping update. Current loading state:', loading);
        // If session is unchanged and no user, ensure loading is false.
        if (!newSession?.user && !user && loading) {
            setLoading(false);
        }
        return;
      }
      
      isProcessingAuthStateChangeRef.current = true;
      console.log('🔄 AuthProvider: Processing auth state change.');

      try {
        // Important: Update prevSessionRef *after* comparison and *before* async operations.
        prevSessionRef.current = newSession;

        const NUser = newSession?.user ?? null; // Renamed to avoid conflict with 'user' state in finally block
        setSession(newSession); // Update session state
        setUser(NUser);       // Update user state
        setAuthError(null);   // Clear previous errors

        if (NUser) {
          console.log(`🔄 AuthProvider: User ${NUser.id} detected. Event: ${event}. Setting loading true.`);
          setLoading(true);

          // Determine action based on event type
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
          } else if (event === 'SIGNED_OUT') { // Should be caught by NUser being null, but good for clarity
            console.log('🔄 AuthProvider: SIGNED_OUT event explicitly handled, clearing profiles');
            setUserProfile(null);
            setDeveloperProfile(null);
            setLoading(false); // Explicitly false on sign out.
          } else {
            // Default for other events if user is present (e.g., MFA_CHALLENGE if ever used)
            // For safety, fetch profile if event type is unknown but user is present.
            console.log(`🔄 AuthProvider: Unhandled event type ${event} with user, fetching profile.`);
            await fetchUserProfile(NUser);
          }
        } else { // No user (NUser is null, typically after SIGNED_OUT or session expiry)
          console.log('🔄 AuthProvider: No user after auth state change, clearing profiles. Event:', event);
          setUserProfile(null);
          setDeveloperProfile(null);
          setLoading(false); // Definitely no loading if no user
        }
      } catch (error) {
        console.error('❌ AuthProvider: Error in onAuthStateChange handler:', error);
        setAuthError(error instanceof Error ? error.message : 'An unexpected error occurred in auth state handler.');
        setLoading(false); // Ensure loading is false on error
      } finally {
        isProcessingAuthStateChangeRef.current = false;
        console.log('🔄 AuthProvider: Finished processing auth state change. Current loading state:', loading);
        // Final check: if the user state (not NUser, but the actual state variable 'user') is null
        // and profiles are null, ensure loading is false. This catches edge cases.
        // This check might be too aggressive if a background process is still expected.
        // Relying on setLoading(false) in specific paths (no user, error, end of fetch/handle) is better.
        // If (!user && !userProfile && !developerProfile && loading) {
        // console.log('🔄 AuthProvider: Final sanity check in finally - clearing loading for no user/profile.');
        // setLoading(false);
        // }
      }
    });

    return () => {
      console.log('🔄 AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    console.log('🔄 fetchUserProfile: Fetching profile for user:', authUser.id);
    setAuthError(null);
    setLoading(true); // Ensure loading is true at the start of this operation
    try {
      console.log('🔄 fetchUserProfile: User metadata:', authUser.user_metadata);

      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('🔄 fetchUserProfile: Profile not found, creating one');
        
        // Extract data from metadata
        const userRole = localStorage.getItem('gittalent_signup_role') || 
                        authUser.user_metadata?.role || 
                        (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
        
        const userName = localStorage.getItem('gittalent_signup_name') || 
                        authUser.user_metadata?.full_name || 
                        authUser.user_metadata?.name || 
                        authUser.user_metadata?.preferred_username || 
                        authUser.user_metadata?.user_name || 
                        'GitHub User';
        
        const companyName = authUser.user_metadata?.company_name || 'Company';
        
        console.log('🔄 fetchUserProfile: Creating profile with role:', userRole, 'name:', userName);
        
        // Create profile using RPC function
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          'create_user_profile',
          {
            user_id: authUser.id,
            user_email: authUser.email || 'unknown@example.com',
            user_name: userName,
            user_role: userRole,
            company_name: companyName
          }
        );
        
        if (rpcError) {
          console.error('❌ fetchUserProfile: Error creating user profile via RPC:', rpcError);
          setAuthError('Failed to create your profile: ' + rpcError.message);
          setLoading(false);
          return null;
        }
        
        console.log('✅ fetchUserProfile: Profile creation RPC result:', rpcResult);
        
        // Fetch the newly created profile
        const { data: newProfile, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();
          
        if (fetchError) {
          console.error('❌ fetchUserProfile: Error fetching newly created profile:', fetchError);
          setAuthError('Failed to load your profile after creation');
          setLoading(false);
          return null;
        }
        
        console.log('✅ fetchUserProfile: Newly created profile fetched:', newProfile);
        setUserProfile(newProfile);
        
        // If it's a developer, ensure developer profile exists
        if (newProfile.role === 'developer') {
          await ensureDeveloperProfile(authUser);
        }
        
        setLoading(false);
        return newProfile;
      } else if (error) {
        console.error('❌ fetchUserProfile: Error fetching user profile:', error);
        setAuthError('Failed to load your profile. Please try again.');
        setLoading(false);
        return null;
      }

      console.log('✅ fetchUserProfile: User profile fetched:', profile);
      setUserProfile(profile);

      if (profile.role === 'developer') {
        const devProfile = await fetchDeveloperProfile(authUser.id);
        
        // If developer profile wasn't found, create it
        if (!devProfile) {
          await ensureDeveloperProfile(authUser);
        }
      }

      setLoading(false);
      return profile;
    } catch (error) {
      console.error('❌ fetchUserProfile: Unexpected error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
      return null;
    } finally {
      setLoading(false);
      console.log('🔄 fetchUserProfile: Finished fetching profile, loading set to false.');
    }
  }; 
  
  // Function to ensure a developer profile exists
  const ensureDeveloperProfile = async (authUser: SupabaseUser) => {
    console.log(`🔄 ensureDeveloperProfile: Attempting for user: ${authUser.id}`);
    try {
      // Removed nested try here
      const { data: existingProfile, error: checkError } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
        
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means 0 rows, which is fine
        console.error(`❌ ensureDeveloperProfile: Error checking for existing profile for user ${authUser.id}:`, checkError);
        return false; // Indicate failure
      }
      
      if (existingProfile) {
        console.log(`✅ ensureDeveloperProfile: Developer profile already exists for user ${authUser.id}:`, existingProfile);
        console.log(`🔄 ensureDeveloperProfile: Calling setDeveloperProfile for user ${authUser.id} with existing dev profile.`);
        setDeveloperProfile(existingProfile);
        console.log(`🔄 ensureDeveloperProfile: setDeveloperProfile call completed for user ${authUser.id}.`);
        return true; // Indicate success
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
        .select() // Ensure we get the created row back
        .single(); // Expecting a single row

      if (createError) {
        console.error(`❌ ensureDeveloperProfile: Error creating developer profile for user ${authUser.id}:`, createError);
        return false; // Indicate failure
      }
      
      if (!newDevProfileData) {
        console.error(`❌ ensureDeveloperProfile: Developer profile creation seemed to succeed for user ${authUser.id} but no data returned.`);
        return false; // Indicate failure
      }

      console.log(`✅ ensureDeveloperProfile: Developer profile created for user ${authUser.id}:`, newDevProfileData);
      console.log(`🔄 ensureDeveloperProfile: Calling setDeveloperProfile for user ${authUser.id} with new dev profile.`);
      setDeveloperProfile(newDevProfileData);
      console.log(`🔄 ensureDeveloperProfile: setDeveloperProfile call completed for user ${authUser.id}.`);
      return true; // Indicate success

    } catch (error) {
      console.error(`❌ ensureDeveloperProfile: Unexpected error for user ${authUser.id}:`, error);
      return false; // Indicate failure
    }
  };

  // This function seems redundant if ensureDeveloperProfile is robust. Consider removing.
  const createDeveloperProfileFromAuth = async (authUser: SupabaseUser, userProfile: User) => {
    console.log(`🔄 createDeveloperProfileFromAuth: Evaluating for user: ${authUser.id}. This function may be redundant.`);
    // For now, let it delegate to ensureDeveloperProfile for safety, though it should ideally be consolidated.
    // Original implementation commented out below was causing build errors and has been removed.
    return await ensureDeveloperProfile(authUser);
  };

  const fetchDeveloperProfile = async (userId: string) => {
    console.log(`🔄 fetchDeveloperProfile: Attempting for user: ${userId}`);
    try {
      const { data: devProfile, error } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId) 
        .single(); // Expect one row or error

      if (error) {
        if (error.code === 'PGRST116') { // Code for "Not Found" - 0 rows
          console.log(`🤷 fetchDeveloperProfile: No developer profile found for user ${userId}.`);
          console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile(null) for user ${userId}.`);
          setDeveloperProfile(null);
          console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile(null) call completed for user ${userId}.`);
          return null; // Explicitly return null if not found
        } else {
          console.error(`❌ fetchDeveloperProfile: Error fetching developer profile for user ${userId}:`, error.message);
          console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile(null) due to error for user ${userId}.`);
          setDeveloperProfile(null);
          console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile(null) call completed for user ${userId}.`);
          return null; // Error occurred
        }
      }

      console.log(`✅ fetchDeveloperProfile: Developer profile fetched for user ${userId}:`, devProfile);
      console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile for user ${userId}.`);
      setDeveloperProfile(devProfile); // devProfile should not be null here if no error
      console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile call completed for user ${userId}.`);
      return devProfile;

    } catch (error) { // Catch any unexpected errors
      console.error(`❌ fetchDeveloperProfile: Unexpected error for user ${userId}:`, error instanceof Error ? error.message : error);
      console.log(`🔄 fetchDeveloperProfile: Calling setDeveloperProfile(null) due to unexpected error for user ${userId}.`);
      setDeveloperProfile(null);
      console.log(`🔄 fetchDeveloperProfile: setDeveloperProfile(null) call completed for user ${userId}.`);
      return null;
    }
  };

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    console.log(`🔄 handleGitHubSignIn: Processing GitHub sign-in for user: ${authUser.id}`);
    setAuthError(null);
    // setLoading(true) is set by onAuthStateChange before calling this.
    console.log(`🔄 handleGitHubSignIn: User metadata for ${authUser.id}:`, authUser.user_metadata);

    // It's good practice to ensure loading is false at the end of this function,
    // either on success or error. This will be done in a finally block.
    // We will capture the profile states within the try block for logging in finally.
    let finalAttemptedUserProfile: User | null = null;
    let finalAttemptedDeveloperProfile: Developer | null = null;

    try {
      const { data: existingUserProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('🔄 handleGitHubSignIn: User profile not found, creating one');

        const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
        const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || githubUsername || 'GitHub User';
        const avatarUrl = authUser.user_metadata?.avatar_url || null;
        const userRole = localStorage.getItem('gittalent_signup_role') || 'developer';
        const userName = localStorage.getItem('gittalent_signup_name') || fullName;

        console.log('🔄 handleGitHubSignIn: Creating profile with name:', userName, 'role:', userRole);

        const { data: createdProfile, error: createError } = await supabase
          .from('users')
          .insert({
            id: authUser.id, 
            email: authUser.email || 'unknown@example.com', 
            name: userName || 'GitHub User', 
            role: userRole === 'recruiter' ? 'recruiter' : 'developer', 
            is_approved: userRole !== 'recruiter' 
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ handleGitHubSignIn: Error creating user profile:', createError);
          setAuthError('Failed to create user profile. Please try again.');
          setLoading(false); 
          return;
        }

        setUserProfile(createdProfile);

        if (userRole === 'developer' && githubUsername) {
          const { error: devCreateError } = await supabase
            .from('developers')
            .insert({ 
              user_id: authUser.id,  
              github_handle: githubUsername, 
              bio: authUser.user_metadata?.bio || '', 
              location: authUser.user_metadata?.location || 'Remote', 
              profile_pic_url: avatarUrl 
            });

          if (devCreateError) {
            console.error('❌ handleGitHubSignIn: Error creating developer profile:', devCreateError);
            // Potentially set an error message but don't necessarily stop loading,
            // as base user profile might be okay.
          } else {
            await fetchDeveloperProfile(authUser.id); // This sets developerProfile state
            console.log('✅ handleGitHubSignIn: Developer profile created and fetched');
          }
        }
      } else if (profileError) {
        console.error('❌ handleGitHubSignIn: Error fetching user profile:', profileError);
        setAuthError('Failed to load your profile. Please try again.');
        setLoading(false); // Critical error, stop loading
        return;
      } else { // Profile exists
        setUserProfile(existingProfile);
        if (existingProfile.role === 'developer') {
          await fetchDeveloperProfile(authUser.id); // This sets developerProfile state
        }
      }
      // If we've reached this point without returning, it means operations were successful or non-critical.
      // The main loading state should be concluded.
      setLoading(false);
      console.log('✅ handleGitHubSignIn: Successfully processed GitHub sign-in.');

    } catch (error) {
      console.error('❌ handleGitHubSignIn: Error handling GitHub sign in:', error);
      setAuthError('Error during GitHub sign in. Please try again.');
      setLoading(false); // Ensure loading is false on any unexpected error
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      const localStorageRole = localStorage.getItem('gittalent_signup_role');
      const userRole = localStorageRole ||
        authUser.user_metadata?.role ||
        (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');

      const localStorageName = localStorage.getItem('gittalent_signup_name');
      const userName = localStorageName ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.user_metadata?.preferred_username ||
        authUser.user_metadata?.user_name ||
        'User';

      const companyName = authUser.user_metadata?.company_name || 'Company';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';
      const githubHandle = authUser.user_metadata?.user_name || '';
      const githubInstallationId = authUser.user_metadata?.installation_id || null;
      const userBio = authUser.user_metadata?.bio || '';
      const userLocation = authUser.user_metadata?.location || '';

      const { error: userError } = await supabase.rpc('create_user_profile', {
        user_id: authUser.id,
        user_email: authUser.email || 'unknown@example.com',
        user_name: userName,
        user_role: userRole,
        company_name: companyName
      });

      if (userError) {
        setAuthError('Failed to create user profile. Please try again.');
        return false;
      }

      if (userRole === 'developer' || authUser.app_metadata?.provider === 'github') {
        const { error: devError } = await supabase
          .from('developers')
          .insert({
            user_id: authUser.id,
            github_handle: githubHandle,
            bio: userBio,
            location: userLocation,
            top_languages: [],
            linked_projects: [],
            profile_pic_url: avatarUrl,
            github_installation_id: githubInstallationId
          });

        if (devError) {
          return false;
        }

        await fetchDeveloperProfile(authUser.id);
      }

      return true;
    } catch (error) {
      setAuthError('Failed to create user profile. Please try again.');
      return false;
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<User>): Promise<{ data?: any; error: any | null }> => {
    try {
      setAuthError(null);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: userData.name,
            role: userData.role
          }
        }
      });

      if (error) {
        setAuthError(error.message);
        return { error };
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email,
            name: userData.name,
            role: userData.role,
            is_approved: userData.role === 'developer'
          });

        if (profileError) {
          setAuthError(profileError.message);
          return { error: profileError };
        }
      }

      return { data, error: null };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ user: SupabaseUser | null; error: any | null }> => {
    try {
      setAuthError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setAuthError(error.message);
        return { user: null, error };
      }

      return { user: data.user, error: null };
    } catch (error: any) {
      setAuthError('An unexpected error occurred during sign in. Please try again.');
      return { user: null, error };
    }
  };

  const signInWithGitHub = async (stateParams?: Record<string, any>) => {
    setAuthError(null);

    // Get stored values from localStorage
    const name = localStorage.getItem('gittalent_signup_name') || '';
    const role = localStorage.getItem('gittalent_signup_role') || 'developer';
    
    const stateObj = {
      name,
      role: role || 'developer',
      install_after_auth: true,
      ...(stateParams || {})
    };

    const redirectTo = `${window.location.origin}/auth/callback`;

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo, 
          scopes: 'read:user user:email',
          state: JSON.stringify(stateObj)
        }
      });

      if (error) {
        throw error;
      }

      return { error: null };
    } catch (error: any) {
      setAuthError(error.message || 'Failed to sign in with GitHub');
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
          redirect_uri: `${window.location.origin}/github-setup`
        })
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

      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthError(error.message);
        return { error };
      }

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
      if (!user) {
        throw new Error('User must be authenticated to create developer profile');
      }

      const { data, error } = await supabase
        .from('developers')
        .insert([
          {
            user_id: user.id,
            ...profileData
          }
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const updateDeveloperProfile = async (updates: Partial<Developer>): Promise<{ data: any | null; error: any | null }> => {
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

      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  };

  const createJobRole = async (jobData: Partial<JobRole>): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create job roles');
      }

      const { data, error } = await supabase
        .from('job_roles')
        .insert([jobData])
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

  const updateJobRole = async (jobRoleId: number, updates: Partial<JobRole>): Promise<{ data: any | null; error: any | null }> => {
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

  const createAssignment = async (assignmentData: Partial<Assignment>): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create assignments');
      }

      const { data, error } = await supabase
        .from('assignments')
        .insert([assignmentData])
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

  const createHire = async (hireData: Partial<Hire>): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create hires');
      }

      const { data, error } = await supabase
        .from('hires')
        .insert([hireData])
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

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean): Promise<{ data: any | null; error: any | null }> => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update approval status');
      }

      const { data, error } = await supabase
        .from('users')
        .update({ is_approved: isApproved })
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

  const updateProfileStrength = async (userId: string, strength: number): Promise<{ data: any | null; error: any | null }> => {
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

  const refreshProfile = async () => {
    if (!user) return;

    console.log('🔄 refreshProfile: Refreshing profiles for user:', user.id);

    setLoading(true);
    try {
      await fetchUserProfile(user);
    } catch (error) {
      console.error('❌ refreshProfile: Error refreshing profile:', error);
    }
    setLoading(false);
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
    createDeveloperProfile,
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