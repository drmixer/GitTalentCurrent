import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader, AlertCircle, MapPin, Briefcase, Github } from 'lucide-react';

interface Props {
  developerId: string;
}

interface DeveloperRow {
  user_id: string;
  github_handle: string | null;
  location: string | null;
  experience_years: number | null;
  bio: string | null;
  top_languages: string[];
  profile_pic_url?: string | null;
  user: { id: string; name: string; email: string; avatar_url?: string | null };
}

export const AdminDeveloperPreview: React.FC<Props> = ({ developerId }) => {
  const [developer, setDeveloper] = useState<DeveloperRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        setLoading(true);

        const { data, error } = await supabase
          .from('developers')
          .select('*, user:users(id, name, email, avatar_url)')
          .eq('user_id', developerId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setDeveloper(null);
          setError('Developer profile not found');
          return;
        }
        setDeveloper(data as any);
      } catch (e: any) {
        console.error('AdminDeveloperPreview error:', e);
        setError(e?.message || 'Failed to load developer profile');
        setDeveloper(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [developerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-3 text-gray-600 font-medium">Loading developer profile...</span>
      </div>
    );
  }

  if (error || !developer) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-800">{error || 'Developer not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-center text-xl font-bold mr-4">
          {developer.user.name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-900">{developer.user.name}</h2>
          <div className="text-gray-600">{developer.user.email}</div>
          <div className="flex items-center text-gray-600 mt-2">
            <MapPin className="w-4 h-4 mr-1" />
            {developer.location || '—'}
          </div>
          <div className="flex items-center text-gray-600 mt-1">
            <Briefcase className="w-4 h-4 mr-1" />
            {developer.experience_years != null ? `${developer.experience_years} years` : '—'}
          </div>
          <div className="flex items-center text-gray-600 mt-1">
            <Github className="w-4 h-4 mr-1" />
            {developer.github_handle ? (
              <a href={`https://github.com/${developer.github_handle}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                @{developer.github_handle}
              </a>
            ) : (
              'Not connected'
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-3">About</h3>
        <p className="text-gray-700 whitespace-pre-wrap">{developer.bio || 'No bio provided'}</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-3">Top Languages</h3>
        <div className="flex flex-wrap gap-2">
          {(developer.top_languages || []).length > 0 ? (
            (developer.top_languages || []).map((lang, idx) => (
              <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                {lang}
              </span>
            ))
          ) : (
            <div className="text-gray-600">No languages listed</div>
          )}
        </div>
      </div>
    </div>
  );
};
