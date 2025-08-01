import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import {
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  Calendar,
  Building,
  Users,
  Edit,
  UserPlus,
  Eye,
  MessageSquare,
  CheckCircle,
  Star,
  Loader,
  ArrowLeft,
  AlertCircle,
  Lock,
  ExternalLink
} from 'lucide-react';
import { JobRole, Assignment, User, Developer } from '../../types'; // Assuming JobRole and other types are from here
import { RecruiterProfileDetails } from '../Profile/RecruiterProfileDetails';
import { DeveloperProfileDetails } from '../Profile/DeveloperProfileDetails';

// --- NEW/UPDATED INTERFACE FOR CORRECT TYPE SAFETY ---
// This extends your existing JobRole type to correctly represent the fetched data structure
interface JobRoleWithRecruiterAndUser extends JobRole {
  // 'recruiter' here will contain properties from the 'users' table
  recruiter: {
    id: string;
    name: string;
    email: string;
    // 'company_name' will now be directly on this 'recruiter' object after transformation
    company_name: string | null; // company_name is nullable in recruiters table
  };
}
// --- END NEW/UPDATED INTERFACE ---

interface JobRoleDetailsProps {
  jobRoleId: string;
  jobRole?: JobRole; // Still accepts original JobRole if passed initially
  onEdit?: () => void;
  onSendMessage?: (developerId: string, developerName: string, jobRoleId: string, jobRoleTitle: string) => void;
  onViewDeveloper?: (developerId: string) => void;
  onClose?: () => void;
  onAssignDeveloper?: () => void;
  onExpressInterest?: () => void;
  isDeveloperView?: boolean;
}

export const JobRoleDetails: React.FC<JobRoleDetailsProps> = ({
  jobRoleId,
  jobRole: initialJobRole,
  onEdit,
  onSendMessage,
  onViewDeveloper,
  onClose,
  onAssignDeveloper,
  onExpressInterest,
  isDeveloperView = false
}) => {
  const { user, userProfile } = useAuth();
  // --- UPDATED: Use the new interface for the jobRole state ---
  const [jobRole, setJobRole] = useState<JobRoleWithRecruiterAndUser | null>(
    (initialJobRole as JobRoleWithRecruiterAndUser) || null
  );
  // --- END UPDATED ---
  const [loading, setLoading] = useState(!initialJobRole);
  const [error, setError] = useState<string | null>(null);
  const [showRecruiterProfile, setShowRecruiterProfile] = useState(false);
  const [showDeveloperProfile, setShowDeveloperProfile] = useState(false);
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialJobRole) {
      fetchJobRole();
    }
  }, [jobRoleId, initialJobRole]);

  const fetchJobRole = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:users!job_roles_recruiter_id_fkey( // This joins the users table
            id,
            name,
            email,
            recruiter_profile:recruiters!users_id_fkey( // <--- NEW: Join the recruiters table through the user's ID
                company_name // <--- NEW: Select company_name from the joined recruiters table
            )
          )
        `)
        .eq('id', jobRoleId)
        .single();

      if (error) throw error;

      // --- NEW: Data Transformation for nested relationships ---
      // Supabase's PostgREST API returns nested foreign key joins as arrays,
      // even if there's only one related record. We need to flatten it.
      const transformedData: JobRoleWithRecruiterAndUser = {
        ...data,
        recruiter: {
          ...data.recruiter, // Copy basic user data (id, name, email)
          // Access the first (and only) item in the recruiter_profile array to get company_name
          company_name: data.recruiter.recruiter_profile?.[0]?.company_name || null
        }
      };
      // Remove the temporary 'recruiter_profile' array from the transformed object
      // as its data is now merged directly into 'recruiter'
      delete (transformedData.recruiter as any).recruiter_profile; // Use 'any' for deletion for simplicity, or refine type

      setJobRole(transformedData); // Set the transformed and correctly typed data
      // --- END NEW ---

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job role');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (developerId: string, developerName: string) => {
    if (onSendMessage && jobRole) {
      onSendMessage(developerId, developerName, jobRole.id, jobRole.title);
    }
  };

  const handleViewDeveloperProfile = (developerId: string) => {
    setSelectedDeveloperId(developerId);
    setShowDeveloperProfile(true);
  };

  const handleViewRecruiterProfile = () => {
    if (jobRole?.recruiter_id) { // Still use recruiter_id to check if a recruiter is associated
      setShowRecruiterProfile(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error || !jobRole) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-800">{error || 'Job role not found'}</p>
        </div>
      </div>
    );
  }

  const canEdit = !isDeveloperView && (userProfile?.role === 'admin' ||
                                       (userProfile?.role === 'recruiter' && jobRole.recruiter_id === userProfile.id));
  const canAssign = !isDeveloperView && userProfile?.role === 'admin';

  if (showRecruiterProfile && jobRole.recruiter) { // Added defensive check: jobRole.recruiter must exist
    return (
      <div>
        <button
          onClick={() => setShowRecruiterProfile(false)}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Job Details
        </button>
        <RecruiterProfileDetails
          recruiterId={jobRole.recruiter_id}
          onClose={() => setShowRecruiterProfile(false)}
        />
      </div>
    );
  }

  if (showDeveloperProfile && selectedDeveloperId) {
    return (
      <div>
        <button
          onClick={() => {
            setShowDeveloperProfile(false);
            setSelectedDeveloperId(null);
          }}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Job Details
        </button>
        <DeveloperProfileDetails
          developerId={selectedDeveloperId}
          onClose={() => {
            setShowDeveloperProfile(false);
            setSelectedDeveloperId(null);
          }}
          onSendMessage={handleSendMessage}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with close button */}
      {onClose && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900">Job Details</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Job Header */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-4">
              <h1 className="text-3xl font-black text-gray-900">{jobRole.title}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                jobRole.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {jobRole.is_active ? 'Active' : 'Paused'}
              </span>
              {jobRole.is_featured && (
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800">
                  Featured
                </span>
              )}
            </div>

            <div className="grid md:grid-cols-4 gap-6 mb-6">
              <div className="flex items-center text-gray-600">
                <MapPin className="w-5 h-5 mr-2" />
                <span className="font-medium">{jobRole.location}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="w-5 h-5 mr-2" />
                <span className="font-medium">{jobRole.job_type}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <DollarSign className="w-5 h-5 mr-2" />
                <span className="font-medium">${jobRole.salary_min}k - ${jobRole.salary_max}k</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-2" />
                <span className="font-medium">Posted {new Date(jobRole.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 mb-6">
              {jobRole.tech_stack.map((tech, index) => (
                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-lg">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isDeveloperView && onExpressInterest && (
              <button
                onClick={onExpressInterest}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold"
              >
                <Star className="w-4 h-4 mr-2 inline" />
                Express Interest
              </button>
            )}
            {!isDeveloperView && canAssign && (
              <button
                onClick={onAssignDeveloper}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold"
              >
                <UserPlus className="w-4 h-4 mr-2 inline" />
                Assign Developer
              </button>
            )}
            {canEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                <Edit className="w-4 h-4 mr-2 inline" />
                Edit Job
              </button>
            )}
          </div>
        </div>

        {/* Company Info - Only show in developer view */}
        {isDeveloperView && jobRole.recruiter && ( // <--- jobRole.recruiter check is important here
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center">
              <Building className="w-5 h-5 text-gray-500 mr-3" />
              <div>
                <h3 className="font-bold text-gray-900">Company</h3>
                <button
                  onClick={handleViewRecruiterProfile}
                  className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
                >
                  {/* --- THIS LINE IS NOW CORRECT --- */}
                  {jobRole.recruiter.company_name || jobRole.recruiter.name}
                  {/* --- END CORRECTED LINE --- */}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <h3 className="text-lg font-black text-gray-900 mb-3">Job Description</h3>
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{jobRole.description}</p>
        </div>

        {jobRole.experience_required && (
          <div className="mt-6">
            <h3 className="text-lg font-black text-gray-900 mb-3">Experience Required</h3>
            <p className="text-gray-600">{jobRole.experience_required}</p>
          </div>
        )}
      </div>
    </div>
  );
};
