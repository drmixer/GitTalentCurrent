import { createContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { User, Developer, AuthContextType } from '../types';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();

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
      
      const { data: userProfileData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (userError || !userProfileData) {
        console.log('⚠️ User profile not found, attempting to create');
        const success = await createUserProfileFromAuth(authUser, true);
        if (success) {
          const { data: retryUserData, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
            
          if (retryError) {
            console.error('❌ Error fetching user profile after creation:', retryError);
            setUserProfile(null);
            setLoading(false);
            return;
          }
          setUserProfile(retryUserData);
          await checkForRoleSpecificProfile(retryUserData, authUser.id);
        }
      } else {
        setUserProfile(userProfileData);
        await checkForRoleSpecificProfile(userProfileData, authUser.id);
      }
    } catch (error) {
      console.error('❌ Error fetching profiles:', error);
      setUserProfile(null);
      setLoading(false);
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser, isRetry = false): Promise<boolean> => {
    try {
      const userRole = authUser.user_metadata?.role || 'developer';
      const userName = authUser.user_metadata?.full_name || 'User';
      
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || 'unknown@example.com',
          name: userName,
          role: userRole,
        });

      if (insertError) {
        console.error('❌ Manual user profile creation failed:', insertError);
        return false; 
      }

      return true;
    } catch (error) {
      console.error('❌ Error in createUserProfileFromAuth:', error);
      return false;
    }
  };

  const checkForRoleSpecificProfile = async (userProfile: User, userId: string) => {
    try {
      if (userProfile?.role === 'developer') {
        const { data: devProfileData, error: devError } = await supabase
          .from('developers')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (devError) {
          console.error('❌ Error fetching developer profile:', devError);
        }
        
        if (!devProfileData) {
          setDeveloperProfile(null);
        } else {
          setDeveloperProfile(devProfileData);
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
          setNeedsOnboarding(true);
        } else {
          setNeedsOnboarding(false);
        }
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

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signIn,
    signInWithGitHub,
    signUp,
    signOut,
    fetchUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
