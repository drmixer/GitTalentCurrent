import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, Developer, JobRole, Assignment, Hire } from '../types';

interface AuthContextType {
  user: SupabaseUser | null;
  userProfile: User | null;
  developerProfile: Developer | null;
  loading: boolean;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  createDeveloperProfile: (profileData: Partial<Developer>) => Promise<boolean>;
  updateDeveloperProfile: (profileData: Partial<Developer>) => Promise<boolean>;
  createJobRole: (jobData: Partial<JobRole>) => Promise<boolean>;
  updateJobRole: (jobId: string, jobData: Partial<JobRole>) => Promise<boolean>;
  createAssignment: (assignmentData: Partial<Assignment>) => Promise<boolean>;
  createHire: (hireData: Partial<Hire>) => Promise<boolean>;
  updateUserApprovalStatus: (userId: string, isApproved: boolean) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [developerProfile, setDeveloperProfile] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        if (event === 'SIGNED_IN') {
          console.log('User signed in, handling profile setup...');
          // Handle GitHub sign-in with additional profile setup
          await handleGitHubSignIn(session.user);
        }
        await fetchUserProfile(session.user);
      } else {
        setUserProfile(null);
        setDeveloperProfile(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGitHubSignIn = async (user: SupabaseUser) => {
    try {
      // For GitHub users, we need to create the profile if it doesn't exist
      if (user.app_metadata?.provider === 'github') {
        console.log('Handling GitHub sign-in for user:', user.id);
        
        // Get the name from localStorage if it was set during signup
        const pendingName = localStorage.getItem('pendingGitHubName');
        localStorage.removeItem('pendingGitHubName'); // Clean up

        // Extract GitHub username from user metadata
        const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
        const fullName = pendingName || user.user_metadata?.full_name || user.user_metadata?.name || 'GitHub User';

        // Try to create user profile using the database function
        const { data, error } = await supabase.rpc('create_user_profile', {
          user_id: user.id,
          user_email: user.email!,
          user_name: fullName,
          user_role: 'developer',
          company_name: ''
        });

        if (error) {
          console.warn('Database function failed, this might be expected if profile already exists:', error);
        }

        // If this is a GitHub user, also try to create/update developer profile with GitHub data
        if (githubUsername) {
          await createOrUpdateGitHubDeveloperProfile(user.id, githubUsername, user.user_metadata);
        }
      }
    } catch (error) {
      console.error('Error in handleGitHubSignIn:', error);
    }
  };

  const createOrUpdateGitHubDeveloperProfile = async (userId: string, githubUsername: string, githubMetadata: any) => {
    try {
      // Check if developer profile exists
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
      };

      if (existingProfile) {
        // Update existing profile with GitHub data
        await supabase
          .from('developers')
          .update({
            github_handle: githubUsername,
            bio: githubMetadata?.bio || existingProfile.bio,
            location: githubMetadata?.location || existingProfile.location,
          })
          .eq('user_id', userId);
      } else {
        // Create new developer profile
        await supabase
          .from('developers')
          .insert(profileData);
      }

      console.log('GitHub developer profile created/updated successfully');
    } catch (error) {
      console.error('Error creating/updating GitHub developer profile:', error);
    }
  };

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('Fetching user profile for:', authUser.id);
      
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
        console.log('User profile not found, attempting to create:', userError?.message);
        
        // Try to create the user profile
        const success = await createUserProfileFromAuth(authUser);
        
        if (success) {
          // Add another delay and retry fetching the profile
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: retryUserData, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
            
          if (retryError) {
            console.error('Error fetching user profile after creation:', retryError);
            setUserProfile(null);
            setDeveloperProfile(null);
            setNeedsOnboarding(false);
            setLoading(false);
            return;
          }
          
          setUserProfile(retryUserData);
        } else {
          console.error('Failed to create user profile');
          setUserProfile(null);
          setDeveloperProfile(null);
          setNeedsOnboarding(false);
          setLoading(false);
          return;
        }
      } else {
        setUserProfile(userProfileData);
      }

      // If user is a developer, try to fetch developer profile
      const currentUserProfile = userProfileData || await getCurrentUserProfile(authUser.id);
      
      if (currentUserProfile?.role === 'developer') {
        const { data: devProfileData, error: devError } = await supabase
          .from('developers')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (devError && devError.code !== 'PGRST116') {
          console.error('Error fetching developer profile:', devError);
        }

        if (!devProfileData) {
          // Developer profile doesn't exist, needs onboarding
          console.log('Developer profile not found, needs onboarding');
          setDeveloperProfile(null);
          setNeedsOnboarding(true);
        } else {
          setDeveloperProfile(devProfileData);
          setNeedsOnboarding(false);
        }
      } else {
        setDeveloperProfile(null);
        setNeedsOnboarding(false);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      setUserProfile(null);
      setDeveloperProfile(null);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (error) {
        console.error('Error getting current user profile:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error in getCurrentUserProfile:', error);
      return null;
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      console.log('Creating user profile from auth user:', authUser.id);
      
      // Determine user role and name
      const userRole = authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer';
      const userName = authUser.user_metadata?.full_name || 
                      authUser.user_metadata?.name || 
                      authUser.email?.split('@')[0] || 
                      'User';

      // Try using the database function first
      const { data, error: functionError } = await supabase.rpc('create_user_profile', {
        user_id: authUser.id,
        user_email: authUser.email!,
        user_name: userName,
        user_role: userRole,
        company_name: ''
      });

      if (functionError) {
        console.warn('Database function failed, trying manual creation:', functionError);
        
        // Fallback to manual creation
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email!,
            name: userName,
            role: userRole,
            is_approved: true, // Auto-approve for now
          });

        if (insertError) {
          console.error('Manual user profile creation failed:', insertError);
          return false;
        }

        // Create developer profile if needed
        if (userRole === 'developer') {
          const { error: devError } = await supabase
            .from('developers')
            .insert({
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
            console.error('Error creating developer profile:', devError);
            // Don't fail the whole process if developer profile creation fails
          }
        }
      }

      console.log('User profile created successfully');
      return true;
    } catch (error) {
      console.error('Error in createUserProfileFromAuth:', error);
      return false;
    }
  };

  const createDeveloperProfile = async (profileData: Partial<Developer>): Promise<boolean> => {
    if (!user) return false;

    try {
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
      });

      if (error) {
        console.error('Error creating developer profile:', error);
        return false;
      }

      // Refresh profiles after creation
      await fetchUserProfile(user);
      return true;
    } catch (error) {
      console.error('Error in createDeveloperProfile:', error);
      return false;
    }
  };

  const updateDeveloperProfile = async (profileData: Partial<Developer>): Promise<boolean> => {
    if (!user) return false;

    try {
      // Convert empty strings to null for nullable fields
      const cleanedData = {
        ...profileData,
        bio: profileData.bio?.trim() || null,
        github_handle: profileData.github_handle?.trim() || null,
        location: profileData.location?.trim() || null,
        linked_projects: profileData.linked_projects?.filter(p => p.trim()) || [],
        top_languages: profileData.top_languages?.filter(l => l.trim()) || [],
      };

      const { error } = await supabase
        .from('developers')
        .update(cleanedData)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating developer profile:', error);
        return false;
      }

      // Refresh profiles after update
      await fetchUserProfile(user);
      return true;
    } catch (error) {
      console.error('Error in updateDeveloperProfile:', error);
      return false;
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
        console.error('Error creating job role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in createJobRole:', error);
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
        .eq('recruiter_id', user.id); // Ensure user can only update their own jobs

      if (error) {
        console.error('Error updating job role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateJobRole:', error);
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
        console.error('Error creating assignment:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in createAssignment:', error);
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
        console.error('Error creating hire:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in createHire:', error);
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
        console.error('Error updating user approval status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateUserApprovalStatus:', error);
      return false;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signInWithGitHub = async () => {
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
      if (data.user) {
        console.log('User signed up successfully:', data.user.id);
      }
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setUserProfile(null);
    setDeveloperProfile(null);
    setNeedsOnboarding(false);
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
    refreshProfile,
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