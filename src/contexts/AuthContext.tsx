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

  useEffect(() => {
    console.log('🔄 AuthProvider: Initializing auth state...');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔄 AuthProvider: Initial session:', session ? 'Found' : 'None');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 AuthProvider: Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          if (event === 'SIGNED_IN') {
            if (session.user.app_metadata?.provider === 'github') {
              await handleGitHubSignIn(session.user);
            } else {
              await fetchUserProfile(session.user);
            }
          } else {
            await fetchUserProfile(session.user);
          }
        } else {
          setUserProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      console.log('🔄 AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGitHub = async () => {
    console.log('🔄 signInWithGitHub: Signing in with GitHub...');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github', 
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'read:user user:email repo', 
        queryParams: {
          state: 'github_oauth_login'
        }
      },
    });
    if (error) {
      console.error('❌ signInWithGitHub: GitHub sign in error:', error);
      throw error;
    }
    console.log('✅ signInWithGitHub: GitHub OAuth initiated successfully');
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    try {
      console.log('🔄 signUp: Signing up user...');
      console.log('🔄 signUp: User data for signup:', userData);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      });

      if (error) {
        console.error('❌ signUp: Sign up error:', error);
        throw error;
      }

      console.log('✅ signUp: User signed up successfully');
      return data;
    } catch (error) {
      console.error('❌ signUp: Error in signUp:', error);
      throw error;
    }
  };

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 fetchUserProfile: Fetching user profile for:', authUser.id, 'Email:', authUser.email);
      console.log('🔄 fetchUserProfile: Auth user metadata:', authUser.user_metadata);
      
      // No delay needed, proceed immediately
      
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('❌ fetchUserProfile: Error fetching user profile:', error);
        setLoading(false);
        return;
      }

      if (!userProfile) {
        console.log('🔄 fetchUserProfile: No user profile found, creating one...');
        const profileCreated = await createUserProfileFromAuth(authUser);
        console.log('🔄 fetchUserProfile: Profile creation result:', profileCreated);
        
        // Try fetching again after a short delay
        setTimeout(async () => {
          const { data: retryProfile, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
            
          if (retryError) {
            console.error('❌ fetchUserProfile: Error in retry fetch:', retryError);
            setLoading(false);
            return;
          }
          
          if (retryProfile) {
            console.log('✅ fetchUserProfile: User profile found on retry:', retryProfile.name, 'Role:', retryProfile.role);
            setUserProfile(retryProfile);
            await checkForRoleSpecificProfile(retryProfile, authUser.id);
          } else {
            console.error('❌ fetchUserProfile: Still no profile after creation attempt');
          }
          
          setLoading(false);
        }, 1000);
        return;
      }

      console.log('✅ fetchUserProfile: User profile found:', userProfile.name, 'Role:', userProfile.role);
      setUserProfile(userProfile);
      
      await checkForRoleSpecificProfile(userProfile, authUser.id);
      
      setLoading(false);
    } catch (error) {
      console.error('❌ fetchUserProfile: Error in fetchUserProfile:', error);
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 handleGitHubSignIn: Processing GitHub user:', authUser.id, authUser.email);
      console.log('🔄 handleGitHubSignIn: GitHub user metadata:', authUser.user_metadata);

      const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || githubUsername || 'GitHub User';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';
      const email = authUser.email;

      let githubInstallationId: string | null = null;
      if (authUser.user_metadata?.installation_id) {
        githubInstallationId = String(authUser.user_metadata.installation_id);
      } else if (authUser.user_metadata?.app_installation_id) {
        githubInstallationId = String(authUser.user_metadata.app_installation_id);
      }

      const userRole = authUser.user_metadata?.role || 'developer';
      console.log('🔄 handleGitHubSignIn: Determined role for GitHub user:', userRole, 'with name:', fullName);

      // Always create or update the GitHub developer profile
      await createOrUpdateGitHubDeveloperProfile(authUser.id, githubUsername || '', avatarUrl, authUser.user_metadata, githubInstallationId);

      await fetchUserProfile(authUser);
    } catch (error) {
      console.error('❌ handleGitHubSignIn: Error handling GitHub sign in:', error);
      setLoading(false);
    }
  };

  const createOrUpdateGitHubDeveloperProfile = async (userId: string, githubUsername: string, avatarUrl: string, githubMetadata: any, installationId: string | null = null) => {
    try {
      console.log('🔄 createOrUpdateGitHubDeveloperProfile: Creating/updating GitHub developer profile for:', userId);
      console.log('🔄 createOrUpdateGitHubDeveloperProfile: GitHub username:', githubUsername || 'none', 'Installation ID:', installationId || 'none');

      // First ensure user profile exists
      const { error: userError } = await supabase.rpc('create_user_profile', {
        user_id: userId,
        user_email: githubMetadata?.email || 'unknown@example.com',
        user_name: githubMetadata?.name || githubUsername || 'GitHub User',
        user_role: 'developer',
        company_name: ''
      });
      
      if (userError) {
        console.warn('⚠️ Error creating user profile:', userError);
      }

      // Then create/update developer profile
      const { error: devError } = await supabase.rpc('create_developer_profile', {
        p_user_id: userId,
        p_github_handle: githubUsername || '',
        p_bio: githubMetadata?.bio || '',
        p_availability: true,
        p_top_languages: [],
        p_linked_projects: [],
        p_location: githubMetadata?.location || 'Remote',
        p_experience_years: 0,
        p_desired_salary: 0,
        p_profile_pic_url: avatarUrl || null,
        p_github_installation_id: installationId
      });
      
      if (devError) {
        console.error('Error creating/updating developer profile:', devError);
        throw devError;
      }

      console.log('✅ createOrUpdateGitHubDeveloperProfile: GitHub developer profile created/updated successfully in DB');
    } catch (error) {
      console.error('❌ createOrUpdateGitHubDeveloperProfile: Error creating/updating GitHub developer profile:', error);
    }
  };

  const signOut = async () => {
    try {
      setSigningOut(true);
      console.log('🔄 signOut: Starting sign out process...');

      setUser(null);
      setUserProfile(null);
      setSession(null);

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ signOut: Sign out error:', error);
        throw error;
      }
      console.log('✅ signOut: User signed out successfully');
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
    console.log('✅ signIn: User signed in successfully');
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      console.log('🔄 createUserProfileFromAuth: Creating user profile from auth user:', authUser.id);
      console.log('🔄 createUserProfileFromAuth: Auth user metadata:', authUser.user_metadata);
      
      // Extract role with fallbacks
      const userRole = authUser.user_metadata?.role || 
                      (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
      
      // Extract name with fallbacks
      const userName = authUser.user_metadata?.full_name || 
                      authUser.user_metadata?.name || 
                      authUser.user_metadata?.user_name ||
                      'User';
                      
      const companyName = authUser.user_metadata?.company_name || 'Company';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';
      const email = authUser.email;

      let githubInstallationId: string | null = null;
      if (authUser.user_metadata?.installation_id || authUser.user_metadata?.app_installation_id) {
        githubInstallationId = String(authUser.user_metadata.installation_id || authUser.user_metadata.app_installation_id);
        console.log('🔄 createUserProfileFromAuth: Found GitHub installation ID:', githubInstallationId);
      }

      const { data: userResult, error: insertUserError } = await supabase
        .rpc('create_user_profile', {
          user_id: authUser.id,
          user_email: email || authUser.email || 'unknown@example.com',
          user_name: userName || authUser.email?.split('@')[0] || 'User',
          user_role: userRole,
          company_name: companyName
        });

      if (insertUserError) {
        console.error('❌ createUserProfileFromAuth: User profile creation failed:', insertUserError.message);
        if (insertUserError.code === '23505') {
          console.warn('⚠️ createUserProfileFromAuth: User profile already exists (unique constraint violation). Treating as success.');
          return true;
        }
        return false;
      } else {
        console.log('✅ createUserProfileFromAuth: User profile created successfully:', userResult);
      }

      if (userRole === 'developer' || authUser.app_metadata?.provider === 'github') {
        // Create developer profile using the RPC function
        const devResult = await createOrUpdateGitHubDeveloperProfile(
          authUser.id,
          authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username || '',
          avatarUrl,
          authUser.user_metadata,
          githubInstallationId
        );
        
        console.log('✅ createUserProfileFromAuth: Developer profile creation result:', devResult);
      } else if (userRole === 'recruiter') {
        const { error: recError } = await supabase
          .from('recruiters')
          .insert({
            user_id: authUser.id,
            company_name: companyName,
            website: '',
            company_size: '',
            industry: '',
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

      return true;
    } catch (error) {
      console.error('❌ createUserProfileFromAuth: Error in createUserProfileFromAuth:', error instanceof Error ? error.message : error);
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
        } else if (!devProfileData) {
          console.log('🔄 checkForRoleSpecificProfile: No developer profile found, creating one...');
          
          // Create a basic developer profile
          const { error: createError } = await supabase.rpc('create_developer_profile', {
            p_user_id: userId,
            p_github_handle: '',
            p_bio: '',
            p_availability: true,
            p_top_languages: [],
            p_linked_projects: [],
            p_location: '',
            p_experience_years: 0,
            p_desired_salary: 0
          });
          
          if (createError) {
            console.error('❌ checkForRoleSpecificProfile: Error creating developer profile:', createError);
          } else {
            console.log('✅ checkForRoleSpecificProfile: Created basic developer profile');
          }
        } else {
          console.log('✅ checkForRoleSpecificProfile: Developer profile found');
        }
      } else if (userProfile?.role === 'recruiter') {
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
    } catch (error) {
      console.error('❌ checkForRoleSpecificProfile: Error in checkForRoleSpecificProfile:', error);
    }
  };

  const createDeveloperProfile = async (profileData: Partial<Developer>): Promise<boolean> => {
    if (!user) return false;

    console.log('🔄 createDeveloperProfile: Creating developer profile for:', user.id);
    
    // Use the RPC function to create/update the developer profile
    const { error } = await supabase.rpc('create_developer_profile', {
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
  };

  const updateDeveloperProfile = async (profileData: Partial<Developer>): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔄 updateDeveloperProfile: Updating developer profile for:', user.id);

      const cleanedData = {
        ...profileData,
        github_handle: profileData.github_handle?.trim() || '',
        bio: profileData.bio?.trim() || '',
        location: profileData.location?.trim() || '',
        profile_pic_url: profileData.profile_pic_url?.trim() || null,
        github_installation_id: profileData.github_installation_id || null 
      };

      const { error } = await supabase
        .from('developers')
        .update(cleanedData)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ updateDeveloperProfile: Error updating developer profile:', error);
        return false;
      }

      console.log('✅ updateDeveloperProfile: Developer profile updated successfully');

      await updateProfileStrength();

      await fetchUserProfile(user);
      return true;
    } catch (error) {
      console.error('❌ updateDeveloperProfile: Error in updateDeveloperProfile:', error);
      return false;
    }
  };

  const updateProfileStrength = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('update_profile_strength', {
        user_id: user.id
      });

      if (error) {
        console.error('❌ updateProfileStrength: Error updating profile strength:', error);
      } else {
        console.log('✅ updateProfileStrength: Profile strength updated successfully');
      }
    } catch (error) {
      console.error('❌ updateProfileStrength: Error in updateProfileStrength:', error);
    }
  };

  const createJobRole = async (jobData: Partial<JobRole>): Promise<boolean> => {
    if (!user) return false;

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
  };

  const updateJobRole = async (jobId: string, jobData: Partial<JobRole>): Promise<boolean> => {
    if (!user) return false;

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
  };

  const createAssignment = async (assignmentData: Partial<Assignment>): Promise<boolean> => {
    if (!user) return false;

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
  };

  const createHire = async (hireData: Partial<Hire>): Promise<boolean> => {
    if (!user) return false;

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
  };

  const updateUserApprovalStatus = async (userId: string, isApproved: boolean): Promise<boolean> => {
    const { error } = await supabase
      .from('users')
      .update({ is_approved: isApproved })
      .eq('id', userId);

    if (error) {
      console.error('❌ updateUserApprovalStatus: Error updating user approval status:', error);
      return false;
    }

    return true;
  };

  const value = {
    user,
    session,
    userProfile,
    developerProfile: null, // Add this to fix the type error
    loading,
    signingOut,
    signUp,
    signIn,
    signInWithGitHub,
    signOut,
    createDeveloperProfile,
    updateDeveloperProfile,
    createJobRole,
    updateJobRole,
    createAssignment,
    createHire,
    updateUserApprovalStatus,
    updateProfileStrength,
    refreshProfile: () => fetchUserProfile(user!), // Add this function
    authError: null, // Add this to fix the type error
    needsOnboarding: false // Add this to fix the type error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};