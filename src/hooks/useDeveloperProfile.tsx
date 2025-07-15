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

        // Fetch developer profile, user data, and portfolio items
        const { data: devData, error: devError } = await supabase
          .from('developers')
          .select(`
            *,
            portfolio_items:portfolio_items(*)
          `)
          .eq('user_id', userId)
          .single();

        if (devError) throw devError;

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (userError) throw userError;

        // Merge developer and user data
        const mergedDeveloperData = {
          ...devData,
          name: userData.name,
          avatar_url: userData.avatar_url,
        };

        setDeveloper(mergedDeveloperData as Developer);
        setUser(userData as User);
        setPortfolioItems(devData.portfolio_items || []);

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
