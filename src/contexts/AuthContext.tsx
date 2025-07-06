import { createContext, useState, useEffect, ReactNode, useContext } from 'react';
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
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [developerProfile, setDeveloperProfile] = useState<Developer | null | undefined>(null);

  useEffect(() => {
    console.log('🔄 AuthProvider: Initializing auth state...');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔄 AuthProvider: Initial session:', session ? 'Found' : 'None');
      setSession(session);
      setUser(session?.user ?? null);
      setAuthError(null);
      
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 AuthProvider: Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        // Check for GitHub installation_id in URL state parameter
        try {
          const url = new URL(window.location.href);
          const stateParam = url.searchParams.get('state');
          
          if (stateParam && session?.user) {
            try {
              const stateObj = JSON.parse(stateParam);
              if (stateObj.installation_id) {
                console.log('🔄 AuthProvider: Found installation_id in state param:', stateObj.installation_id);
                
                // Only inject if not already present
                if (!session.user.user_metadata?.app_installation_id) {
                  console.log('🔄 AuthProvider: Injecting installation_id into user metadata');
                  // We can't directly modify user metadata, but we'll use it in our profile update
                }
              }
            } catch (e) {
              console.log('🔄 AuthProvider: Error parsing state param:', e);
            }
          }
        } catch (e) {
          console.log('🔄 AuthProvider: Error processing URL params:', e);
        }
        
        setSession(session);
        const newUser = session?.user ?? null;
        setUser(newUser);
        setAuthError(null);
        
        if (newUser) {
          if (event === 'SIGNED_IN') {
            if (newUser.app_metadata?.provider === 'github') {
              await handleGitHubSignIn(newUser);
            } else {
              await fetchUserProfile(newUser);
            }
          } else {
            await fetchUserProfile(newUser);
          }
        } else {
          setUserProfile(null);
          setDeveloperProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      console.log('🔄 AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 fetchUserProfile: Fetching profile for user:', authUser.id);
      console.log('🔄 fetchUserProfile: Auth user metadata:', 
        authUser.user_metadata ? 'Present' : 'Missing');
      setAuthError(null);
      
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('🔄 fetchUserProfile: Profile not found, creating one');
        const profileCreated = await createUserProfileFromAuth(authUser);
        
        if (profileCreated) {
          // Try fetching again after creation
          console.log('🔄 fetchUserProfile: Profile created, fetching again');
          return await fetchUserProfile(authUser);
        } else {
          console.error('❌ fetchUserProfile: Failed to create profile');
          setAuthError('Failed to create your profile. Please try again.');
          setLoading(false);
          return null;
        }
      } else if (error) {
        console.error('❌ fetchUserProfile: Error fetching user profile:', error);
        setAuthError('Failed to load your profile. Please try again.');
        setLoading(false);
        return null;
      }

      console.log('✅ fetchUserProfile: User profile fetched:', profile);
      setUserProfile(profile);

      if (profile.role === 'developer') {
        await fetchDeveloperProfile(authUser.id);
      }

      setLoading(false);
      return profile;
    } catch (error) {
      console.error('❌ fetchUserProfile: Unexpected error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
      setLoading(false);
      return null;
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
        console.error('❌ fetchDeveloperProfile: Error fetching developer profile:', error);
        setDeveloperProfile(null);
        return;
      }

      console.log('✅ fetchDeveloperProfile: Developer profile fetched:', devProfile);
      setDeveloperProfile(devProfile || null);
    } catch (error) {
      console.error('❌ fetchDeveloperProfile: Unexpected error:', error);
      setDeveloperProfile(null);
    }
  };

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    console.log('🔄 handleGitHubSignIn: Processing GitHub sign-in for user:', authUser.id);
    
    // Clear any previous errors
    setAuthError(null);
    
    try {
      // First, check if the user profile exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('🔄 handleGitHubSignIn: User profile not found, creating one');
        
        // Extract data from GitHub metadata
        const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
        const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || githubUsername || 'GitHub User';
        const avatarUrl = authUser.user_metadata?.avatar_url || null;
        
        // Try to get role from localStorage (set during signup)
        const userRole = localStorage.getItem('gittalent_signup_role') || 'developer';
        const userName = localStorage.getItem('gittalent_signup_name') || fullName;
        
        console.log('🔄 handleGitHubSignIn: Creating profile with name:', userName, 'role:', userRole);
        
        // Create user profile
        const { data: createdProfile, error: createError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || 'unknown@example.com',
            name: userName || 'GitHub User',
            role: userRole === 'recruiter' ? 'recruiter' : 'developer', // Default to developer if not recruiter
            is_approved: userRole !== 'recruiter' // Auto-approve developers and admins
          })
          .select()
          .single();
        
        if (createError) {
          console.error('❌ handleGitHubSignIn: Error creating user profile:', createError);
          setAuthError('Failed to create user profile. Please try again.');
          setLoading(false);
          return;
        }
        
        console.log('✅ handleGitHubSignIn: User profile created successfully');
        setUserProfile(createdProfile);
        
        // If it's a developer, create developer profile
        if (userRole === 'developer' && githubUsername) {
          console.log('🔄 handleGitHubSignIn: Creating developer profile with GitHub handle:', githubUsername);
          console.log('🔄 handleGitHubSignIn: Avatar URL:', avatarUrl);
          
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
          } else {
            console.log('✅ handleGitHubSignIn: Developer profile created successfully');
            await fetchDeveloperProfile(authUser.id);
          }
        }
      } else if (profileError) {
        // Some other error occurred
        console.error('❌ handleGitHubSignIn: Error fetching user profile:', profileError);
        setAuthError('Failed to load your profile. Please try again.');
        setLoading(false);
      } else {
        // Profile exists, set it
        console.log('✅ handleGitHubSignIn: User profile found:', existingProfile.id);
        setUserProfile(existingProfile);
        
        // If it's a developer, fetch developer profile
        if (existingProfile.role === 'developer') {
          await fetchDeveloperProfile(authUser.id);
        }
      }
    } catch (error) {
      console.error('❌ handleGitHubSignIn: Error handling GitHub sign in:', error);
      setAuthError('Error during GitHub sign in. Please try again.');
      setLoading(false);
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      console.log('🔄 createUserProfileFromAuth: Creating user profile from auth user:', authUser.id);
      
      // Extract role with fallbacks
      // Try to get role from localStorage first (set during signup)
      const localStorageRole = localStorage.getItem('gittalent_signup_role');
      const userRole = localStorageRole || 
                       authUser.user_metadata?.role || 
                       (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
      
      // Extract name with fallbacks
      // Try to get name from localStorage first (set during signup)
      const localStorageName = localStorage.getItem('gittalent_signup_name');
      const userName = localStorageName ||
                       authUser.user_metadata?.full_name || 
                       authUser.user_metadata?.name || 
                       authUser.user_metadata?.user_name ||
                       'User';
                      
      const companyName = authUser.user_metadata?.company_name || 'Company';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';

      console.log('🔄 createUserProfileFromAuth: Creating profile with role:', userRole, 'name:', userName);

      // Create user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || 'unknown@example.com',
          name: userName,
          role: userRole,
          is_approved: userRole === 'developer' || userRole === 'admin'
        })
        .select()
        .single();

      if (userError) {
        console.error('❌ createUserProfileFromAuth: Error creating user profile:', userError);
        setAuthError('Failed to create user profile. Please try again.');
        return false;
      }

      console.log('✅ createUserProfileFromAuth: User profile created successfully');
      setUserProfile(userData);

      // Create role-specific profile if needed
      if (userRole === 'developer') {
        const githubHandle = authUser.user_metadata?.user_name || '';
        
        // Create developer profile
        const { error: devError } = await supabase
          .from('developers')
          .insert({
            user_id: authUser.id,
            github_handle: githubHandle,
            bio: authUser.user_metadata?.bio || '',
            location: authUser.user_metadata?.location || '',
            profile_pic_url: avatarUrl
          });

        if (devError) {
          console.error('❌ createUserProfileFromAuth: Error creating developer profile:', devError);
          return false;
        }
        
        console.log('✅ createUserProfileFromAuth: Developer profile created successfully');
        await fetchDeveloperProfile(authUser.id);
      } else if (userRole === 'recruiter') {
        // Create recruiter profile
        const { error: recError } = await supabase
          .from('recruiters')
          .insert({
            user_id: authUser.id,
            company_name: companyName
          });

        if (recError) {
          console.error('❌ createUserProfileFromAuth: Error creating recruiter profile:', recError);
          return false;
        }
        
        console.log('✅ createUserProfileFromAuth: Recruiter profile created successfully');
      }

      return true;
    } catch (error) {
      console.error('❌ createUserProfileFromAuth: Error creating user profile from auth:', error);
      setAuthError('Failed to create user profile. Please try again.');
      return false;
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    try {
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing up user:', email, userData.role);

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
        console.error('❌ AuthProvider: Sign up error:', error);
        setAuthError(error.message);
        return { error };
      }

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email,
            name: userData.name,
            role: userData.role,
            is_approved: userData.role === 'developer' // Auto-approve developers
          });

        if (profileError) {
          console.error('❌ AuthProvider: Error creating user profile:', profileError);
          setAuthError(profileError.message);
          return { error: profileError };
        }

        console.log('✅ AuthProvider: User signed up successfully');
      }

      return { data, error: null };
    } catch (error: any) {
      console.error('❌ AuthProvider: Unexpected sign up error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setAuthError(null);
      console.log('🔄 signIn: Attempting to sign in user');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ signIn: Error during sign in:', error);
        setAuthError(error.message);
        return { user: null, error };
      }

      console.log('✅ signIn: User signed in successfully:', data.user?.id);
      return { user: data.user, error: null };
    } catch (error: any) {
      console.error('❌ signIn: Unexpected error:', error);
      setAuthError('An unexpected error occurred during sign in. Please try again.');
      return { user: null, error };
    }
  };

  const signInWithGitHub = async () => {
    try {
      setAuthError(null);
      console.log('🔄 signInWithGitHub: Attempting GitHub sign in');
      
      // Store any signup data from localStorage in the state parameter
      const name = localStorage.getItem('gittalent_signup_name');
      const role = localStorage.getItem('gittalent_signup_role');
      
      // Create a state object with localStorage data and any passed params
      const stateParam = JSON.stringify({
        name,
        role,
        ...stateParams
      });
      
      console.log('🔄 signInWithGitHub: Using state param:', stateParam);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'read:user user:email',
          state: stateParam
        }
      });

      if (error) {
        console.error('❌ signInWithGitHub: Error during GitHub sign in:', error);
        setAuthError(error.message);
        return { error };
      }

      console.log('✅ signInWithGitHub: GitHub sign in initiated');
      return { error: null };
    } catch (error: any) {
      console.error('❌ signInWithGitHub: Unexpected error:', error);
      setAuthError('An unexpected error occurred during GitHub sign in. Please try again.');
      return { error };
    }
  };

  const connectGitHubApp = async () => {
    try {
      console.log('🔄 connectGitHubApp: Initiating GitHub App connection');
      setAuthError(null);
      
      if (!user) {
        throw new Error('User must be authenticated to connect GitHub App');
      }

      // Use the correct GitHub App slug
      const GITHUB_APP_SLUG = 'GitTalentApp';
      
      // Create state parameter with user ID and redirect URL
      const stateParam = encodeURIComponent(JSON.stringify({
        user_id: user.id,
        redirect_uri: `${window.location.origin}/github-setup`
      }));
      
      // Create the redirect URL
      const redirectUrl = encodeURIComponent(`${window.location.origin}/github-setup`);
      
      // Build the GitHub App installation URL
      const githubAppUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${stateParam}&redirect_uri=${redirectUrl}`;
      
      console.log('🔄 connectGitHubApp: Redirecting to GitHub App installation:', githubAppUrl);
      window.location.href = githubAppUrl;
      
      return { error: null };
    } catch (error: any) {
      console.error('❌ connectGitHubApp: Error:', error);
      setAuthError('Failed to connect GitHub App. Please try again.');
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setSigningOut(true);
      console.log('🔄 signOut: Attempting to sign out user');

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('❌ signOut: Error during sign out:', error);
        setAuthError(error.message);
        return { error };
      }

      console.log('✅ signOut: User signed out successfully');
      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setAuthError(null);
      return { error: null };
    } catch (error: any) {
      console.error('❌ signOut: Unexpected error:', error);
      setAuthError('An unexpected error occurred during sign out. Please try again.');
      return { error };
    } finally {
      setSigningOut(false);
    }
  };

  const createDeveloperProfile = async (profileData: Partial<Developer>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create developer profile');
      }

      console.log('🔄 createDeveloperProfile: Creating developer profile for user:', user.id);

      const { data, error } = await supabase
        .from('developers')
        .insert([{
          user_id: user.id,
          ...profileData
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ createDeveloperProfile: Error creating developer profile:', error);
        throw error;
      }

      console.log('✅ createDeveloperProfile: Developer profile created successfully');
      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ createDeveloperProfile: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const updateDeveloperProfile = async (updates: Partial<Developer>) => {
    try {
      if (!user || !developerProfile) {
        throw new Error('User and developer profile must exist to update');
      }

      console.log('🔄 updateDeveloperProfile: Updating developer profile for user:', user.id);

      const { data, error } = await supabase
        .from('developers')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ updateDeveloperProfile: Error updating developer profile:', error);
        throw error;
      }

      console.log('✅ updateDeveloperProfile: Developer profile updated successfully');
      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ updateDeveloperProfile: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const createJobRole = async (jobData: Partial<JobRole>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create job role');
      }

      console.log('🔄 createJobRole: Creating job role for user:', user.id);

      const { data, error } = await supabase
        .from('job_roles')
        .insert([{
          recruiter_id: user.id,
          ...jobData
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ createJobRole: Error creating job role:', error);
        throw error;
      }

      console.log('✅ createJobRole: Job role created successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ createJobRole: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const updateJobRole = async (jobId: string, updates: Partial<JobRole>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update job role');
      }

      console.log('🔄 updateJobRole: Updating job role:', jobId);

      const { data, error } = await supabase
        .from('job_roles')
        .update(updates)
        .eq('id', jobId)
        .eq('recruiter_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ updateJobRole: Error updating job role:', error);
        throw error;
      }

      console.log('✅ updateJobRole: Job role updated successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ updateJobRole: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const createAssignment = async (assignmentData: Partial<Assignment>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create assignment');
      }

      console.log('🔄 createAssignment: Creating assignment for user:', user.id);

      const { data, error } = await supabase
        .from('assignments')
        .insert([{
          assigned_by: user.id,
          ...assignmentData
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ createAssignment: Error creating assignment:', error);
        throw error;
      }

      console.log('✅ createAssignment: Assignment created successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ createAssignment: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const createHire = async (hireData: Partial<Hire>) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to create hire');
      }

      console.log('🔄 createHire: Creating hire for user:', user.id);

      const { data, error } = await supabase
        .from('hires')
        .insert([{
          marked_by: user.id,
          ...hireData
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ createHire: Error creating hire:', error);
        throw error;
      }

      console.log('✅ createHire: Hire created successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ createHire: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean) => {
    try {
      if (!user) {
        throw new Error('User must be authenticated to update approval status');
      }

      console.log('🔄 updateUserApprovalStatus: Updating approval status for user:', userId);

      const { data, error } = await supabase
        .from('users')
        .update({ is_approved: isApproved })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ updateUserApprovalStatus: Error updating approval status:', error);
        throw error;
      }

      console.log('✅ updateUserApprovalStatus: Approval status updated successfully');
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ updateUserApprovalStatus: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const updateProfileStrength = async (strength: number) => {
    try {
      if (!user || !developerProfile) {
        throw new Error('User and developer profile must exist to update profile strength');
      }

      console.log('🔄 updateProfileStrength: Updating profile strength for user:', user.id);

      const { data, error } = await supabase
        .from('developers')
        .update({ profile_strength: strength })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ updateProfileStrength: Error updating profile strength:', error);
        throw error;
      }

      console.log('✅ updateProfileStrength: Profile strength updated successfully');
      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error: any) {
      console.error('❌ updateProfileStrength: Unexpected error:', error);
      return { data: null, error };
    }
  };

  const refreshProfile = async () => {
    try {
      if (!user) {
        console.log('🔄 refreshProfile: No user, skipping profile refresh');
        return { error: new Error('User must be authenticated to refresh profile') };
      }

      console.log('🔄 refreshProfile: Refreshing profile for user:', user.id);
      const profile = await fetchUserProfile(user);
      
      if (profile && profile.role === 'developer') {
        await fetchDeveloperProfile(user.id);
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('❌ refreshProfile: Unexpected error:', error);
      return { error };
    }
  };

  const value = {
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
    needsOnboarding: !developerProfile && userProfile?.role === 'developer'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};