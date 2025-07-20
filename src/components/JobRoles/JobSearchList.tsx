import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Clock, 
  Search, 
  Filter,
  Building,
  Calendar,
  Star,
  Loader,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { JobRole } from '../../types';

interface JobSearchListProps {
  onViewJobDetails?: (jobRoleId: string) => void;
  onViewRecruiter?: (recruiterId: string) => void;
  onExpressInterest?: (jobRoleId: string) => void;
}

export const JobSearchList: React.FC<JobSearchListProps> = ({
  onViewJobDetails,
  onExpressInterest,
  onViewRecruiter
}) => {
  const [jobs, setJobs] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJobType, setFilterJobType] = useState<string | null>(null);
  const [filterSalaryMin, setFilterSalaryMin] = useState<number | null>(null);
  const [filterLocation, setFilterLocation] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all active job roles - now visible to all users
      const { data, error } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:users!job_roles_recruiter_id_fkey(
            id,
            name, 
            email,
            recruiter:recruiters!user_id(company_name)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setJobs(data || []);
    } catch (error: unknown) {
      console.error('Error fetching jobs:', error);
      setError(error instanceof Error ? error.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (jobId: string) => {
    if (onViewJobDetails) {
      console.log('View details clicked for job:', jobId);
      onViewJobDetails(jobId); 
    }
  };

  const handleExpressInterest = (jobId: string) => {
    if (onExpressInterest) {
      console.log('Express interest clicked for job:', jobId); 
      try {
        onExpressInterest(jobId);
      } catch (error) {
        console.error('Error expressing interest:', error);
      }
    }
  };

  const filteredJobs = jobs.filter(job => {
    // Filter by search term
    const matchesSearch = !searchTerm || 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.tech_stack.some(tech => tech.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filter by job type
    const matchesJobType = !filterJobType || job.job_type === filterJobType;
    
    // Filter by salary
    const matchesSalary = !filterSalaryMin || job.salary_max >= filterSalaryMin;
    
    // Filter by location
    const matchesLocation = !filterLocation || 
      job.location.toLowerCase().includes(filterLocation.toLowerCase());
    
    return matchesSearch && matchesJobType && matchesSalary && matchesLocation;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
        <span className="text-gray-600 font-medium">Loading job opportunities...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Job Opportunities</h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          <Filter className="w-4 h-4 mr-2" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search jobs by title, description, or technologies..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {showFilters && (
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Filter Jobs</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Type
                </label>
                <select
                  value={filterJobType || ''}
                  onChange={(e) => setFilterJobType(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Salary
                </label>
                <select
                  value={filterSalaryMin || ''}
                  onChange={(e) => setFilterSalaryMin(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Any Salary</option>
                  <option value="50000">$50k+</option>
                  <option value="75000">$75k+</option>
                  <option value="100000">$100k+</option>
                  <option value="125000">$125k+</option>
                  <option value="150000">$150k+</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="Filter by location"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setFilterJobType(null);
                  setFilterSalaryMin(null);
                  setFilterLocation('');
                }}
                className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Job Listings */}
      {filteredJobs.length > 0 ? (
        <div className="space-y-6">
          {filteredJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{job.title}</h3>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center">
                      <Building className="w-4 h-4 mr-1" /> 
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onViewRecruiter && job.recruiter?.id) {
                            onViewRecruiter(job.recruiter.id);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 transition-colors flex items-center"
                      >
                        {job.recruiter?.recruiter?.company_name || 'Company Confidential'}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </button>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {job.location}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {job.job_type}
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 mr-1" />
                      ${job.salary_min}k - ${job.salary_max}k
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {job.tech_stack?.map((tech, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {tech}
                      </span>
                    ))}
                  </div>
                  
                  <p className="text-gray-600 text-sm line-clamp-2 mb-4">{job.description}</p>
                </div>
                
                <div className="text-sm text-gray-500 whitespace-nowrap ml-4">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(job.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(job.id);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExpressInterest(job.id);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center"
                >
                  <Star className="w-4 h-4 mr-2" />
                  Express Interest
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Jobs Found</h3>
          <p className="text-gray-600">
            {searchTerm || filterJobType || filterSalaryMin || filterLocation
              ? "No jobs match your search criteria. Try adjusting your filters."
              : "There are no active job postings at the moment. Check back later!"}
          </p>
          {(searchTerm || filterJobType || filterSalaryMin || filterLocation) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterJobType(null);
                setFilterSalaryMin(null);
                setFilterLocation('');
              }}
              className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};