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
      setSigningOut(true);
      console.log('🔄 Signing out...');
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
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

  // Existing logic for checking role-specific profiles (no changes here)
  // ... 

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
