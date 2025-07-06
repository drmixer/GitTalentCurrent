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
  const [developerProfile, setDeveloperProfile] = useState<Developer | null | undefined>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Track current user ID for which profile is being fetched to avoid redundant calls
  const [profileLoadingUserId, setProfileLoadingUserId] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔄 AuthProvider: Initializing auth state...');
    setLoading(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthError(null);

      if (session?.user) {
        fetchUserProfile(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 AuthProvider: Auth state changed:', event, session ? 'Session exists' : 'No session');

      setSession(session);
      const newUser = session?.user ?? null;
      setUser(newUser);
      setAuthError(null);

      if (newUser) {
        // Avoid fetching profile multiple times for the same user
        if (profileLoadingUserId === newUser.id) {
          console.log('🔄 AuthProvider: Profile already loading for this user, skipping fetch');
          return;
        }
        setLoading(true);
        setProfileLoadingUserId(newUser.id);

        if (event === 'SIGNED_IN') {
          if (newUser.app_metadata?.provider === 'github') {
            await handleGitHubSignIn(newUser);
          } else {
            await fetchUserProfile(newUser);
          }
        } else {
          await fetchUserProfile(newUser);
        }
        setLoading(false);
        setProfileLoadingUserId(null);
      } else {
        setUserProfile(null);
        setDeveloperProfile(null);
        setLoading(false);
        setProfileLoadingUserId(null);
      }
    });

    return () => {
      console.log('🔄 AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, [profileLoadingUserId]);

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('🔄 fetchUserProfile: Fetching profile for user:', authUser.id);
      setAuthError(null);
      setLoading(true);

      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code === 'PGRST116') {
        console.log('🔄 fetchUserProfile: Profile not found, creating one');
        const created = await createUserProfileFromAuth(authUser);
        if (created) {
          console.log('🔄 fetchUserProfile: Profile created, fetching again');
          return fetchUserProfile(authUser);
        } else {
          setLoading(false);
          setAuthError('Failed to create your profile. Please try again.');
          return null;
        }
      } else if (error) {
        setLoading(false);
        setAuthError('Failed to load your profile. Please try again.');
        return null;
      }

      setUserProfile(profile);

      if (profile.role === 'developer') {
        await fetchDeveloperProfile(authUser.id);
      } else {
        setDeveloperProfile(null);
      }

      setLoading(false);
      return profile;
    } catch (e) {
      setLoading(false);
      setAuthError('An unexpected error occurred. Please try again.');
      return null;
    }
  };

  const fetchDeveloperProfile = async (userId: string) => {
    try {
      console.log('🔄 fetchDeveloperProfile: Fetching developer profile for user:', userId);

      const { data: devProfile, error } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ fetchDeveloperProfile: Error fetching developer profile:', error);
        setDeveloperProfile(null);
        return;
      }

      setDeveloperProfile(devProfile || null);
      console.log('✅ fetchDeveloperProfile: Developer profile fetched:', devProfile);
    } catch (error) {
      console.error('❌ fetchDeveloperProfile: Unexpected error:', error);
      setDeveloperProfile(null);
    }
  };

  const handleGitHubSignIn = async (authUser: SupabaseUser) => {
    console.log('🔄 handleGitHubSignIn: Processing GitHub sign-in for user:', authUser.id);
    setAuthError(null);
    setLoading(true);

    try {
      const { data: existingProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        console.log('🔄 handleGitHubSignIn: User profile not found, creating one');

        const githubUsername = authUser.user_metadata?.user_name || authUser.user_metadata?.preferred_username;
        const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || githubUsername || 'GitHub User';
        const avatarUrl = authUser.user_metadata?.avatar_url || null;
        const installationId = authUser.user_metadata?.installation_id || null;

        const userRole = localStorage.getItem('gittalent_signup_role') || 'developer';
        const userName = localStorage.getItem('gittalent_signup_name') || fullName;

        const { data: createdProfile, error: createError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || 'unknown@example.com',
            name: userName || 'GitHub User',
            role: userRole === 'recruiter' ? 'recruiter' : 'developer',
            is_approved: userRole !== 'recruiter'
          })
          .select()
          .single();

        if (createError) {
          setAuthError('Failed to create user profile. Please try again.');
          setLoading(false);
          return;
        }

        setUserProfile(createdProfile);

        if (userRole === 'developer' && githubUsername) {
          const { error: devCreateError } = await supabase
            .from('developers')
            .insert({
              user_id: authUser.id,
              github_handle: githubUsername,
              bio: authUser.user_metadata?.bio || '',
              location: authUser.user_metadata?.location || 'Remote',
              profile_pic_url: avatarUrl
            });

          if (devCreateError) {
            console.error('❌ handleGitHubSignIn: Error creating developer profile:', devCreateError);
          } else {
            await fetchDeveloperProfile(authUser.id);
          }
        }
      } else if (profileError) {
        setAuthError('Failed to load your profile. Please try again.');
      } else {
        setUserProfile(existingProfile);

        if (existingProfile.role === 'developer') {
          await fetchDeveloperProfile(authUser.id);
        }
      }
    } catch (error) {
      setAuthError('Error during GitHub sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      const localStorageRole = localStorage.getItem('gittalent_signup_role');
      const userRole = localStorageRole ||
        authUser.user_metadata?.role ||
        (authUser.app_metadata?.provider === 'github' ? 'developer' : 'developer');

      const localStorageName = localStorage.getItem('gittalent_signup_name');
      const userName = localStorageName ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.user_metadata?.preferred_username ||
        authUser.user_metadata?.user_name ||
        'User';

      const companyName = authUser.user_metadata?.company_name || 'Company';
      const avatarUrl = authUser.user_metadata?.avatar_url || '';
      const githubHandle = authUser.user_metadata?.user_name || '';
      const githubInstallationId = authUser.user_metadata?.installation_id || null;
      const userBio = authUser.user_metadata?.bio || '';
      const userLocation = authUser.user_metadata?.location || '';

      const { error: userError } = await supabase.rpc('create_user_profile', {
        user_id: authUser.id,
        user_email: authUser.email || 'unknown@example.com',
        user_name: userName,
        user_role: userRole,
        company_name: companyName
      });

      if (userError) {
        setAuthError('Failed to create user profile. Please try again.');
        return false;
      }

      if (userRole === 'developer' || authUser.app_metadata?.provider === 'github') {
        const { error: devError } = await supabase
          .from('developers')
          .insert({
            user_id: authUser.id,
            github_handle: githubHandle,
            bio: userBio,
            location: userLocation,
            top_languages: [],
            linked_projects: [],
            profile_pic_url: avatarUrl,
            github_installation_id: githubInstallationId
          });

        if (devError) {
          return false;
        }

        await fetchDeveloperProfile(authUser.id);
      }

      return true;
    } catch (error) {
      setAuthError('Failed to create user profile. Please try again.');
      return false;
    }
  };

  // --- Your existing functions (signUp, signIn, signInWithGitHub, connectGitHubApp, signOut,
  // createDeveloperProfile, updateDeveloperProfile, createJobRole, updateJobRole, createAssignment,
  // createHire, updateUserApprovalStatus, updateProfileStrength, refreshProfile) remain unchanged
  // except add `setLoading(true)` at start and `setLoading(false)` at end of async functions
  // where appropriate (especially refreshProfile).

  // For brevity, here is just refreshProfile updated with loading control:
  const refreshProfile = async (): Promise<{ error: any | null }> => {
    try {
      if (!user) {
        return { error: new Error('User must be authenticated to refresh profile') };
      }
      setLoading(true);
      const profile = await fetchUserProfile(user);
      if (profile && profile.role === 'developer') {
        await fetchDeveloperProfile(user.id);
      }
      setLoading(false);
      return { error: null };
    } catch (error: any) {
      setLoading(false);
      return { error };
    }
  };

  // All other functions you provided can stay as is, just add loading toggles where you want UX feedback.

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
