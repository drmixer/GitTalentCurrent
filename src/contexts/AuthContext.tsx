import { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
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

  useEffect(() => {
    let mounted = true;
    setMounted(true); // Ensure mounted is true on effect run

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth... Checking for existing session');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Error getting session:', error);
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setUser(session?.user ?? null);
          if (session?.user) {
            console.log('✅ Session found for user:', session.user.id);
            await fetchUserProfile(session.user);
          } else {
            console.log('ℹ️ No session found');
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('🔄 Auth state changed:', event, 'User ID:', session?.user?.id, 'Signing out:', signingOut);

      if (signingOut && event !== 'SIGNED_OUT') {
        console.log('🔄 Still in signing out process, ignoring auth change');
        return;
      }

      try {
        const newUser = session?.user ?? null;
        setUser(newUser);

        if (newUser) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            console.log('✅ User signed in, handling profile setup...');
            setTimeout(async () => {
              if (newUser.app_metadata?.provider === 'github') {
                await handleGitHubSignIn(newUser);
              }
              await fetchUserProfile(newUser);
            }, 500);
          } else {
            await fetchUserProfile(newUser);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('🔄 User signed out, clearing auth state...');
          setUserProfile(null);
          setDeveloperProfile(null);
          setLoading(false);
          setSigningOut(false);
        }
      } catch (error) {
        console.error('❌ Error in auth state change:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      setMounted(false);
      subscription.unsubscribe();
    };
  }, [signingOut]);

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 Handling GitHub sign-in for user:', authUser.id);
      console.log('🔄 GitHub user metadata:', JSON.stringify(authUser.user_metadata, null, 2)); // Keep this log for diagnostics

      const pendingName = localStorage.getItem('pendingGitHubName');
      localStorage.removeItem('pendingGitHubName');

      const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
      const fullName = pendingName || authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'GitHub User';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';

      const userRole = authUser.user_metadata?.role || 'developer';
      console.log('🔄 Determined role for GitHub user:', userRole);

      const { data, error } = await supabase.rpc('create_user_profile', {
        user_id: authUser.id,
        user_email: authUser.email!,
        user_name: fullName,
        user_role: userRole,
        company_name: authUser.user_metadata?.company_name || ''
      });

      if (error) {
        console.warn('⚠️ Database function failed, this might be expected if profile already exists:', error);
      }

      if (githubUsername && userRole === 'developer') {
        let githubInstallationId: string | null = null;
        // Check common top-level keys
        if (authUser.user_metadata?.installation_id) {
          githubInstallationId = String(authUser.user_metadata.installation_id);
        } else if (authUser.user_metadata?.app_installation_id) {
          githubInstallationId = String(authUser.user_metadata.app_installation_id);
        }
        // Check for nested 'github' object
        else if (authUser.user_metadata?.github?.installation_id) {
          githubInstallationId = String(authUser.user_metadata.github.installation_id);
        }
        // If the installation_id is part of raw_user_meta_data (stringified JSON)
        else if (typeof authUser.user_metadata?.raw_user_meta_data === 'string') {
          try {
            const rawMetaData = JSON.parse(authUser.user_metadata.raw_user_meta_data);
            if (rawMetaData.installation_id) {
              githubInstallationId = String(rawMetaData.installation_id);
            } else if (rawMetaData.app_installation_id) {
              githubInstallationId = String(rawMetaData.app_installation_id);
            }
          } catch (parseError) {
            console.warn('Could not parse raw_user_meta_data for installation_id:', parseError);
          }
        }

        if (!githubInstallationId) {
          console.warn('⚠️ GitHub Installation ID NOT found in user_metadata after all checks.');
        } else {
          console.log('✅ GitHub Installation ID found:', githubInstallationId);
        }

        await createOrUpdateGitHubDeveloperProfile(authUser.id, githubUsername, avatarUrl, authUser.user_metadata, githubInstallationId);
      }
    } catch (error) {
      console.error('❌ Error in handleGitHubSignIn:', error);
    }
  };

  const createOrUpdateGitHubDeveloperProfile = async (userId: string, githubUsername: string, avatarUrl: string, githubMetadata: any, installationId: string | null = null) => {
    try {
      console.log('🔄 Creating/updating GitHub developer profile for:', userId);

      const { data: existingProfile } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId)
        .single();

      const profileData = {
        user_id: userId,
        github_handle: githubUsername,
        bio: githubMetadata?.bio || '',
        availability: true,
        top_languages: [],
        linked_projects: [],
        location: githubMetadata?.location || '',
        experience_years: 0,
        desired_salary: 0,
        profile_pic_url: avatarUrl || '',
        github_installation_id: installationId || existingProfile?.github_installation_id || null
      };

      if (existingProfile) {
        await supabase
          .from('developers')
          .update({
            github_handle: githubUsername,
            bio: githubMetadata?.bio || existingProfile.bio,
            location: githubMetadata?.location || existingProfile.location,
            profile_pic_url: avatarUrl || existingProfile.profile_pic_url,
            github_installation_id: installationId || existingProfile.github_installation_id || null
          })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('developers')
          .insert(profileData);
      }

      console.log('✅ GitHub developer profile created/updated successfully');
    } catch (error) {
      console.error('❌ Error creating/updating GitHub developer profile:', error);
    }
  };

  const signOut = async () => {
    try {
      setSigningOut(true);
      console.log('🔄 Starting sign out process...');

      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setNeedsOnboarding(false);

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Error during sign out:', error);
        throw error;
      }

      console.log('✅ Sign out API call successful');

    } catch (error) {
      console.error('❌ Error in signOut:', error);
      throw error;
    } finally {
      setSigningOut(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔄 Signing in with email...');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('❌ Sign in error:', error);
      throw error;
    }
  };

  const signInWithGitHub = async () => {
    console.log('🔄 Signing in with GitHub...');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        // REVERTED: Removed ?installation_id=true from here.
        // Supabase will handle the redirect to this URL after OAuth.
        redirectTo: `${window.location.origin}/github-setup`,
        scopes: 'read:user user:email'
      },
    });
    if (error) {
      console.error('❌ GitHub sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    try {
      console.log('🔄 Signing up user...');
      console.log('🔄 User data for signup:', userData);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: userData.name,
            role: userData.role,
            company_name: userData.role === 'recruiter' ? (userData as any).company_name : undefined,
          }
        }
      });

      if (error) throw error;

      if (data?.user) {
        console.log('✅ User signed up successfully:', data.user.id, 'with role:', userData.role);
      }
    } catch (error) {
      console.error('❌ Signup error:', error);
      throw error;
    }
  };

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 Fetching user profile for:', authUser.id);
      console.log('🔄 Auth user metadata (in fetchUserProfile):', JSON.stringify(authUser.user_metadata));

      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: userProfileData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (userError || !userProfileData) {
        console.log('⚠️ User profile not found, attempting to create:', userError?.message);
        console.log('🔄 Auth user metadata for profile creation (in fetchUserProfile):', JSON.stringify(authUser.user_metadata));

        const success = await createUserProfileFromAuth(authUser);

        if (success) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const { data: retryUserData, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (retryError) {
            console.error('❌ Error fetching user profile after creation:', retryError);
            if (mounted) {
              setUserProfile(null);
              setDeveloperProfile(null);
              setNeedsOnboarding(true);
              setLoading(false);
            }
            return;
          }

          if (mounted) {
            setUserProfile(retryUserData);
            await checkForRoleSpecificProfile(retryUserData, authUser.id);
          }
        } else {
          console.error('❌ Failed to create user profile');
          if (mounted) {
            setUserProfile(null);
            setDeveloperProfile(null);
            setNeedsOnboarding(true);
            setLoading(false);
          }
          return;
        }
      } else {
        console.log('✅ User profile found:', userProfileData.role);
        if (mounted) {
          setUserProfile(userProfileData);
          await checkForRoleSpecificProfile(userProfileData, authUser.id);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching profiles:', error);
      if (mounted) {
        setUserProfile(null);
        setDeveloperProfile(null);
        setLoading(false);
      }
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      console.log('🔄 Creating user profile from auth user:', authUser.id);

      const userRole = authUser.user_metadata?.role || (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
      const userName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User';
      const companyName = authUser.user_metadata?.company_name || 'Company';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';

      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || 'unknown@example.com',
          name: userName || authUser.email?.split('@')[0] || 'User',
          role: userRole,
          is_approved: userRole === 'developer' || userRole === 'admin'
        });

      if (insertError) {
        console.error('❌ User profile creation failed:', insertError);
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
            console.warn('Could not parse raw_user_meta_data for installation_id during creation:', parseError);
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
          console.error('❌ Error creating developer profile:', devError);
        } else {
          console.log('✅ Developer profile created successfully');
        }
      } else if (userRole === 'recruiter') {
        const { error: recError } = await supabase
          .from('recruiters')
          .insert({
            user_id: authUser.id,
            company_name: companyName
          });

        if (recError) {
          console.error('❌ Error creating recruiter profile:', recError);
        } else {
          console.log('✅ Recruiter profile created successfully');
        }
      }

      console.log('✅ User profile created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in createUserProfileFromAuth:', error);
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
          console.error('❌ Error fetching developer profile:', devError);
        }

        if (!devProfileData) {
          console.log('⚠️ Developer profile not found, needs onboarding');
          setDeveloperProfile(null);
          setNeedsOnboarding(true);
        } else {
          console.log('✅ Developer profile found');
          setDeveloperProfile(devProfileData);

          if (!devProfileData.github_installation_id && devProfileData.github_handle) {
            console.log('⚠️ GitHub App not installed, but GitHub handle exists');
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
          console.error('❌ Error fetching recruiter profile:', recError);
        }

        if (!recProfileData) {
          console.log('⚠️ Recruiter profile not found, needs onboarding');
          setNeedsOnboarding(true);
        } else {
          console.log('✅ Recruiter profile found');
          setNeedsOnboarding(false);
        }

        setDeveloperProfile(null);
      } else {
        setDeveloperProfile(null);
      }
    } catch (error) {
      console.error('❌ Error checking role-specific profile:', error);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const createDeveloperProfile = async (profileData: Partial<Developer>): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔄 Creating developer profile for:', user.id);

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
        console.error('❌ Error creating developer profile:', error);
        return false;
      }

      console.log('✅ Developer profile created successfully');

      await updateProfileStrength();

      await fetchUserProfile(user);
      return true;
    } catch (error) {
      console.error('❌ Error in createDeveloperProfile:', error);
      return false;
    }
  };

  const updateDeveloperProfile = async (profileData: Partial<Developer>): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔄 Updating developer profile for:', user.id);

      const cleanedData = {
        ...profileData,
        bio: profileData.bio?.trim() || null,
        github_handle: profileData.github_handle?.trim() || null,
        location: profileData.location?.trim() || null,
        linked_projects: profileData.linked_projects?.filter(p => p.trim()) || [],
        top_languages: profileData.top_languages?.filter(l => l.trim()) || [],
        profile_pic_url: profileData.profile_pic_url?.trim() || null,
        github_installation_id: profileData.github_installation_id || null
      };

      const { error } = await supabase
        .from('developers')
        .update(cleanedData)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Error updating developer profile:', error);
        return false;
      }

      console.log('✅ Developer profile updated successfully');

      await updateProfileStrength();

      await fetchUserProfile(user);
      return true;
    } catch (error) {
      console.error('❌ Error in updateDeveloperProfile:', error);
      return false;
    }
  };

  const updateProfileStrength = async (): Promise<void> => {
    if (!user) return;

    try {
      console.log('🔄 Updating profile strength for:', user.id);

      const { data, error } = await supabase.rpc('calculate_profile_strength_rpc', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error updating profile strength:', error);
        return;
      }

      console.log('✅ Profile strength updated to:', data);
    } catch (error) {
      console.error('❌ Error in updateProfileStrength:', error);
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
        console.error('❌ Error creating job role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error in createJobRole:', error);
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
        console.error('❌ Error updating job role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error in updateJobRole:', error);
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
        console.error('❌ Error creating assignment:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error in createAssignment:', error);
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
        console.error('❌ Error creating hire:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error in createHire:', error);
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
        console.error('❌ Error updating user approval status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error in updateUserApprovalStatus:', error);
      return false;
    }
  };

  const value = {
    user,
    userProfile,
    developerProfile,
    loading,
    needsOnboarding,
    signIn,
    signInWithGitHub,
    signUp,
    signOut,
    refreshProfile: async () => {
      if (user) {
        console.log('🔄 Refreshing profile...');
        setLoading(true);
        await fetchUserProfile(user);
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
