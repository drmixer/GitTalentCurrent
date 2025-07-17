import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Developer, User, PortfolioItem } from '@/types';

export function useDeveloperProfile(userId: string) {
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
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
          .select(`
            *,
            portfolio_items:portfolio_items(*)
          `)
          .eq('user_id', userId)
          .single();

        if (devError) throw devError;
        console.log("useDeveloperProfile: devData", devData);
        setDeveloper(devData as Developer);
        setPortfolioItems(devData.portfolio_items || []);

        // Fetch user data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select(`
            *,
            github_installation_id
          `)
          .eq('id', userId)
          .single();

        if (userError) throw userError;
        console.log("useDeveloperProfile: userData", userData);
        setUser(userData as User);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [userId]);

  return { developer, user, portfolioItems, loading, error };
}
