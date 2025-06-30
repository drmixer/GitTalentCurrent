import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DeveloperCard } from './DeveloperCard';
import { DeveloperSnapshotCard } from './Profile/DeveloperSnapshotCard';
import { DeveloperProfileDetails } from './Profile/DeveloperProfileDetails';
import { MessageThread } from './Messages/MessageThread';
import { 
  Search, 
  Filter, 
  Users, 
  ArrowLeft,
  Loader
} from 'lucide-react';
import { Developer, User } from '../types';

interface DeveloperListProps {
  recruiterId: string;
}

export const DeveloperList: React.FC<DeveloperListProps> = ({ recruiterId }) => {
  const [developers, setDevelopers] = useState<(Developer & { user: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer & { user: User } | null>(null);
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [showMessageThread, setShowMessageThread] = useState(false);

  useEffect(() => {
    fetchAssignedDevelopers();
  }, [recruiterId]);

  const fetchAssignedDevelopers = async () => {
    try {
      setLoading(true);
      console.log('DeveloperList: Fetching assigned developers for recruiter:', recruiterId);
      setError('');

      // Fetch assignments for this recruiter
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('developer_id')
        .eq('recruiter_id', recruiterId);

      if (assignmentsError) throw assignmentsError;

      if (!assignments || assignments.length === 0) {
        console.log('DeveloperList: No assignments found for recruiter');
        setDevelopers([]);
        setLoading(false);
        return;
      }

      // Get unique developer IDs
      const developerIds = [...new Set(assignments.map(a => a.developer_id))];

      console.log('DeveloperList: Found developer IDs:', developerIds);
      // Fetch developer profiles with user data
      const { data: developersData, error: developersError } = await supabase
        .from('developers')
        .select(`
          *,
          user:users(*)
        `)
        .in('user_id', developerIds);

      if (developersError) throw developersError;
      console.log('DeveloperList: Fetched developers:', developersData?.length || 0);
      setDevelopers(developersData || []);

    } catch (error: any) {
      console.error('Error fetching assigned developers:', error);
      setError(error.message || 'Failed to load developers');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (developer: Developer & { user: User }) => {
    setSelectedDeveloper(developer);
    setShowFullProfile(false);
    console.log('Selected developer for profile view:', developer);
  };

  const handleViewFullProfile = () => {
    setShowFullProfile(true);
    console.log('Viewing full profile for developer:', selectedDeveloper?.user_id);
  };

  const handleSendMessage = (developer: Developer & { user: User }) => {
    setSelectedDeveloper(developer);
    setShowMessageThread(true);
  };

  const handleBackToList = () => {
    setSelectedDeveloper(null);
    setShowFullProfile(false);
    setShowMessageThread(false);
  };

  const filteredDevelopers = developers.filter(dev => 
    !searchTerm || 
    dev.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.github_handle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.top_languages.some(lang => lang.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
        <span className="text-gray-600 font-medium">Loading developers...</span>
      </div>
    );
  }

  if (showMessageThread && selectedDeveloper) {
    return (
      <div className="space-y-6">
        <button
          onClick={handleBackToList}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Developers
        </button>
        
        <MessageThread
          otherUserId={selectedDeveloper.user_id}
          otherUserName={selectedDeveloper.user.name}
          otherUserRole="developer"
          onBack={handleBackToList}
        />
      </div>
    );
  }

  if (selectedDeveloper) {
    if (showFullProfile) {
      return (
        <div className="space-y-6">
          <button
            onClick={() => setShowFullProfile(false)}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Developer Card
          </button>
          
          <DeveloperProfileDetails
            developer={selectedDeveloper}
            onClose={() => setSelectedDeveloper(null)}
          />
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <button
          onClick={handleBackToList}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Developers
        </button>
        
        <DeveloperSnapshotCard
          developer={selectedDeveloper}
          onViewFullProfile={handleViewFullProfile}
          className="max-w-3xl mx-auto"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Assigned Developers</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search developers..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4 mr-2 text-gray-500" />
            Filter
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {filteredDevelopers.length > 0 ? (
        <div className="grid gap-6">
          {filteredDevelopers.map((developer) => (
            <DeveloperCard
              key={developer.user_id}
              developer={developer}
              onViewProfile={() => handleViewProfile(developer)}
              onSendMessage={() => handleSendMessage(developer)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Developers Found</h3>
          <p className="text-gray-600">
            {searchTerm 
              ? "No developers match your search criteria" 
              : "You don't have any assigned developers yet"}
          </p>
        </div>
      )}
    </div>
  );
};