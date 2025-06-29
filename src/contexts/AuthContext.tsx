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

    const initializeAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        setLoading(false);
        return;
      }
      if (session?.user) {
        setUser(session.user);
        await fetchUserProfile(session.user);
        setLoading(false); // <-- Fix: stop loading after profile fetch
      } else {
        setUser(null);
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || signingOut) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
        await handleGitHubSignIn(session!.user);
        await fetchUserProfile(session!.user);
        setLoading(false); // <-- Fix: stop loading after profile fetch on auth change
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserProfile(null);
        setDeveloperProfile(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [signingOut]);

  const signOut = async () => {
    try {
      console.log('🔄 Starting sign out process...');
      setSigningOut(true);

      // Clear app state
      setUser(null);
      setUserProfile(null);
      setDeveloperProfile(null);
      setNeedsOnboarding(false);
      setLoading(false);

      // Clear browser storage
      localStorage.clear();
      sessionStorage.clear();

      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.error('❌ Error signing out:', error);
    } finally {
      window.location.replace('/login');
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: userData.name,
          role: userData.role,
          company_name: userData.role === 'recruiter' ? (userData as any).company_name : undefined,
        },
      },
    });

    if (error) throw error;
    if (data?.user) {
      console.log('✅ User signed up:', data.user.id);
    }
  };

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      const { data: userProfileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!userProfileData || error) {
        const created = await createUserProfileFromAuth(authUser);
        if (created) return await fetchUserProfile(authUser);
        setNeedsOnboarding(true);
        setLoading(false);
        return;
      }

      setUserProfile(userProfileData);
      await checkForRoleSpecificProfile(userProfileData, authUser.id);
    } catch (err) {
      console.error('❌ Error fetching profile:', err);
      setUserProfile(null);
      setNeedsOnboarding(true);
      setLoading(false);
    }
  };

  const createUserProfileFromAuth = async (authUser: SupabaseUser): Promise<boolean> => {
    try {
      const role = authUser.user_metadata?.role || 'developer';
      const name = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';

      const { error } = await supabase.rpc('create_user_profile', {
        user_id: authUser.id,
        user_email: authUser.email!,
        user_name: name,
        user_role: role,
        company_name: '',
      });

      return !error;
    } catch (err) {
      return false;
    }
  };

  const handleGitHubSignIn = async (user: SupabaseUser) => {
    const username = user.user_metadata?.user_name;
    if (!username) return;

    const { data: existing } = await supabase
      .from('developers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const payload = {
      user_id: user.id,
      github_handle: username,
      bio: user.user_metadata?.bio || '',
      availability: true,
      top_languages: [],
      linked_projects: [],
      location: user.user_metadata?.location || '',
      experience_years: 0,
      desired_salary: 0,
    };

    if (existing) {
      await supabase.from('developers').update(payload).eq('user_id', user.id);
    } else {
      await supabase.from('developers').insert(payload);
    }
  };

  const checkForRoleSpecificProfile = async (userProfile: User, userId: string) => {
    try {
      if (userProfile.role === 'developer') {
        const { data } = await supabase
          .from('developers')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!data) setNeedsOnboarding(true);
        else setDeveloperProfile(data);
      } else if (userProfile.role === 'recruiter') {
        const { data } = await supabase
          .from('recruiters')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!data) setNeedsOnboarding(true);
      }

      setLoading(false);
    } catch (err) {
      console.error('❌ Role-specific profile check failed:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      setLoading(true);
      await fetchUserProfile(user);
    }
  };

  // ------- Business Logic (jobs, hires, etc.) -------- //

  const createDeveloperProfile = async (data: Partial<Developer>) => {
    if (!user) return false;
    const { error } = await supabase.rpc('create_developer_profile', {
      p_user_id: user.id,
      ...data,
    });
    if (error) return false;
    await fetchUserProfile(user);
    return true;
  };

  const updateDeveloperProfile = async (data: Partial<Developer>) => {
    if (!user) return false;
    const cleaned = {
      ...data,
      bio: data.bio?.trim() || null,
      github_handle: data.github_handle?.trim() || null,
    };
    const { error } = await supabase.from('developers').update(cleaned).eq('user_id', user.id);
    if (error) return false;
    await fetchUserProfile(user);
    return true;
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
