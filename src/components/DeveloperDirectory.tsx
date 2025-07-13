import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DeveloperCard } from './DeveloperCard';
import { Developer } from '../types';

const DeveloperDirectory: React.FC = () => {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDevelopers = async () => {
      try {
        const { data, error } = await supabase
          .from('developers')
          .select('*, user:users(*)')
          .eq('availability', true)
          .eq('looking_for_job', true)
          .eq('user.is_approved', true);

        if (error) {
          throw error;
        }
        setDevelopers(data as Developer[]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDevelopers();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Developer Directory</h1>
      {developers.length === 0 ? (
        <p>No developers found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {developers.map(dev => (
            <DeveloperCard
              key={dev.user_id}
              developer={dev}
              onViewProfile={() => {}}
              onSendMessage={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DeveloperDirectory;
