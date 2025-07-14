import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Developer, User, PortfolioItem, AppliedJob, JobRole } from '@/types';

export function useDeveloperProfile(userId: string) {
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [applications, setApplications] = useState<(AppliedJob & { job_role: JobRole })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchProfileData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch developer profile
        const { data: devData, error: devError } = await supabase
          .from('developers')
          .select('*, user:users!user_id(id, name, email, profile_pic_url)')
          .eq('user_id', userId)
          .single();

        if (devError) throw devError;
        setDeveloper(devData as Developer);
        setUser(devData.user as User);

        // Fetch portfolio items
        const { data: portfolioData, error: portfolioError } = await supabase
          .from('portfolio_items')
          .select('*')
          .eq('developer_id', devData.id);

        if (portfolioError) throw portfolioError;
        setPortfolioItems(portfolioData || []);

        // Fetch applications
        const { data: appData, error: appError } = await supabase
          .from('applied_jobs')
          .select('*, job_role:job_roles(*)')
          .eq('developer_id', devData.id);

        if (appError) throw appError;
        setApplications(appData as any);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [userId]);

  return { developer, user, portfolioItems, applications, loading, error };
}
