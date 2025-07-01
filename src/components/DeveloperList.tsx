import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
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
  Loader,
  AlertCircle
} from 'lucide-react';
import { Developer, User } from '../types';

interface DeveloperListProps {
  recruiterId?: string;
  fetchType?: 'assigned' | 'all';
  onSendMessage?: (developerId: string, developerName: string, jobRoleId?: string, jobRoleTitle?: string) => void;
}

export const DeveloperList: React.FC<DeveloperListProps> = ({ 
  recruiterId,
  fetchType = 'assigned',
  onSendMessage
}) => {
  const { userProfile } = useAuth();
  const [developers, setDevelopers] = useState<(Developer & { user: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer & { user: User } | null>(null);
  const [showFullProfile, setShowFullProfile] = useState(true);
  const [showMessageThread, setShowMessageThread] = useState(false);
  const [filterAvailability, setFilterAvailability] = useState<boolean | null>(null);
  
  // Enhanced search and filtering
  const [filterLanguages, setFilterLanguages] = useState<string[]>([]);
  const [filterExperienceMin, setFilterExperienceMin] = useState<number | null>(null);
  const [filterExperienceMax, setFilterExperienceMax] = useState<number | null>(null);
  const [filterSalaryMin, setFilterSalaryMin] = useState<number | null>(null);
  const [filterSalaryMax, setFilterSalaryMax] = useState<number | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [commonLanguages, setCommonLanguages] = useState<string[]>([]);

  useEffect(() => {
    if (recruiterId || fetchType === 'all') {
      fetchCommonLanguages();
      fetchDevelopers();
    }
  }, [recruiterId, fetchType]);

  const fetchCommonLanguages = async () => {
    try {
      // Get all developers to extract common languages
      const { data, error } = await supabase
        .from('developers')
        .select('top_languages');
        
      if (error) throw error;
      
      // Flatten the array of arrays and count occurrences
      const allLanguages = data?.flatMap(dev => dev.top_languages) || [];
      const languageCounts: Record<string, number> = {};
      
      allLanguages.forEach(lang => {
        if (lang) {
          languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        }
      });
      
      // Sort by frequency and take top 15
      const sortedLanguages = Object.entries(languageCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([lang]) => lang)
        .slice(0, 15);
        
      setCommonLanguages(sortedLanguages);
    } catch (error) {
      console.error('Error fetching common languages:', error);
    }
  };

  const buildDeveloperQuery = () => {
    let query = supabase
      .from('developers')
      .select(`
        *,
        user:users(*)
      `)
      .eq('user.is_approved', true);
      
    // Apply filters
    if (filterAvailability !== null) {
      query = query.eq('availability', filterAvailability);
    }
    
    if (filterLanguages.length > 0) {
      // Filter developers who have at least one of the selected languages
      query = query.overlaps('top_languages', filterLanguages);
    }
    
    if (filterExperienceMin !== null) {
      query = query.gte('experience_years', filterExperienceMin);
    }
    
    if (filterExperienceMax !== null) {
      query = query.lte('experience_years', filterExperienceMax);
    }
    
    if (filterSalaryMin !== null) {
      query = query.gte('desired_salary', filterSalaryMin);
    }
    
    if (filterSalaryMax !== null) {
      query = query.lte('desired_salary', filterSalaryMax);
    }
    
    if (searchTerm) {
      query = query.or(`
        user.name.ilike.%${searchTerm}%,
        github_handle.ilike.%${searchTerm}%,
        bio.ilike.%${searchTerm}%,
        location.ilike.%${searchTerm}%
      `);
    }
    
    return query;
  };

  const fetchDevelopers = async () => {
    try {
      setLoading(true);
      console.log('DeveloperList: Fetching developers, type:', fetchType);
      setError('');

      let developersData;
      
      if (fetchType === 'assigned' && recruiterId) {
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
        const { data, error: developersError } = await supabase
          .from('developers')
          .select(`
            *,
            user:users(*)
          `)
          .in('user_id', developerIds);
          
        if (developersError) throw developersError;
        developersData = data;
      } else {
        // Fetch all developers
        const query = buildDeveloperQuery();
        const { data, error: developersError } = await query;
          
        if (developersError) throw developersError;
        developersData = data;
      }
      console.log('DeveloperList: Fetched developers:', developersData?.length || 0);
      setDevelopers(developersData || []);

    } catch (error: any) {
      console.error('Error fetching developers:', error);
      setError(error.message || 'Failed to load developers');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (developer: Developer & { user: User }) => {
    setSelectedDeveloper(developer);
    setShowFullProfile(true);
    console.log('Selected developer for profile view:', developer);
  };

  const handleViewFullProfile = () => {
    setShowFullProfile(true);
    console.log('Viewing full profile for developer:', selectedDeveloper?.user_id);
  };

  const handleSendMessage = (developer: Developer & { user: User }) => {
    if (onSendMessage) {
      onSendMessage(developer.user_id, developer.user.name);
    } else {
      setSelectedDeveloper(developer);
      setShowMessageThread(true);
    }
  };

  const handleBackToList = () => {
    setSelectedDeveloper(null);
    setShowFullProfile(false);
    setShowMessageThread(false);
  };

  // Apply client-side filtering for any filters that couldn't be applied in the query
  const filteredDevelopers = developers;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
        <span className="text-gray-600 font-medium">Loading developers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
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
          otherUserProfilePicUrl={selectedDeveloper.profile_pic_url}
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
            onClick={handleBackToList}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Developers
          </button>
          
          <DeveloperProfileDetails
            developer={selectedDeveloper}
            onClose={handleBackToList}
            onSendMessage={(developerId, developerName) => {
              if (onSendMessage) {
                onSendMessage(developerId, developerName);
                handleBackToList();
              } else {
                setShowMessageThread(true);
              }
            }}
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
        <h2 className="text-2xl font-black text-gray-900">
          {fetchType === 'assigned' ? 'Assigned Developers' : 'Developer Search'}
        </h2>
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
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <Filter className="w-4 h-4 mr-2" />
            {showAdvancedFilters ? 'Hide Filters' : 'Advanced Filters'}
          </button>
        </div>
      </div>
      
      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Availability Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Availability
              </label>
              <select
                value={filterAvailability === null ? 'all' : filterAvailability.toString()}
                onChange={(e) => setFilterAvailability(e.target.value === 'all' ? null : e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Developers</option>
                <option value="true">Available Only</option>
                <option value="false">Unavailable Only</option>
              </select>
            </div>
            
            {/* Experience Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Experience (Years)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={filterExperienceMin !== null ? filterExperienceMin : ''}
                  onChange={(e) => setFilterExperienceMin(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={filterExperienceMax !== null ? filterExperienceMax : ''}
                  onChange={(e) => setFilterExperienceMax(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Salary Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Desired Salary (USD)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="Min"
                  value={filterSalaryMin !== null ? filterSalaryMin : ''}
                  onChange={(e) => setFilterSalaryMin(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="Max"
                  value={filterSalaryMax !== null ? filterSalaryMax : ''}
                  onChange={(e) => setFilterSalaryMax(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                placeholder="City, Country, or Remote"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          {/* Programming Languages */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Programming Languages
            </label>
            <div className="flex flex-wrap gap-2">
              {commonLanguages.map(language => (
                <button
                  key={language}
                  type="button"
                  onClick={() => {
                    if (filterLanguages.includes(language)) {
                      setFilterLanguages(filterLanguages.filter(l => l !== language));
                    } else {
                      setFilterLanguages([...filterLanguages, language]);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    filterLanguages.includes(language)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {language}
                </button>
              ))}
            </div>
          </div>
          
          {/* Filter Actions */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterAvailability(null);
                setFilterLanguages([]);
                setFilterExperienceMin(null);
                setFilterExperienceMax(null);
                setFilterSalaryMin(null);
                setFilterSalaryMax(null);
                fetchDevelopers();
              }}
              className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Reset Filters
            </button>
            <button
              onClick={fetchDevelopers}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Apply Filters
            </button>
          </div>
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
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Developers Found</h3>
          <p className="text-gray-600">
            {searchTerm || filterAvailability !== null
              ? "No developers match your search criteria"
              : fetchType === 'assigned'
                ? "You don't have any assigned developers yet" 
                : filterLanguages.length > 0 || filterExperienceMin !== null || filterExperienceMax !== null || 
                  filterSalaryMin !== null || filterSalaryMax !== null
                  ? "No developers match your filter criteria"
                  : "No developers found"}
          </p>
          {searchTerm || filterAvailability !== null || filterLanguages.length > 0 || 
           filterExperienceMin !== null || filterExperienceMax !== null || 
           filterSalaryMin !== null || filterSalaryMax !== null ? (
            <button 
              onClick={() => {
                setSearchTerm('');
                setFilterAvailability(null);
                setFilterLanguages([]);
                setFilterExperienceMin(null);
                setFilterExperienceMax(null);
                setFilterSalaryMin(null);
                setFilterSalaryMax(null);
                fetchDevelopers();
              }}
              className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              Clear Filters
            </button>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              {fetchType === 'assigned'
                ? "Developers will appear here when they're assigned to your job listings."
                : "No developers match your search criteria."}
            </p>
          )}
        </div>
      )}
    </div>
  );
};