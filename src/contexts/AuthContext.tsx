import { createContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import {
  User, Developer, JobRole, Assignment, Hire, AuthContextType,
} from '../types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [developerProfile, setDeveloperProfile] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Get initial session
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

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('🔄 Auth state changed:', event, 'User ID:', session?.user?.id, 'Signing out flag:', signingOut);
      
      // Skip processing if we're in the middle of signing out
      if (signingOut) { 
        console.log('🔄 Still in signing out process, ignoring auth change');
        return;
      }

      try {
        const newUser = session?.user ?? null;
        setUser(newUser);
        
        if (newUser) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') { 
            console.log('✅ User signed in or token refreshed, handling profile setup...');
            await handleGitHubSignIn(newUser);
          }
          await fetchUserProfile(newUser);
        } else if (event === 'SIGNED_OUT') {
          // Clear all state when user signs out
          console.log('🔄 Clearing auth state...');
          setUserProfile(null);
          setDeveloperProfile(null);
          setNeedsOnboarding(false);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error in auth state change:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [signingOut]);

  const signOut = async () => {
    try {
      console.log('🔄 Starting sign out process');
      setSigningOut(true); // Set flag to prevent auth state change handler from running
      
      // Clear all state before signing out from Supabase
      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setNeedsOnboarding(false);
      
      // Clear all state before signing out from Supabase
      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setNeedsOnboarding(false);
      
      // Clear all state before signing out
      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setNeedsOnboarding(false);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Error signing out:', error);
        throw error;
      }
      
      console.log('✅ Sign out successful');
    } catch (error) {
        throw error;
      }
      
      console.log('✅ Successfully signed out');
    } catch (error) {
      console.error('❌ Error in signOut:', error);
      throw error;
    } finally {
      setLoading(false);
      setSigningOut(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔄 Signing in with email...');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGitHub = async () => {
    console.log('🔄 Signing in with GitHub...');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: 'read:user user:email'
      }
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    try {
      console.log('🔄 Signing up user...');
      console.log('🔄 User data for signup:', userData);
      
      // First, sign up the user
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

      // The trigger should handle profile creation, but we'll verify it worked
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
      console.log('🔄 Auth user metadata:', JSON.stringify(authUser.user_metadata));
      
      // Add a small delay to ensure database operations are complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // First, try to fetch user profile with error handling
      const { data: userProfileData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      // If we get a 500 error or the user doesn't exist, try to create the profile
      if (userError || !userProfileData) {
        console.log('⚠️ User profile not found, attempting to create:', userError?.message || 'No data');
        console.log('🔄 Auth user metadata for profile creation:', JSON.stringify(authUser.user_metadata));
        
        // Try to create the user profile
        const success = await createUserProfileFromAuth(authUser, true);
        
        if (success) {
          // Add another delay and retry fetching the profile
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: retryUserData, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
            
          if (retryError) {
            console.error('❌ Error fetching user profile after creation:', retryError);
            setUserProfile(null);
            setDeveloperProfile(null);
            setLoading(false);
            return;
          }
          console.log('✅ User profile created and fetched successfully:', retryUserData);
          
          setUserProfile(retryUserData);
          await checkForRoleSpecificProfile(retryUserData, authUser.id);
        } else {
          console.error('❌ Failed to create user profile');
          setUserProfile(null);
          setDeveloperProfile(null);
          setLoading(false);
          return;
        }
      } else {
        console.log('✅ User profile found:', userProfileData.role);
        setUserProfile(userProfileData);
        await checkForRoleSpecificProfile(userProfileData, authUser.id);
      }
    } catch (error) {
      console.error('❌ Error fetching profiles:', error);
      setUserProfile(null);
      console.log('⚠️ Setting needsOnboarding to true due to profile fetch error');
      setDeveloperProfile(null);
      setLoading(false);
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser, isRetry = false): Promise<boolean> => {
    try {
      console.log('🔄 Creating user profile from auth user:', authUser.id);
      console.log('🔄 Auth user metadata:', JSON.stringify(authUser.user_metadata));
      
      // Determine user role from metadata or default to developer
      const userRole = authUser.user_metadata?.role || 
                      (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
      console.log('🔄 Determined user role:', userRole);
      
      const userName = authUser.user_metadata?.full_name || 
                      authUser.user_metadata?.name || 
                      authUser.email?.split('@')[0] || 
                      'User';

      // Try using the database function first
      const { error: functionError } = await supabase.rpc('create_user_profile', {
        user_id: authUser.id,
        user_email: authUser.email || 'unknown@example.com',
        user_name: userName,
        user_role: userRole === 'recruiter' ? 'recruiter' : 'developer', // Ensure recruiter role is preserved
        company_name: ''
      });

      if (functionError) {
        console.warn('⚠️ Database function failed, trying manual creation:', functionError.message);
        
        // Fallback to manual creation
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || 'unknown@example.com',
            name: userName,
            role: userRole === 'recruiter' ? 'recruiter' : 'developer',
            is_approved: userRole === 'recruiter' ? false : true, // Only auto-approve developers
          });

        if (insertError) {
          console.error('❌ Manual user profile creation failed:', insertError);
          console.log('⚠️ User profile creation failed with error:', insertError.message);
          return false; 
        }

        // Create developer profile if needed
        if (userRole === 'developer' || authUser.app_metadata?.provider === 'github') {
          const { error: devError } = await supabase.from('developers').insert({
            user_id: authUser.id,
            github_handle: authUser.user_metadata?.user_name || '',
            bio: authUser.user_metadata?.bio || '',
            availability: true,
            top_languages: [],
            linked_projects: [],
            location: '',
            experience_years: 0,
            desired_salary: 0,
          });

          if (devError) {
            console.error('❌ Error creating developer profile:', devError);
            console.log('⚠️ Developer profile creation failed with error:', devError.message);
          } else {
            console.log('✅ Developer profile created successfully');
          }
        } else if (userRole === 'recruiter') {
          // Create recruiter profile
          const companyName = authUser.user_metadata?.company_name || 'Company';
          const { error: recError } = await supabase.from('recruiters').insert({
            user_id: authUser.id,
            company_name: companyName,
            website: '',
            company_size: '',
            industry: ''
          });
            
          if (recError) {
            console.error('❌ Error creating recruiter profile:', recError);
            console.log('⚠️ Recruiter profile creation failed with error:', recError.message);
          } else {
            console.log('✅ Recruiter profile created successfully');
          }
        }
      }

      console.log('✅ User profile created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in createUserProfileFromAuth:', error);
      return false;
    }
  };

  const handleGitHubSignIn = async (user: SupabaseUser) => {
    try {
      console.log('🔄 Handling GitHub sign-in for user:', user.id, 'with provider:', user.app_metadata?.provider);
      console.log('🔄 GitHub user metadata:', user.user_metadata);
      
      // Get the name from localStorage if it was set during signup
      const pendingName = localStorage.getItem('pendingGitHubName');
      localStorage.removeItem('pendingGitHubName'); // Clean up

      // Extract GitHub username from user metadata
      const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username || '';
      const fullName = pendingName || user.user_metadata?.full_name || user.user_metadata?.name || 'GitHub User';

      // Determine the role - GitHub users are typically developers
      const userRole = user.user_metadata?.role || 'developer';
      console.log('🔄 Determined role for GitHub user:', userRole);

      // Try to create or update user profile using the database function
      const { error } = await supabase.rpc('create_user_profile', {
        user_id: user.id,
        user_email: user.email!,
        user_name: fullName,
        user_role: userRole,
        company_name: ''
      });

      if (error) {
        console.warn('⚠️ Database function failed, this might be expected if profile already exists:', error.message);
      }

      // If this is a GitHub user, also try to create/update developer profile with GitHub data
      if (githubUsername && userRole === 'developer') {
        await createOrUpdateGitHubDeveloperProfile(user.id, githubUsername, user.user_metadata);
      }
    } catch (error) {
      console.error('❌ Error in handleGitHubSignIn:', error);
    }
  };

  const createOrUpdateGitHubDeveloperProfile = async (userId: string, githubUsername: string, githubMetadata: any) => {
    try {
      console.log('🔄 Creating/updating GitHub developer profile for:', userId);
      console.log('🔄 GitHub username:', githubUsername);
      console.log('🔄 GitHub metadata:', githubMetadata ? 'present' : 'none');
      
      // Check if developer profile exists
      const { data: existingProfile } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId)
        .single();

      console.log('🔄 Existing developer profile:', existingProfile ? 'found' : 'not found');
      const profileData: Partial<Developer> = {
        user_id: userId,
        github_handle: githubUsername || '',
        bio: githubMetadata?.bio || '',
        availability: true,
        top_languages: [],
        linked_projects: [],
        location: githubMetadata?.location || '',
        experience_years: 0,
        desired_salary: 0,
      };

      if (existingProfile) {
        // Update existing profile with GitHub data
        const { error: updateError } = await supabase
          .from('developers') 
          .update(existingProfile ? {
            github_handle: githubUsername,
            bio: githubMetadata?.bio || existingProfile.bio,
            location: githubMetadata?.location || existingProfile.location,
          } : {})
          .eq('user_id', userId);
          
        if (updateError) {
          console.error('❌ Error updating GitHub developer profile:', updateError.message);
          return;
        }
        
      } else {
        // Create new developer profile
        const { error: insertError } = await supabase
          .from('developers')
          .insert(profileData);

        if (insertError) {
          console.error('❌ Error creating GitHub developer profile:', insertError.message);
          return;
        }
      }

      console.log('✅ GitHub developer profile created/updated successfully');
    } catch (error) {
      console.error('❌ Error creating/updating GitHub developer profile:', error);
    }
  };

  const checkForRoleSpecificProfile = async (userProfile: User, userId: string) => {
    try {
      console.log('🔄 Checking for role-specific profile:', userProfile.role);
      console.log('🔄 User ID:', userId);

      
      if (userProfile?.role === 'developer') {
        // Check for developer profile
        const { data: devProfileData, error: devError } = await supabase
          .from('developers')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('🔄 Developer profile fetch result:', devProfileData ? 'found' : 'not found');
        if (devError && devError.code !== 'PGRST116') {
          console.error('❌ Error fetching developer profile:', devError);
        }
        
        if (!devProfileData) {
          // Developer profile doesn't exist, needs onboarding
          console.log('⚠️ Developer profile not found, needs onboarding');
          setDeveloperProfile(null);
          setNeedsOnboarding(true);
        } else {
          console.log('✅ Developer profile found:', devProfileData);
          console.log('🔄 GitHub handle from profile:', devProfileData.github_handle || 'none');
          setDeveloperProfile(devProfileData);
          setNeedsOnboarding(false);
        }
      } else if (userProfile.role === 'recruiter') {
        // Check for recruiter profile
        const { data: recProfileData, error: recError } = await supabase
          .from('recruiters')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('🔄 Recruiter profile fetch result:', recProfileData ? 'found' : 'not found');
        if (recError && recError.code !== 'PGRST116') {
          console.error('❌ Error fetching recruiter profile:', recError);
          setNeedsOnboarding(true);
        }
        
        if (!recProfileData) {
          console.log('⚠️ Recruiter profile not found, needs onboarding');
          setNeedsOnboarding(true);
        } else {
          console.log('✅ Recruiter profile found');
          setNeedsOnboarding(false);
        }
      } else {
        // Admin or other role
        console.log('ℹ️ Admin or other role, no specific profile needed');
        setDeveloperProfile(null);
        setNeedsOnboarding(false);
      }
    } catch (error: any) {
      console.error('❌ Error checking role-specific profile:', error.message || error);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      console.log('🔄 Refreshing profile...');
      setLoading(true);
      await fetchUserProfile(user);
    }
  };

  // ------- Business Logic (jobs, hires, etc.) -------- //

  const createDeveloperProfile = async (data: Partial<Developer>) => {
    if (!user) return false;

    try {
      console.log('🔄 Creating developer profile for:', user.id);
      
      const { data: result, error } = await supabase.rpc('create_developer_profile', {
        p_user_id: user.id,
        p_github_handle: data.github_handle || '',
        p_bio: data.bio || '',
        p_availability: data.availability ?? true,
        p_top_languages: data.top_languages || [],
        p_linked_projects: data.linked_projects || [],
        p_location: data.location || '',
        p_experience_years: data.experience_years || 0,
        p_desired_salary: data.desired_salary || 0,
      });

      if (error) {
        console.error('❌ Error creating developer profile:', error);
        return false;
      }

      console.log('✅ Developer profile created successfully');
      // Refresh profiles after creation
      await fetchUserProfile(user);
      return true;
    } catch (error) {
      console.error('❌ Error in createDeveloperProfile:', error);
      return false;
    }
  };

  const updateDeveloperProfile = async (data: Partial<Developer>) => {
    if (!user) return false;

    try {
      console.log('🔄 Updating developer profile for:', user.id);
      
      // Convert empty strings to null for nullable fields
      const cleanedData = {
        ...data,
        bio: data.bio?.trim() || null,
        github_handle: data.github_handle?.trim() || null,
        location: data.location?.trim() || null,
        linked_projects: data.linked_projects?.filter(p => p.trim()) || [],
        top_languages: data.top_languages?.filter(l => l.trim()) || [],
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
      // Refresh profiles after update
      await fetchUserProfile(user);
      return true;
    } catch (error) {
      console.error('❌ Error in updateDeveloperProfile:', error);
      return false;
    }
  };

  const createJobRole = async (job: Partial<JobRole>) => {
    if (!user) return false;
    const { error } = await supabase.from('job_roles').insert({ ...job, recruiter_id: user.id });
    return !error;
  };

  const updateJobRole = async (id: string, job: Partial<JobRole>) => {
    if (!user) return false;
    const { error } = await supabase
      .from('job_roles')
      .update(job)
      .eq('id', id)
      .eq('recruiter_id', user.id);
    return !error;
  };

  const createAssignment = async (a: Partial<Assignment>) => {
    if (!user) return false;
    const { error } = await supabase.from('assignments').insert({ ...a, assigned_by: user.id });
    return !error;
  };

  const importJobsFromCSV = async (jobs: Partial<JobRole>[]) => {
    let success = 0, failed = 0;
    for (const job of jobs) {
      const result = await createJobRole(job);
      result ? success++ : failed++;
    }
    return { success, failed };
  };

  const createHire = async (h: Partial<Hire>) => {
    if (!user) return false;
    const { error } = await supabase.from('hires').insert({ ...h, marked_by: user.id });
    return !error;
  };

  const updateUserApprovalStatus = async (id: string, approved: boolean) => {
    const { error } = await supabase.from('users').update({ is_approved: approved }).eq('id', id);
    return !error;
  };

  const value: AuthContextType = {
    user,
    userProfile,
    developerProfile,
    loading,
    needsOnboarding,
    signIn,
    signInWithGitHub,
    signUp,
    signOut,
    refreshProfile,
    createDeveloperProfile,
    updateDeveloperProfile,
    createJobRole,
    updateJobRole,
    createAssignment,
    importJobsFromCSV,
    createHire,
    updateUserApprovalStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};