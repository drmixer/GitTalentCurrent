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

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log('🔄 AuthProvider: Initial session:', initialSession ? 'Found' : 'None');
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setAuthError(null);
      
      // Store the initial session in the ref
      prevSessionRef.current = initialSession;

      if (initialSession?.user) {
        fetchUserProfile(initialSession.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('🔄 AuthProvider: Auth state changed:', event, newSession ? 'Session exists' : 'No session');

      if (isProcessingAuthStateChangeRef.current) {
        console.log('🔄 AuthProvider: Auth state change event ignored, already processing.');
        return;
      }

      // Compare the new session with the previous one
      const prevSessionStr = JSON.stringify(prevSessionRef.current);
      const newSessionStr = JSON.stringify(newSession);

      if (prevSessionStr === newSessionStr && event !== 'INITIAL_SESSION') { // Allow initial session to always process
        console.log('🔄 AuthProvider: Session unchanged, skipping update');
        // If session is truly unchanged, ensure loading is false if no user.
        if (!newSession?.user && !user) setLoading(false);
        return;
      }
      
      isProcessingAuthStateChangeRef.current = true;
      console.log('🔄 AuthProvider: Processing auth state change.');

      try {
        // Update the ref with the new session before setting state
        prevSessionRef.current = newSession;

        setSession(newSession);
        const newUser = newSession?.user ?? null;
        setUser(newUser);
        setAuthError(null); // Clear previous errors on new auth event

        if (newUser) {
          // Always set loading to true when a user is present and we're about to fetch/process profiles
          setLoading(true);
          if (event === 'SIGNED_IN') {
            if (newUser.app_metadata?.provider === 'github') {
              console.log('🔄 AuthProvider: GitHub sign-in detected, handling GitHub auth');
              await handleGitHubSignIn(newUser);
            } else {
              console.log('🔄 AuthProvider: Non-GitHub sign-in detected, fetching profile');
              await fetchUserProfile(newUser);
            }
          } else if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            // For these events, it's usually good to re-fetch the profile to ensure data is fresh
            console.log(`🔄 AuthProvider: Event ${event} detected, fetching profile`);
            await fetchUserProfile(newUser);
          } else if (event === 'SIGNED_OUT') {
             // This case should ideally be handled by the 'else' block below (newUser is null)
            console.log('🔄 AuthProvider: SIGNED_OUT event, clearing profiles');
            setUserProfile(null);
            setDeveloperProfile(null);
            setLoading(false);
          } else {
            // For other events where user is present, fetch profile if not already loaded or to be safe
            console.log(`🔄 AuthProvider: Auth state change (${event}), fetching profile`);
            await fetchUserProfile(newUser);
          }
        } else { // No user
          console.log('🔄 AuthProvider: No user after auth state change, clearing profiles');
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
        console.log('🔄 AuthProvider: Finished processing auth state change.');
        // Final check: if no user and profiles are null, ensure loading is false.
        // This handles cases where an async operation might have set loading true, then user becomes null.
        if (!user && !userProfile && !developerProfile) {
            setLoading(false);
        }
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
    setLoading(true);
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
    try {
      console.log('🔄 ensureDeveloperProfile: Checking/creating developer profile for:', authUser.id);
      
      // Check if developer profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
        
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ ensureDeveloperProfile: Error checking for existing profile:', checkError);
        return false;
      }
      
      if (existingProfile) {
        console.log('✅ ensureDeveloperProfile: Developer profile already exists:', existingProfile);
        setDeveloperProfile(existingProfile);
        return true;
      }
      
      // Extract GitHub data from user metadata
      const githubUsername = authUser.user_metadata?.user_name || 
                            authUser.user_metadata?.preferred_username || '';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const userBio = authUser.user_metadata?.bio || '';
      const userLocation = authUser.user_metadata?.location || '';
      const githubInstallationId = authUser.user_metadata?.installation_id || null;
      
      console.log('🔄 ensureDeveloperProfile: Creating new developer profile with GitHub handle:', githubUsername);
      
      // Create new developer profile
      const { data: newDevProfile, error: createError } = await supabase
        .from('developers')
        .insert({
          user_id: authUser.id,
          github_handle: githubUsername,
          bio: userBio,
          location: userLocation,
          profile_pic_url: avatarUrl,
          github_installation_id: githubInstallationId,
          availability: true
        })
        .select();

      if (createError) {
        console.error('❌ ensureDeveloperProfile: Error creating developer profile:', createError);
        return false;
      }
      
      console.log('✅ ensureDeveloperProfile: Developer profile created:', newDevProfile);
      setDeveloperProfile(newDevProfile[0]);
      return true;
    } catch (error) {
      console.error('❌ ensureDeveloperProfile: Unexpected error:', error);
      return false;
    }
  };

  const createDeveloperProfileFromAuth = async (authUser: SupabaseUser, userProfile: User) => {
    try {
      console.log('🔄 createDeveloperProfileFromAuth: Creating developer profile for:', authUser.id);
      
      const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      
      // Check if developer profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
        
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ createDeveloperProfileFromAuth: Error checking for existing profile:', checkError);
        return false;
      }
      
      if (existingProfile) {
        console.log('✅ createDeveloperProfileFromAuth: Developer profile already exists');
        setDeveloperProfile(existingProfile);
        return true;
      }
      
      // Create new developer profile
      const { data: devProfile, error: devError } = await supabase
        .from('developers')
        .insert({
          user_id: authUser.id,
          github_handle: githubUsername || '',
          bio: authUser.user_metadata?.bio || '',
          location: authUser.user_metadata?.location || '',
          profile_pic_url: avatarUrl
        })
        .select();

      if (devError) {
        console.error('❌ createDeveloperProfileFromAuth: Error creating developer profile:', devError);
        return false;
      }
      
      console.log('✅ createDeveloperProfileFromAuth: Developer profile created:', devProfile);
      setDeveloperProfile(devProfile[0]);
      return true;
    } catch (error) {
      console.error('❌ createDeveloperProfileFromAuth: Unexpected error:', error);
      return false;
    }
  };

  const fetchDeveloperProfile = async (userId: string) => {
    try {
      console.log('🔄 fetchDeveloperProfile: Fetching developer profile for user:', userId);

      const { data: devProfile, error } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId) 
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ fetchDeveloperProfile: Error fetching developer profile:', error.message);
        setDeveloperProfile(null);
        return null;
      }

      console.log('✅ fetchDeveloperProfile: Developer profile fetched:', devProfile);
      setDeveloperProfile(devProfile || null);
      return devProfile;
    } catch (error) {
      console.error('❌ fetchDeveloperProfile: Unexpected error:', error instanceof Error ? error.message : error);
      setDeveloperProfile(null);
      return null;
    }
  };

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    console.log('🔄 handleGitHubSignIn: Processing GitHub sign-in for user:', authUser.id);
    setAuthError(null);
    // setLoading(true) is typically set by the caller like onAuthStateChange
    console.log('🔄 handleGitHubSignIn: User metadata:', authUser.user_metadata);

    try {
      const { data: existingProfile, error: profileError } = await supabase
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