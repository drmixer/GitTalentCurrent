import { createContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { User, Developer, JobRole, Assignment, Hire, AuthContextType } from '../types';

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('🔄 Auth state changed:', event, 'User ID:', session?.user?.id, 'Signing out flag:', signingOut);
      
      if (signingOut) { 
        console.log('🔄 Still in signing out process, ignoring auth change event');
        return;
      }

      try {
        const newUser = session?.user ?? null;
        setUser(newUser);
        
        if (newUser) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') { 
            console.log('✅ User signed in, handling profile setup...');
            await handleGitHubSignIn(newUser);
          }
          await fetchUserProfile(newUser);
        } else if (event === 'SIGNED_OUT') {
          console.log('🔄 User signed out, clearing auth state...');
          setUserProfile(null);
          setDeveloperProfile(null);
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

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 Handling GitHub sign-in for user:', authUser.id);
      console.log('🔄 GitHub user metadata:', JSON.stringify(authUser.user_metadata));
      
      // Get the name from localStorage if it was set during signup
      const pendingName = localStorage.getItem('pendingGitHubName');
      localStorage.removeItem('pendingGitHubName'); // Clean up

      // Extract GitHub username from user metadata
      const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
      const fullName = pendingName || authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'GitHub User';

      // Determine the role - GitHub users are typically developers
      const userRole = authUser.user_metadata?.role || 'developer';
      console.log('🔄 Determined role for GitHub user:', userRole);

      // Try to create user profile using the database function
      const { data, error } = await supabase.rpc('create_user_profile', {
        user_id: authUser.id,
        user_email: authUser.email!,
        user_name: fullName,
        user_role: userRole,
        company_name: ''
      });

      if (error) {
        console.warn('⚠️ Database function failed, this might be expected if profile already exists:', error);
      }

      // If this is a GitHub user, also try to create/update developer profile with GitHub data
      if (githubUsername && userRole === 'developer') {
        await createOrUpdateGitHubDeveloperProfile(authUser.id, githubUsername, authUser.user_metadata);
      }
    } catch (error) {
      console.error('❌ Error in handleGitHubSignIn:', error);
    }
  };

  const createOrUpdateGitHubDeveloperProfile = async (userId: string, githubUsername: string, githubMetadata: any) => {
    try {
      console.log('🔄 Creating/updating GitHub developer profile for:', userId);
      
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

      console.log('✅ GitHub developer profile created/updated successfully');
    } catch (error) {
      console.error('❌ Error creating/updating GitHub developer profile:', error);
    }
  };

  const signOut = async () => {
    try {
      setSigningOut(true);
      console.log('🔄 Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setNeedsOnboarding(false);
    } catch (error) {
      console.error('❌ Error during sign out:', error);
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
      console.log('🔄 Auth user metadata:', JSON.stringify(authUser.user_metadata));
      
      const { data: userProfileData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      // If we get a 500 error or the user doesn't exist, try to create the profile
      if (userError) {
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
      } else if (!userProfileData) {
        console.log('⚠️ User profile not found, attempting to create');
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
            console.error('❌ Error fetching user profile after creation:', retryError);
            setUserProfile(null);
            setDeveloperProfile(null);            
            setNeedsOnboarding(true); // Set to true to trigger onboarding if profile creation failed
            setLoading(false);
            return;
          }
          
          setUserProfile(retryUserData);
          await checkForRoleSpecificProfile(retryUserData, authUser.id);
        } else {
          console.error('❌ Failed to create user profile');
          setUserProfile(null);
          setDeveloperProfile(null);          
          setNeedsOnboarding(true); // Set to true to trigger onboarding if profile creation failed
          setLoading(false);
          return;
        }
      } else {
        setUserProfile(userProfileData);
        await checkForRoleSpecificProfile(userProfileData, authUser.id);
      }
    } catch (error) {
      console.error('❌ Error fetching profiles:', error);
      setUserProfile(null);
      setDeveloperProfile(null);      
      setLoading(false);
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser, isRetry = false): Promise<boolean> => {
    try {
      const userRole = authUser.user_metadata?.role || (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');
      const userName = authUser.user_metadata?.full_name || 'User';
      
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || 'unknown@example.com',
          name: userName || authUser.email?.split('@')[0] || 'User',
          role: userRole,
        });

      if (insertError) {
        console.error('❌ Manual user profile creation failed:', insertError);
        return false; 
      }
      
      // Create developer profile if needed
      if (userRole === 'developer' || authUser.app_metadata?.provider === 'github') {
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
          console.error('❌ Error creating developer profile:', devError);
          // Don't fail the whole process if developer profile creation fails
        } else {
          console.log('✅ Developer profile created successfully');
        }
      }
      
      console.log('✅ User profile created successfully');
      return true;

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
          setDeveloperProfile(null);
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

  const value = {
    user,
    userProfile,
    loading,
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
    developerProfile, // Exposed developer profile state
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
