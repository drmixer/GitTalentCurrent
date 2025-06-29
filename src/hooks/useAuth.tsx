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

        // Try to create user profile using the database function
        const { data, error } = await supabase.rpc('create_user_profile', {
          user_id: user.id,
          user_email: user.email!,
          user_name: pendingName || user.user_metadata?.full_name || user.user_metadata?.name || 'GitHub User',
          user_role: 'developer',
          company_name: ''
        });

        if (error) {
          console.warn('Database function failed, this might be expected if profile already exists:', error);
        }
      }
    } catch (error) {
      console.error('Error in handleGitHubSignIn:', error);
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
              hourly_rate: 0,
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
        p_hourly_rate: profileData.hourly_rate || 0,
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};