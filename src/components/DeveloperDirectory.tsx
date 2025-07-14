import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DeveloperCard } from './DeveloperCard';
import { Developer } from '@/types';
import { DeveloperSnapshotModal } from './DeveloperSnapshotModal';
import { DeveloperProfileModal } from './DeveloperProfileModal';

interface DeveloperDirectoryProps {
  onSendMessage: (developerId: string, developerName: string) => void;
}

const DeveloperDirectory: React.FC<DeveloperDirectoryProps> = ({ onSendMessage }) => {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<boolean | null>(null);
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer | null>(null);
  const [isSnapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    const fetchDevelopers = async () => {
      try {
        const { data, error } = await supabase
          .from('developers')
          .select('*, user:users(*)');

        if (error) {
          throw error;
        }
        console.log('Fetched developers:', data);
        setDevelopers(data as Developer[]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDevelopers();
  }, []);

  const handleViewSnapshot = (developer: Developer) => {
    setSelectedDeveloper(developer);
    setSnapshotModalOpen(true);
  };

  const handleViewProfile = (developer: Developer) => {
    setSelectedDeveloper(developer);
    setSnapshotModalOpen(false);
    setProfileModalOpen(true);
  };

  const handleCloseModals = () => {
    setSelectedDeveloper(null);
    setSnapshotModalOpen(false);
    setProfileModalOpen(false);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const filteredDevelopers = developers.filter(developer => {
    const searchTermLower = searchTerm.toLowerCase();
    const nameMatch = developer.user?.name.toLowerCase().includes(searchTermLower) || developer.github_handle?.toLowerCase().includes(searchTermLower);
    const skillsMatch = developer.skills?.some(skill => skill.toLowerCase().includes(searchTermLower));
    const availabilityMatch = availabilityFilter === null || developer.availability === availabilityFilter;

    return (nameMatch || skillsMatch) && availabilityMatch;
  });

  console.log('Filtered developers:', filteredDevelopers);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Developer Directory</h1>
      <div className="flex justify-between mb-4">
        <input
          type="text"
          placeholder="Search by name or skill"
          className="p-2 border rounded"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select
          className="p-2 border rounded"
          value={availabilityFilter === null ? 'all' : (availabilityFilter ? 'available' : 'unavailable')}
          onChange={e => {
            if (e.target.value === 'all') {
              setAvailabilityFilter(null);
            } else {
              setAvailabilityFilter(e.target.value === 'available');
            }
          }}
        >
          <option value="all">All</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>
      {filteredDevelopers.length === 0 ? (
        <p>No developers found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevelopers.map(dev => (
            <DeveloperCard
              key={dev.user_id}
              developer={dev}
              onViewProfile={() => handleViewSnapshot(dev)}
              onSendMessage={() => onSendMessage(dev.user_id, dev.user.name)}
            />
          ))}
        </div>
      )}

      {isSnapshotModalOpen && selectedDeveloper && (
        <DeveloperSnapshotModal
          developer={selectedDeveloper}
          onClose={handleCloseModals}
          onViewProfile={handleViewProfile}
        />
      )}

      {isProfileModalOpen && selectedDeveloper && (
        <DeveloperProfileModal
          developer={selectedDeveloper}
          onClose={handleCloseModals}
        />
      )}
    </div>
  );
};

export default DeveloperDirectory;
