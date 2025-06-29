import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, Developer } from '../types';

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
        fetchUserProfile(session.user.id);
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
          // Handle GitHub sign-in with additional profile setup
          await handleGitHubSignIn(session.user);
        }
        await fetchUserProfile(session.user.id);
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
      // Check if user profile already exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error checking existing profile:', profileError);
        return;
      }

      if (!existingProfile && user.user_metadata) {
        // Get the name from localStorage if it was set during signup
        const pendingName = localStorage.getItem('pendingGitHubName');
        localStorage.removeItem('pendingGitHubName'); // Clean up

        // Create new developer profile for GitHub users
        await createUserProfile(user, {
          name: pendingName || user.user_metadata.full_name || user.user_metadata.name || 'GitHub User',
          role: 'developer',
          is_approved: true,
        });
      }
    } catch (error) {
      console.error('Error in handleGitHubSignIn:', error);
    }
  };

  const createUserProfile = async (user: SupabaseUser, userData: Partial<User>) => {
    try {
      // First try using the database function
      const { data, error: functionError } = await supabase.rpc('create_user_profile', {
        user_id: user.id,
        user_email: user.email!,
        user_name: userData.name!,
        user_role: userData.role || 'developer',
        company_name: (userData as any).company_name || ''
      });

      if (functionError) {
        console.warn('Database function failed, trying manual creation:', functionError);
        
        // Fallback to manual creation
        const userProfileData = {
          id: user.id,
          email: user.email!,
          name: userData.name!,
          role: userData.role || 'developer',
          is_approved: userData.role === 'developer',
        };

        const { error: profileError } = await supabase
          .from('users')
          .insert(userProfileData);

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          throw new Error('Failed to create user profile');
        }

        // Create role-specific profile
        if (userData.role === 'developer') {
          const { error: devError } = await supabase.rpc('create_developer_profile', {
            p_user_id: user.id,
            p_github_handle: user.user_metadata?.user_name || '',
            p_bio: user.user_metadata?.bio || '',
            p_availability: true,
            p_top_languages: [],
            p_linked_projects: [],
          });

          if (devError) {
            console.error('Error creating developer profile:', devError);
          }
        } else if (userData.role === 'recruiter') {
          const { error: recError } = await supabase
            .from('recruiters')
            .insert({
              user_id: user.id,
              company_name: (userData as any).company_name || 'Company',
              website: '',
              company_size: '',
              industry: '',
            });

          if (recError) {
            console.error('Error creating recruiter profile:', recError);
          }
        }
      }
    } catch (error) {
      console.error('Error in createUserProfile:', error);
      throw error;
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      // Fetch user profile
      const { data: userProfileData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', userError);
        throw userError;
      }

      if (!userProfileData) {
        console.log('User profile not found, user may need to complete signup');
        setUserProfile(null);
        setDeveloperProfile(null);
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      setUserProfile(userProfileData);

      // If user is a developer, try to fetch developer profile
      if (userProfileData.role === 'developer') {
        const { data: devProfileData, error: devError } = await supabase
          .from('developers')
          .select('*')
          .eq('user_id', userId)
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
        p_hourly_rate: profileData.hourly_rate || 0,
      });

      if (error) {
        console.error('Error creating developer profile:', error);
        return false;
      }

      // Refresh profiles after creation
      await fetchUserProfile(user.id);
      return true;
    } catch (error) {
      console.error('Error in createDeveloperProfile:', error);
      return false;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
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

      // If user is created and confirmed (or email confirmation is disabled)
      if (data.user) {
        // Wait a moment for the trigger to potentially run
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if profile was created by trigger
        const { data: existingProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        // If trigger didn't create the profile, create it manually
        if (!existingProfile) {
          console.log('Creating user profile manually...');
          await createUserProfile(data.user, userData);
        }
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};