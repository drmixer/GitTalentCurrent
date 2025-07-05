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
      console.log('🔄 AuthProvider: Fetching user profile for:', authUser.id);
      setAuthError(null);
      
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error fetching user profile:', error);
        setLoading(false);
        setAuthError('Failed to load user profile. Please try again.');
        return null;
      }

      if (!userProfile) {
        console.log('🔄 AuthProvider: No user profile found, attempting to create one');
        const profileCreated = await createUserProfileFromAuth(authUser);
        if (profileCreated) {
          return await fetchUserProfile(authUser);
        } else {
          setAuthError('Failed to create user profile. Please try again.');
          setLoading(false); 
        }
        return;
      }

      console.log('✅ AuthProvider: User profile found:', userProfile.name, 'Role:', userProfile.role);
      setUserProfile(userProfile);
      
      const devProfile = await checkForRoleSpecificProfile(userProfile, authUser.id);
      
      // Set loading to false even if we couldn't get the developer profile
      setLoading(false);
      return userProfile;
    } catch (error) {
      console.error('❌ AuthProvider: Error in fetchUserProfile:', error);
      setAuthError('An unexpected error occurred while loading your profile.');
      setLoading(false); 
      return null;
    }
  };

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 handleGitHubSignIn: Processing GitHub user:', authUser.id);
      console.log('🔄 handleGitHubSignIn: GitHub user metadata:', JSON.stringify(authUser.user_metadata || {}, null, 2));

      // Check if we have an installation_id in the user metadata
      let githubInstallationId: string | null = null;
      if (authUser.user_metadata?.app_installation_id) {
        githubInstallationId = String(authUser.user_metadata.app_installation_id);
        console.log('🔄 handleGitHubSignIn: Found GitHub installation ID in metadata:', githubInstallationId);
      }
      
      const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || githubUsername || 'GitHub User';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';

      // Try to get role from localStorage (set during signup)
      const userRole = localStorage.getItem('gittalent_signup_role') || authUser.user_metadata?.role || 'developer';
      const userName = localStorage.getItem('gittalent_signup_name') || fullName;
      
      console.log('🔄 handleGitHubSignIn: Determined role for GitHub user:', userRole, 'with name:', fullName);

      if (githubUsername && userRole === 'developer') {
        try {
          // Create or update the developer profile
          const profileCreated = await createOrUpdateGitHubDeveloperProfile(
            authUser.id, 
            githubUsername, 
            userName, 
            avatarUrl, 
            authUser.user_metadata, 
            githubInstallationId
          );
          
          // If profile creation failed, set an error
          if (!profileCreated) {
            console.error('❌ handleGitHubSignIn: Failed to create developer profile');
            setAuthError('Failed to create developer profile. Please try again.');
          } else {
            console.log('✅ handleGitHubSignIn: Developer profile created/updated successfully');
          }
        } catch (profileError) {
          console.error('❌ handleGitHubSignIn: Error creating developer profile:', profileError);
          setAuthError('Error creating developer profile. Please try again.');
        }
      }
      
      // Fetch the user profile regardless of whether the developer profile was created
      const userProfile = await fetchUserProfile(authUser);
      
      if (!userProfile) {
        console.error('❌ handleGitHubSignIn: Failed to fetch user profile after GitHub sign in');
        setAuthError('Failed to load your profile. Please try again.');
      } else {
        console.log('✅ handleGitHubSignIn: User profile fetched successfully');
      }
    } catch (error) {
      console.error('❌ handleGitHubSignIn: Error handling GitHub sign in:', error);
      setAuthError('Error during GitHub sign in. Please try again.');
      setLoading(false);
    }
  };

  const createOrUpdateGitHubDeveloperProfile = async (userId: string, githubUsername: string, userName: string, avatarUrl: string, githubMetadata: any, installationId: string | null = null) => {
    try {
      console.log('🔄 createOrUpdateGitHubDeveloperProfile: Creating/updating GitHub developer profile for:', userId);
      console.log('🔄 createOrUpdateGitHubDeveloperProfile: GitHub username:', githubUsername, 'Installation ID:', installationId || 'none');
      console.log('🔄 createOrUpdateGitHubDeveloperProfile: User name:', userName, 'Avatar URL:', avatarUrl ? 'Present' : 'None');

      const { data: existingProfile, error: profileError } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('❌ createOrUpdateGitHubDeveloperProfile: Error checking for existing profile:', profileError);
        return false;
      }

      console.log('🔄 createOrUpdateGitHubDeveloperProfile: Existing profile check result:', existingProfile ? 'Found' : 'Not found');

      const profileData = {
        user_id: userId,
        github_handle: githubUsername,
        bio: githubMetadata?.bio || '',
        availability: true,
        top_languages: [],
        linked_projects: [],
        location: githubMetadata?.location || 'Remote',
        experience_years: 0,
        desired_salary: 0,
        profile_pic_url: avatarUrl,
        github_installation_id: installationId
      };

      if (existingProfile) {
        console.log('🔄 createOrUpdateGitHubDeveloperProfile: Updating existing developer profile', existingProfile.user_id);
        
        // Update the developer profile
        const { data: updatedProfile, error: updateError } = await supabase
          .from('developers')
          .update({
            github_handle: githubUsername,
            bio: existingProfile.bio || githubMetadata?.bio || '',
            location: existingProfile.location || githubMetadata?.location || 'Remote',
            profile_pic_url: avatarUrl || existingProfile.profile_pic_url,
            github_installation_id: installationId || existingProfile.github_installation_id
          })
          .eq('user_id', userId)
          .select();
          
        if (updateError) {
          console.error('Error updating developer profile:', updateError);
          return false;
        } else {
          console.log('✅ Developer profile updated successfully');
          return true;
        }
      } else {
        console.log('🔄 createOrUpdateGitHubDeveloperProfile: Creating new developer profile');
        try {
          // First ensure user profile exists
          const { data: existingUser, error: userCheckError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          
          if (userCheckError) {
            console.error('Error checking user profile:', userCheckError);
            return false;
          }
          
          if (!existingUser) {
            console.log('🔄 createOrUpdateGitHubDeveloperProfile: Creating user profile first');
            const { error: userError } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: githubMetadata?.email || 'unknown@example.com',
                name: userName || githubUsername || 'GitHub User',
                role: 'developer',
                is_approved: true
              });
          
            if (userError) {
              console.error('Error creating user profile:', userError);
              return false;
            }
          }
          
          // Then create developer profile
          const { data: newProfile, error: devError } = await supabase
            .from('developers')
            .insert(profileData)
            .select();
          
          if (devError) {
            console.error('Error creating developer profile:', devError);
            return false;
          } else {
            console.log('✅ Developer profile created successfully');
            return true;
          }
        } catch (err) {
          console.error('Error creating developer profile:', err);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ createOrUpdateGitHubDeveloperProfile: Error in createOrUpdateGitHubDeveloperProfile:', error);
      return false;
    }
  };

  const checkForRoleSpecificProfile = async (userProfile: User, userId: string): Promise<Developer | null> => {
    try {
      if (userProfile.role === 'developer') {
        console.log('🔄 checkForRoleSpecificProfile: Checking for developer profile for user:', userId);
        const { data: devProfileData, error: devError } = await supabase
          .from('developers')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (devError) {
          console.error('❌ checkForRoleSpecificProfile: Error fetching developer profile:', devError);
        } else if (!devProfileData) {
          console.log('🔄 checkForRoleSpecificProfile: No developer profile found, user may need to complete setup');
          return null;
        } else {
          console.log('✅ checkForRoleSpecificProfile: Developer profile found');
          setDeveloperProfile(devProfileData);
          return devProfileData;
        } 
      } else if (userProfile?.role === 'recruiter') {
        console.log('🔄 checkForRoleSpecificProfile: Checking for recruiter profile for user:', userId);
        const { data: recProfileData, error: recError } = await supabase
          .from('recruiters')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (recError) {
          console.error('❌ checkForRoleSpecificProfile: Error fetching recruiter profile:', recError);
        } else if (!recProfileData) {
          console.log('🔄 checkForRoleSpecificProfile: No recruiter profile found, user may need to complete setup');
        } else {
          console.log('✅ checkForRoleSpecificProfile: Recruiter profile found'); 
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ checkForRoleSpecificProfile: Error in checkForRoleSpecificProfile:', error);
      return null;
    }
  };

  const signUp = async (email: string, password: string, name: string, role: 'developer' | 'recruiter') => {
    try {
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing up user:', email, role);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role
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
            name,
            role,
            is_approved: role === 'developer' // Auto-approve developers
          });

        if (profileError) {
          console.error('❌ AuthProvider: Error creating user profile:', profileError);
          setAuthError(profileError.message);
          return { error: profileError };
        }

        console.log('✅ AuthProvider: User signed up successfully');
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected sign up error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing in user:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ AuthProvider: Sign in error:', error);
        setAuthError(error.message);
        return { error };
      }

      console.log('✅ AuthProvider: User signed in successfully');
      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signInWithGitHub = async (stateParams?: Record<string, any>) => {
    console.log('🔄 signInWithGitHub: Signing in with GitHub...');
    
    try {
      // Store any signup data from localStorage in the state parameter
      const name = localStorage.getItem('gittalent_signup_name');
      const role = localStorage.getItem('gittalent_signup_role');
    
      const stateParam = JSON.stringify({
        name,
        role,
        ...stateParams
      });
    
      console.log('🔄 signInWithGitHub: Using state param:', stateParam);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'read:user user:email',
          state: stateParam
        },
      });
      
      if (error) {
        console.error('❌ signInWithGitHub: Error signing in with GitHub:', error);
        setAuthError(error.message);
        return { error };
      }
      
      return { error: null };
    } catch (error) {
      console.error('❌ signInWithGitHub: Unexpected error:', error);
      setAuthError('An unexpected error occurred during GitHub sign in.');
      return { error };
    }
  };

  const connectGitHubApp = async () => {
    try {
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing in with GitHub App');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/github-setup`,
          scopes: 'read:user user:email'
        }
      });

      if (error) {
        console.error('❌ AuthProvider: GitHub App sign in error:', error);
        setAuthError(error.message);
        return { error };
      }

      return { data, error: null, success: true };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected GitHub App sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      console.log('🔄 createUserProfileFromAuth: Creating user profile from auth user:', authUser.id);
      console.log('🔄 createUserProfileFromAuth: Auth user metadata:', JSON.stringify(authUser.user_metadata || {}));
      
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
                       authUser.user_metadata?.preferred_username ||
                       'User';
                      
      const companyName = authUser.user_metadata?.company_name || 'Company';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';
      const githubHandle = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || '';

      console.log('🔄 createUserProfileFromAuth: Creating profile with role:', userRole, 'name:', userName);

      // First check if user profile already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
        
      if (checkError) {
        console.error('❌ createUserProfileFromAuth: Error checking for existing user:', checkError);
        setAuthError('Failed to check for existing user profile. Please try again.');
        return false;
      }
      
      if (!existingUser) {
        // Create user profile directly
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || 'unknown@example.com',
            name: userName,
            role: userRole,
            is_approved: userRole === 'developer' || userRole === 'admin'
          });

        if (userError) {
          console.error('❌ createUserProfileFromAuth: Error creating user profile:', userError);
          setAuthError('Failed to create user profile. Please try again.');
          return false;
        }
      }

      console.log('✅ createUserProfileFromAuth: User profile created successfully');

      // Create role-specific profile if needed
      if (userRole === 'developer' || authUser.app_metadata?.provider === 'github') {
        // Check if developer profile already exists
        const { data: existingDev, error: devCheckError } = await supabase
          .from('developers')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();
          
        if (devCheckError) {
          console.error('❌ createUserProfileFromAuth: Error checking for existing developer profile:', devCheckError);
        }
        
        if (!existingDev) {
          let githubInstallationId: string | null = null;
        
          // Create developer profile
          await createOrUpdateGitHubDeveloperProfile(
            authUser.id,
            githubHandle,
            userName,
            avatarUrl,
            authUser.user_metadata,
            githubInstallationId
          );
        } else {
          console.log('✅ createUserProfileFromAuth: Developer profile already exists');
        }
      }

      return true;
    } catch (error) {
      console.error('❌ createUserProfileFromAuth: Error creating user profile from auth:', error);
      setAuthError('Failed to create user profile. Please try again.');
      return false;
    }
  };

  const signOut = async () => {
    try {
      setSigningOut(true);
      setAuthError(null);
      console.log('🔄 AuthProvider: Signing out user');

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('❌ AuthProvider: Sign out error:', error);
        setAuthError(error.message);
        return { error };
      }

      setUser(null);
      setSession(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      console.log('✅ AuthProvider: User signed out successfully');
      return { error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected sign out error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthError(errorMessage);
      return { error: { message: errorMessage } };
    } finally {
      setSigningOut(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      console.log('🔄 AuthContext: Refreshing user profile for:', user.id);
      try {
        const profile = await fetchUserProfile(user);
        console.log('✅ AuthContext: Profile refreshed successfully:', profile ? 'Found' : 'Not found');
        return profile;
      } catch (error) {
        console.error('❌ AuthContext: Error refreshing profile:', error);
        return null;
      }
    }
    return null;
  };

  const createDeveloperProfile = async (profileData: Partial<Developer>): Promise<boolean> => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('developers')
        .insert({
          user_id: user.id,
          ...profileData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error creating developer profile:', error);
        return false;
      }

      setDeveloperProfile(data);
      return true;
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error creating developer profile:', error);
      return false;
    }
  };

  const updateDeveloperProfile = async (profileData: Partial<Developer>) => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('developers')
        .update(profileData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error updating developer profile:', error);
        return { error };
      }

      setDeveloperProfile(data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error updating developer profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const createJobRole = async (jobData: Partial<JobRole>) => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('job_roles')
        .insert({
          recruiter_id: user.id,
          ...jobData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error creating job role:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error creating job role:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const updateJobRole = async (jobId: string, jobData: Partial<JobRole>) => {
    try {
      const { data, error } = await supabase
        .from('job_roles')
        .update(jobData)
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error updating job role:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error updating job role:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const createAssignment = async (assignmentData: Partial<Assignment>) => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('assignments')
        .insert({
          assigned_by: user.id,
          ...assignmentData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error creating assignment:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error creating assignment:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const createHire = async (hireData: Partial<Hire>) => {
    try {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('hires')
        .insert({
          marked_by: user.id,
          ...hireData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error creating hire:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error creating hire:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ is_approved: isApproved })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error updating user approval status:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error updating user approval status:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
    }
  };

  const updateProfileStrength = async (userId: string, strength: number) => {
    try {
      const { data, error } = await supabase
        .from('developers')
        .update({ profile_strength: strength })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ AuthProvider: Error updating profile strength:', error);
        return { error };
      }

      if (userId === user?.id) {
        setDeveloperProfile(data);
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Unexpected error updating profile strength:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { error: { message: errorMessage } };
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