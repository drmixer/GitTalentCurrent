import { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, Developer, JobRole, Assignment, Hire, AuthContextType } from '../types'; 

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [developerProfile, setDeveloperProfile] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null); 
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let currentMounted = true;
    setMounted(true); // Ensure mounted is true on effect run

    // Log the current environment and URL for debugging
    console.log('--- AuthProvider Init Debug ---');
    console.log('Current window.location.origin:', window.location.origin);
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('Supabase client instance:', supabase); // Check if supabase is initialized
    console.log('Current URL:', window.location.href);
    console.log('Has hash:', !!window.location.hash);
    console.log('Hash content:', window.location.hash);
    console.log('-----------------------------');

    async function handleAuthRedirect() {
      console.log('🔄 AuthProvider: Checking for auth redirect parameters...');
      try {
        // First check if we have a hash with auth parameters
        if (!window.location.hash) {
          console.log('No hash parameters found in URL');
          
          // Check for code in query params (PKCE flow)
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          const error = urlParams.get('error');
          const error_description = urlParams.get('error_description');
          
          if (error || error_description) {
            console.error('❌ AuthProvider: OAuth error in URL:', error_description || error);
            setAuthError(`Authentication error: ${error_description || error}`);
            setLoading(false);
            
            // Clear the error from URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState(null, '', cleanUrl);
            return true;
          }
          
          if (code) {
            console.log('Found code parameter in URL:', code.substring(0, 8) + '..., handling PKCE flow');
            
            // The supabase client will handle the code exchange automatically
            // We just need to wait for the session to be established
            
            // Get current session after a short delay to allow auth to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
              const { data, error } = await supabase.auth.getSession();
              
              if (error) {
                console.error('❌ Error getting session after code exchange:', error);
                setAuthError(`Error getting session: ${error.message}`);
                if (currentMounted) setLoading(false);
                return true;
              }
              
              if (data?.session) {
                console.log('✅ Session established after code exchange:', data.session.user.id);
                if (currentMounted) {
                  setUser(data.session.user);
                  await fetchUserProfile(data.session.user);
                }
                return true;
              } else {
                console.log('Session not found after code exchange, will retry in useEffect');
                setRetryCount(prev => prev + 1);
              }
            } catch (error) {
              console.error('❌ Error in code exchange handling:', error);
              setAuthError(`Error in code exchange: ${error instanceof Error ? error.message : String(error)}`);
              if (currentMounted) setLoading(false);
            }
            
            // Clean up the URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState(null, '', cleanUrl);
            
            return true;
          }
          
          return false;
        }
        
        // Also check for error in hash params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorDescription = hashParams.get('error_description');
        if (errorDescription) {
          console.error('❌ AuthProvider: OAuth error in URL:', errorDescription);
          setAuthError(`Authentication error: ${errorDescription}`);
          setLoading(false);
          
          // Clear the error from URL
          const cleanUrl = window.location.pathname + window.location.search;
          window.history.replaceState(null, '', cleanUrl);
          return true;
        }
        
        return false; // Return false to indicate no redirect was handled
      } catch (error) {
        console.error('❌ AuthProvider: Error in handleAuthRedirect:', error);
        setAuthError(`Error handling redirect: ${error instanceof Error ? error.message : String(error)}`);
        if (currentMounted) setLoading(false);
        return false;
      }
    }

    // Function to retry session check after code exchange
    async function retrySessionCheck() {
      if (retryCount > 0 && retryCount < 5) {
        console.log(`Session check retry attempt ${retryCount}/5`);
        
        try {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('❌ Error getting session during retry:', error);
            if (retryCount >= 4) {
              setAuthError(`Failed to establish session: ${error.message}`);
              setLoading(false);
            }
            return;
          }
          
          if (data?.session) {
            console.log('✅ Session found during retry:', data.session.user.id);
            setUser(data.session.user);
            await fetchUserProfile(data.session.user);
            return;
          } else if (retryCount >= 4) {
            console.error('❌ Failed to establish session after multiple retries');
            setAuthError('Failed to establish session after authentication');
            setLoading(false);
          }
        } catch (error) {
          console.error('❌ Error in retry session check:', error);
          if (retryCount >= 4) {
            setAuthError(`Error checking session: ${error instanceof Error ? error.message : String(error)}`);
            setLoading(false);
          }
        }
      }
    }

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth... Checking for existing session');
        
        // Get current session
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;

        if (error) {
          console.error('❌ Error getting session:', error);
          setAuthError(`Error getting session: ${error.message}`);
          if (currentMounted && loading) {
            setLoading(false);
          }
          return;
        }

        console.log('Session from getSession():', session ? 'Found' : 'Not found');
        if (session) {
          console.log('Session user ID:', session.user.id);
        }

        if (currentMounted) {
          const sessionUser = session?.user ?? null;
          setUser(sessionUser);
          
          if (sessionUser) {
            console.log('✅ Session found for user:', session.user.id);
            try {
              await fetchUserProfile(sessionUser);
            } catch (profileError) {
              console.error('❌ Error fetching user profile:', profileError);
              setAuthError(`Error fetching profile: ${profileError instanceof Error ? profileError.message : String(profileError)}`);
              setLoading(false);
            }
          } else {
            console.log('ℹ️ No session found');
            if (loading) setLoading(false);
          }
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        setAuthError(`Error initializing auth: ${error instanceof Error ? error.message : String(error)}`);
        if (currentMounted) {
          setLoading(false);
        }
      }
    };

    // First check for auth redirect parameters, then initialize auth
    (async () => {
      try {
        // Check if we're in the middle of an auth flow
        const isAuthFlow = window.location.hash.includes('access_token=') || 
                          window.location.hash.includes('error=') ||
                          window.location.search.includes('code=');
        
        if (isAuthFlow) {
          console.log('Detected auth flow parameters in URL');
          setLoading(true); // Ensure loading is true during auth flow
        }
        
        const redirectHandled = await handleAuthRedirect();
        console.log('Redirect handled:', redirectHandled);
        
        // Only initialize auth if no redirect was handled
        if (!redirectHandled) {
          await initializeAuth();
        }
      } catch (error) {
        console.error('❌ Fatal error in auth initialization:', error);
        setAuthError(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
        setLoading(false);
      }
    })();

    // Effect for retrying session check
    if (retryCount > 0) {
      retrySessionCheck();
    }

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!currentMounted) return;

      console.log('🔄 AuthProvider: Auth state changed event:', event);
      console.log('🔄 AuthProvider: Session object from onAuthStateChange:', session ? 'Found' : 'Not found');
      if (session) {
        console.log('Session user ID:', session.user.id);
      }
      console.log('🔄 AuthProvider: User ID from onAuthStateChange:', session?.user?.id, 'Signing out:', signingOut);
      
      if (signingOut && event !== 'SIGNED_OUT') {
        console.log('🔄 AuthProvider: Still in signing out process, ignoring auth change.');
        return;
      }

      try {
        const newUser = session?.user ?? null;
        setUser(newUser); // Always update user state based on the latest event

        if (newUser) {
          console.log(`✅ AuthProvider: User signed in/session active (${event}), fetching profile for:`, newUser.id);
          if (newUser.app_metadata?.provider === 'github') {
            await handleGitHubSignIn(newUser);
          } 
          await fetchUserProfile(newUser); // Fetch profile for any user-present event
        } else if (event === 'SIGNED_OUT') {
          console.log('🔄 AuthProvider: User signed out, clearing auth state...');
          setUserProfile(null);
          setDeveloperProfile(null);
          setNeedsOnboarding(false);
          setLoading(false);
          setSigningOut(false);
        } else {
          console.log('ℹ️ AuthProvider: No user in session after auth state change, setting loading to false.');
          if (loading) setLoading(false);
        }
      } catch (error) {
        console.error('❌ AuthProvider: Error in onAuthStateChange listener:', error);
        if (currentMounted) setLoading(false);
      }
    });

    return () => {
      currentMounted = false;
      subscription.unsubscribe();
    };
  }, [signingOut, retryCount]);

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 handleGitHubSignIn: Processing GitHub user:', authUser.id);
      console.log('🔄 handleGitHubSignIn: GitHub user metadata:', JSON.stringify(authUser.user_metadata, null, 2));

      const pendingName = localStorage.getItem('pendingGitHubName');
      const pendingEmail = localStorage.getItem('pendingEmail');
      localStorage.removeItem('pendingGitHubName');
      localStorage.removeItem('pendingEmail');

      const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
      const fullName = pendingName || authUser.user_metadata?.full_name || authUser.user_metadata?.name || githubUsername || 'GitHub User';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';
      const email = pendingEmail || authUser.email;

      let githubInstallationId: string | null = null;
      if (authUser.user_metadata?.installation_id) {
        githubInstallationId = String(authUser.user_metadata.installation_id);
      } else if (authUser.user_metadata?.app_installation_id) {
        githubInstallationId = String(authUser.user_metadata.app_installation_id);
      }
      else if (authUser.user_metadata?.github?.installation_id) {
        githubInstallationId = String(authUser.user_metadata.github.installation_id);
      }
      else if (typeof authUser.user_metadata?.raw_user_meta_data === 'string') {
        try {
          const rawMetaData = JSON.parse(authUser.user_metadata.raw_user_meta_data);
          if (rawMetaData.installation_id) {
            githubInstallationId = String(rawMetaData.installation_id);
          } else if (rawMetaData.app_installation_id) {
            githubInstallationId = String(rawMetaData.app_installation_id);
          }
        } catch (parseError) {
          console.warn('⚠️ handleGitHubSignIn: Could not parse raw_user_meta_data for installation_id:', parseError);
        }
      }

      console.log('🔄 handleGitHubSignIn: GitHub installation ID (from metadata):', githubInstallationId || 'not found');

      const userRole = authUser.user_metadata?.role || 'developer';
      console.log('🔄 handleGitHubSignIn: Determined role for GitHub user:', userRole, 'with name:', fullName);

      try {
        const { data, error } = await supabase.rpc('create_user_profile', {
          user_id: authUser.id,
          user_email: email || authUser.email!,
          user_name: fullName,
          user_role: userRole,
          company_name: authUser.user_metadata?.company_name || ''
        });

        if (error) {
          console.warn('⚠️ handleGitHubSignIn: Database function create_user_profile failed, might already exist:', error);
        }
      } catch (err) {
        console.warn('⚠️ handleGitHubSignIn: Error calling create_user_profile RPC:', err);
      }

      if (githubUsername && userRole === 'developer') {
        await createOrUpdateGitHubDeveloperProfile(authUser.id, githubUsername, avatarUrl, authUser.user_metadata, githubInstallationId);
      }
    } catch (error) {
      console.error('❌ handleGitHubSignIn: Error in handleGitHubSignIn:', error);
    }
  };

  const createOrUpdateGitHubDeveloperProfile = async (userId: string, githubUsername: string, avatarUrl: string, githubMetadata: any, installationId: string | null = null) => {
    try {
      console.log('🔄 createOrUpdateGitHubDeveloperProfile: Creating/updating GitHub developer profile for:', userId);
      console.log('🔄 createOrUpdateGitHubDeveloperProfile: GitHub username:', githubUsername);
      console.log('🔄 createOrUpdateGitHubDeveloperProfile: Installation ID (to save):', installationId);

      const { data: existingProfile } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId)
        .single();

      const profileData = {
        github_handle: githubUsername,
        bio: githubMetadata?.bio || '',
        availability: true,
        top_languages: [],
        linked_projects: [],
        location: githubMetadata?.location || '',
        experience_years: 0,
        desired_salary: 0,
        profile_pic_url: avatarUrl,
        github_installation_id: installationId || existingProfile?.github_installation_id || null
      };

      if (existingProfile) {
        console.log('🔄 createOrUpdateGitHubDeveloperProfile: Updating existing developer profile');
        await supabase
          .from('developers')
          .update(profileData)
          .eq('user_id', userId);
      } else {
        console.log('🔄 createOrUpdateGitHubDeveloperProfile: Creating new developer profile');
        await supabase
          .from('developers')
          .insert({
            user_id: userId,
            ...profileData
          });
      }

      console.log('✅ createOrUpdateGitHubDeveloperProfile: GitHub developer profile created/updated successfully in DB');
    } catch (error) {
      console.error('❌ createOrUpdateGitHubDeveloperProfile: Error in createOrUpdateGitHubDeveloperProfile:', error);
    }
  };

  const signOut = async () => {
    try {
      setSigningOut(true);
      console.log('🔄 signOut: Starting sign out process...'); 

      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setNeedsOnboarding(false);

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ signOut: Error during sign out:', error);
        throw error;
      } 

      console.log('✅ signOut: Sign out API call successful');

    } catch (error) {
      console.error('❌ signOut: Error in signOut:', error);
      throw error;
    } finally {
      setSigningOut(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔄 signIn: Signing in with email...');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { 
      console.error('❌ signIn: Sign in error:', error);
      throw error;
    }
  };

  const signInWithGitHub = async () => {
    console.log('🔄 signInWithGitHub: Signing in with GitHub...');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github', 
      options: {
        redirectTo: `${window.location.origin}/github-setup`,
        scopes: 'read:user user:email repo'
      },
    });
    if (error) {
      console.error('❌ signInWithGitHub: GitHub sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    try {
      console.log('🔄 signUp: Signing up user...');
      console.log('🔄 signUp: User data for signup:', userData); 

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          redirectTo: `${window.location.origin}/github-setup`,
          data: {
            name: userData.name,
            role: userData.role, 
            company_name: userData.role === 'recruiter' ? (userData as any).company_name : undefined,
          }
        }
      });

      if (error) throw error;

      if (data?.user) {
        console.log('✅ signUp: User signed up successfully:', data.user.id, 'with role:', userData.role); 
      }
    } catch (error) {
      console.error('❌ signUp: Signup error:', error);
      throw error;
    }
  };

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 fetchUserProfile: Fetching user profile for:', authUser.id, 'Email:', authUser.email);
      console.log('🔄 fetchUserProfile: Auth user metadata:', JSON.stringify(authUser.user_metadata, null, 2));
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Slightly longer delay
      
      let userProfileFound = false;

      const { data: userProfileData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (userError || !userProfileData) {
        console.log('⚠️ fetchUserProfile: User profile not found in DB for:', authUser.id, userError?.message);
        console.log('🔄 fetchUserProfile: Attempting to create user profile from auth data...');
        
        // Try to create the user profile
        let success = false;
        try {
          success = await createUserProfileFromAuth(authUser);
        } catch (createError) {
          console.error('❌ fetchUserProfile: Error in createUserProfileFromAuth:', createError);
        }
        
        if (success) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Give DB a moment to sync
          const { data: retryUserData, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
            
          if (retryError) {
            console.error('❌ fetchUserProfile: Error fetching user profile after creation attempt:', retryError);
            if (mounted) {
              console.log('❌ fetchUserProfile: Setting profile to null and needsOnboarding to true after retry error');
              setUserProfile(null);
              setDeveloperProfile(null);
              setNeedsOnboarding(true);
              setLoading(false);
            }
            return;
          }
          userProfileFound = !!retryUserData;
          if (mounted) {
            setUserProfile(retryUserData);
            await checkForRoleSpecificProfile(retryUserData, authUser.id);
          }
        } else {
          console.error('❌ fetchUserProfile: Failed to create user profile from auth data.');
          if (mounted) {
            console.log('❌ fetchUserProfile: Setting profile to null and needsOnboarding to true after creation failure');
            setUserProfile(null);
            setDeveloperProfile(null);
            setNeedsOnboarding(true);
            setLoading(false);
          }
          return;
        }
      } else {
        userProfileFound = true;
        console.log('✅ fetchUserProfile: User profile found in DB:', userProfileData.role);
        if (mounted) {
          setUserProfile(userProfileData);
          await checkForRoleSpecificProfile(userProfileData, authUser.id);
        }
      }
    } catch (error) {
      console.error('❌ fetchUserProfile: Unhandled error in fetchUserProfile:', error);
      if (mounted) {
        console.log('❌ fetchUserProfile: Setting profile to null after unhandled error');
        setUserProfile(null);
        setDeveloperProfile(null);
        setLoading(false);
      }
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      console.log('🔄 createUserProfileFromAuth: Creating user profile from auth user:', authUser.id);
      console.log('🔄 createUserProfileFromAuth: Auth user metadata:', JSON.stringify(authUser.user_metadata, null, 2));

      // Get name from localStorage or metadata
      const pendingName = localStorage.getItem('pendingGitHubName');
      const pendingEmail = localStorage.getItem('pendingEmail');
      
      // Extract role with fallbacks
      const userRole = authUser.user_metadata?.role || 
                      (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
      
      // Extract name with fallbacks
      const userName = pendingName || 
                      authUser.user_metadata?.full_name || 
                      authUser.user_metadata?.name || 
                      authUser.user_metadata?.user_name ||
                      'User';
                      
      const companyName = authUser.user_metadata?.company_name || 'Company';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';
      const email = pendingEmail || authUser.email;

      let githubInstallationId: string | null = null;
      if (authUser.user_metadata?.installation_id) {
        githubInstallationId = String(authUser.user_metadata.installation_id);
      } else if (authUser.user_metadata?.app_installation_id) {
        githubInstallationId = String(authUser.user_metadata.app_installation_id); 
      }
      else if (authUser.user_metadata?.github?.installation_id) {
        githubInstallationId = String(authUser.user_metadata.github.installation_id);
      }
      else if (typeof authUser.user_metadata?.raw_user_meta_data === 'string') {
        try {
          const rawMetaData = JSON.parse(authUser.user_metadata.raw_user_meta_data);
          if (rawMetaData.installation_id) {
            githubInstallationId = String(rawMetaData.installation_id);
          } else if (rawMetaData.app_installation_id) {
            githubInstallationId = String(rawMetaData.app_installation_id);
          }
        } catch (parseError) {
          console.warn('⚠️ createUserProfileFromAuth: Could not parse raw_user_meta_data for installation_id during creation:', parseError);
        }
      }

      const { error: insertUserError } = await supabase
        .from('users')
        .insert({
          id: authUser.id, 
          email: email || authUser.email || 'unknown@example.com', 
          name: userName || authUser.email?.split('@')[0] || 'User', 
          role: userRole, 
          is_approved: userRole === 'developer' || userRole === 'admin' 
        });

      if (insertUserError) {
        console.error('❌ createUserProfileFromAuth: User profile creation failed:', insertUserError);
        if (insertUserError.code === '23505') {
          console.warn('⚠️ createUserProfileFromAuth: User profile already exists (unique constraint violation). Treating as success.');
          return true;
        }
        return false;
      }

      if (userRole === 'developer' || authUser.app_metadata?.provider === 'github') {
        let githubInstallationId: string | null = null;
        if (authUser.user_metadata?.installation_id) {
          githubInstallationId = String(authUser.user_metadata.installation_id); 
        } else if (authUser.user_metadata?.app_installation_id) {
          githubInstallationId = String(authUser.user_metadata.app_installation_id); 
        }
        else if (authUser.user_metadata?.github?.installation_id) {
          githubInstallationId = String(authUser.user_metadata.github.installation_id); 
        }
        else if (typeof authUser.user_metadata?.raw_user_meta_data === 'string') {
          try {
            const rawMetaData = JSON.parse(authUser.user_metadata.raw_user_meta_data);
            if (rawMetaData.installation_id) {
              githubInstallationId = String(rawMetaData.installation_id);
            } else if (rawMetaData.app_installation_id) {
              githubInstallationId = String(rawMetaData.app_installation_id);
            }
          } catch (parseError) {
            console.warn('⚠️ createUserProfileFromAuth: Could not parse raw_user_meta_data for installation_id during creation:', parseError);
          }
        }

        const { error: devError } = await supabase
          .from('developers')
          .insert({
            user_id: authUser.id, 
            github_handle: authUser.user_metadata?.user_name || '', 
            bio: authUser.user_metadata?.bio || '', 
            availability: true, 
            top_languages: [], 
            linked_projects: [], 
            location: authUser.user_metadata?.location || '', 
            experience_years: 0, 
            desired_salary: 0, 
            profile_pic_url: avatarUrl, 
            github_installation_id: githubInstallationId 
          });

        if (devError) {
          console.error('❌ createUserProfileFromAuth: Error creating developer profile:', devError);
          if (devError.code === '23505') {
            console.warn('⚠️ createUserProfileFromAuth: Developer profile already exists (unique constraint violation). Treating as success.');
            return true;
          }
          return false;
        } else {
          console.log('✅ createUserProfileFromAuth: Developer profile created successfully');
        }
      } else if (userRole === 'recruiter') {
        const { error: recError } = await supabase
          .from('recruiters')
          .insert({
            user_id: authUser.id,
            company_name: companyName
          });

        if (recError) {
          console.error('❌ createUserProfileFromAuth: Error creating recruiter profile:', recError);
          if (recError.code === '23505') {
            console.warn('⚠️ createUserProfileFromAuth: Recruiter profile already exists (unique constraint violation). Treating as success.');
            return true;
          }
          return false;
        } else {
          console.log('✅ createUserProfileFromAuth: Recruiter profile created successfully');
        }
      }

      console.log('✅ createUserProfileFromAuth: User profile created successfully in DB');
      return true;
    } catch (error) {
      console.error('❌ createUserProfileFromAuth: Error in createUserProfileFromAuth (outer catch):', error);
      return false;
    }
  };

  const checkForRoleSpecificProfile = async (userProfile: User, userId: string) => {
    try {
      if (userProfile.role === 'developer') {
        const { data: devProfileData, error: devError } = await supabase 
          .from('developers')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
      
        if (devError) {
          console.error('❌ checkForRoleSpecificProfile: Error fetching developer profile:', devError);
        }

        if (!devProfileData) {
          console.log('⚠️ checkForRoleSpecificProfile: Developer profile not found, needs onboarding (or still being created).');
          console.log('⚠️ checkForRoleSpecificProfile: Setting needsOnboarding to true for developer');
          setDeveloperProfile(null);
          setNeedsOnboarding(true);
        } else {
          console.log('✅ checkForRoleSpecificProfile: Developer profile found and set in state.');
          setDeveloperProfile(devProfileData);

          if (!devProfileData.github_installation_id && devProfileData.github_handle) {
            console.log('⚠️ checkForRoleSpecificProfile: GitHub App not installed, but GitHub handle exists for developer.');
            // This is where the UI should prompt the user to connect the GitHub App
          }
          setNeedsOnboarding(false);
        }
      } else if (userProfile?.role === 'recruiter') {
        const { data: recProfileData, error: recError } = await supabase
          .from('recruiters')
          .select('*') 
          .eq('user_id', userId)
          .maybeSingle();

        if (recError) {
          console.error('❌ checkForRoleSpecificProfile: Error fetching recruiter profile:', recError);
        }

        if (!recProfileData) {
          console.log('⚠️ checkForRoleSpecificProfile: Recruiter profile not found, needs onboarding.');
          console.log('⚠️ checkForRoleSpecificProfile: Setting needsOnboarding to true for recruiter');
          setNeedsOnboarding(true);
        } else {
          console.log('✅ checkForRoleSpecificProfile: Recruiter profile found.');
          setNeedsOnboarding(false);
        }

        setDeveloperProfile(null);
      } else {
        setDeveloperProfile(null);
      }
      console.log('✅ checkForRoleSpecificProfile: Completed profile check, setting loading to false');
    } catch (error) {
      console.error('❌ checkForRoleSpecificProfile: Error checking role-specific profile:', error);
      setNeedsOnboarding(false);
      console.log('❌ checkForRoleSpecificProfile: Setting loading to false after error');
    } finally {
      setLoading(false);
    }
  };

  const createDeveloperProfile = async (profileData: Partial<Developer>): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔄 createDeveloperProfile: Creating developer profile for:', user.id);
      console.log('🔄 createDeveloperProfile: Profile data:', JSON.stringify(profileData, null, 2));

      const { data, error } = await supabase.rpc('create_developer_profile', {
        p_user_id: user.id,
        p_github_handle: profileData.github_handle || '',
        p_bio: profileData.bio || '',
        p_availability: profileData.availability ?? true,
        p_top_languages: profileData.top_languages || [],
        p_linked_projects: profileData.linked_projects || [],
        p_location: profileData.location || '',
        p_experience_years: profileData.experience_years || 0,
        p_desired_salary: profileData.desired_salary || 0,
        p_profile_pic_url: profileData.profile_pic_url || null, 
        p_github_installation_id: profileData.github_installation_id || null
      });

      if (error) {
        console.error('❌ createDeveloperProfile: Error creating developer profile:', error);
        return false;
      }

      console.log('✅ createDeveloperProfile: Developer profile created successfully via RPC');

      await updateProfileStrength();

      await fetchUserProfile(user);
      return true;
    } catch (error) {
      console.error('❌ createDeveloperProfile: Error in createDeveloperProfile:', error);
      return false;
    }
  };

  const updateDeveloperProfile = async (profileData: Partial<Developer>): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔄 updateDeveloperProfile: Updating developer profile for:', user.id);
      console.log('🔄 updateDeveloperProfile: Profile data:', JSON.stringify(profileData, null, 2));

      const cleanedData = {
        ...profileData,
        bio: profileData.bio?.trim() || null,
        github_handle: profileData.github_handle?.trim() || null,
        location: profileData.location?.trim() || null,
        linked_projects: profileData.linked_projects?.filter(p => p && p.trim()) || [],
        top_languages: profileData.top_languages?.filter(l => l && l.trim()) || [],
        profile_pic_url: profileData.profile_pic_url?.trim() || null,
        github_installation_id: profileData.github_installation_id || null 
      };
      
      console.log('🔄 updateDeveloperProfile: Updating developer profile with:', cleanedData);

      const { error } = await supabase
        .from('developers')
        .update(cleanedData)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ updateDeveloperProfile: Error updating developer profile:', error);
        return false;
      }

      console.log('✅ updateDeveloperProfile: Developer profile updated successfully in DB');

      await updateProfileStrength();

      await fetchUserProfile(user);
      return true;
    } catch (error) {
      console.error('❌ updateDeveloperProfile: Error in updateDeveloperProfile:', error);
      return false;
    }
  };

  const updateProfileStrength = async (): Promise<void> => {
    if (!user) return;

    try {
      console.log('🔄 updateProfileStrength: Updating profile strength for:', user.id);

      const { data, error } = await supabase.rpc('calculate_profile_strength_rpc', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ updateProfileStrength: Error updating profile strength:', error);
        return;
      }

      console.log('✅ updateProfileStrength: Profile strength updated to:', data);
    } catch (error) {
      console.error('❌ updateProfileStrength: Error in updateProfileStrength:', error);
    }
  };

  const createJobRole = async (jobData: Partial<JobRole>): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('job_roles')
        .insert({
          ...jobData,
          recruiter_id: user.id,
        });

      if (error) {
        console.error('❌ createJobRole: Error creating job role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ createJobRole: Error in createJobRole:', error);
      return false;
    }
  };

  const updateJobRole = async (jobId: string, jobData: Partial<JobRole>): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('job_roles')
        .update(jobData)
        .eq('id', jobId)
        .eq('recruiter_id', user.id);

      if (error) {
        console.error('❌ updateJobRole: Error updating job role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ updateJobRole: Error in updateJobRole:', error);
      return false;
    }
  };

  const createAssignment = async (assignmentData: Partial<Assignment>): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('assignments')
        .insert({
          ...assignmentData,
          assigned_by: user.id,
        });

      if (error) {
        console.error('❌ createAssignment: Error creating assignment:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ createAssignment: Error in createAssignment:', error);
      return false;
    }
  };

  const createHire = async (hireData: Partial<Hire>): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('hires')
        .insert({
          ...hireData,
          marked_by: user.id,
        });

      if (error) {
        console.error('❌ createHire: Error creating hire:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ createHire: Error in createHire:', error);
      return false;
    }
  };

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_approved: isApproved })
        .eq('id', userId);

      if (error) {
        console.error('❌ updateUserApprovalStatus: Error updating user approval status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ updateUserApprovalStatus: Error in updateUserApprovalStatus:', error);
      return false;
    }
  };

  const value = {
    user,
    userProfile,
    developerProfile,
    authError,
    loading,
    needsOnboarding,
    signIn,
    signInWithGitHub,
    signUp,
    signOut,
    refreshProfile: async () => {
      if (user) {
        console.log('🔄 refreshProfile: Refreshing profile...');
        setLoading(true); // Set loading to true before refreshing
        await fetchUserProfile(user);
        // No need to set loading to false here as fetchUserProfile will handle it
      }
    },
    createDeveloperProfile,
    updateDeveloperProfile,
    createJobRole,
    updateJobRole,
    createAssignment,
    createHire,
    updateUserApprovalStatus,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};