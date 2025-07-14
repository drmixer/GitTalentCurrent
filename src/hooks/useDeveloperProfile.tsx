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

        // Fetch developer profile and user data
        const { data: devData, error: devError } = await supabase
          .from('developers')
          .select(`
            *,
            user:users(*)
          `)
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
