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
  Loader
} from 'lucide-react';
import { JobRole, Assignment, User, Developer } from '../../types';

interface JobRoleDetailsProps {
  jobRoleId: string;
  onEdit?: () => void;
  onAssignDeveloper?: () => void;
}

export const JobRoleDetails: React.FC<JobRoleDetailsProps> = ({
  jobRoleId,
  onEdit,
  onAssignDeveloper
}) => {
  const { userProfile } = useAuth();
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [assignments, setAssignments] = useState<(Assignment & { 
    developer: Developer & { user: User } 
  })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (jobRoleId) {
      fetchJobRoleDetails();
    }
  }, [jobRoleId]);

  const fetchJobRoleDetails = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch job role details
      const { data: jobData, error: jobError } = await supabase
        .from('job_roles')
        .select(`
          *,
          recruiter:users!job_roles_recruiter_id_fkey(*)
        `)
        .eq('id', jobRoleId)
        .single();

      if (jobError) throw jobError;
      setJobRole(jobData);

      // Fetch assignments for this job
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          developer:users!assignments_developer_id_fkey(*)
        `)
        .eq('job_role_id', jobRoleId)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Fetch developer profiles for assignments
      const assignmentsWithDevProfiles = await Promise.all(
        (assignmentsData || []).map(async (assignment) => {
          const { data: devProfile } = await supabase
            .from('developers')
            .select('*')
            .eq('user_id', assignment.developer_id)
            .single();

          return {
            ...assignment,
            developer: {
              ...devProfile,
              user: assignment.developer
            }
          };
        })
      );

      setAssignments(assignmentsWithDevProfiles);

    } catch (error: any) {
      console.error('Error fetching job role details:', error);
      setError(error.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status: newStatus })
        .eq('id', assignmentId);

      if (error) throw error;

      // Refresh assignments
      fetchJobRoleDetails();
    } catch (error: any) {
      console.error('Error updating assignment status:', error);
      setError(error.message || 'Failed to update assignment status');
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
        <p className="text-red-800">{error || 'Job role not found'}</p>
      </div>
    );
  }

  const canEdit = userProfile?.role === 'admin' || 
                  (userProfile?.role === 'recruiter' && jobRole.recruiter_id === userProfile.id);
  const canAssign = userProfile?.role === 'admin';

  const statusCounts = {
    total: assignments.length,
    new: assignments.filter(a => a.status === 'New').length,
    contacted: assignments.filter(a => a.status === 'Contacted').length,
    shortlisted: assignments.filter(a => a.status === 'Shortlisted').length,
    hired: assignments.filter(a => a.status === 'Hired').length,
  };

  return (
    <div className="space-y-8">
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
            {canAssign && (
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{statusCounts.total}</div>
            <div className="text-sm font-semibold text-gray-600">Total Assigned</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{statusCounts.new}</div>
            <div className="text-sm font-semibold text-gray-600">New</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{statusCounts.contacted}</div>
            <div className="text-sm font-semibold text-gray-600">Contacted</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{statusCounts.shortlisted}</div>
            <div className="text-sm font-semibold text-gray-600">Shortlisted</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
            <div className="text-2xl font-black text-gray-900 mb-1">{statusCounts.hired}</div>
            <div className="text-sm font-semibold text-gray-600">Hired</div>
          </div>
        </div>

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

      {/* Assigned Developers */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-gray-900">Assigned Developers</h2>
          <span className="text-sm text-gray-600">{assignments.length} developers assigned</span>
        </div>

        {assignments.length > 0 ? (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                      {assignment.developer?.user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {assignment.developer?.user?.name || 'Unknown Developer'}
                        </h3>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          assignment.developer?.availability 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            assignment.developer?.availability ? 'bg-emerald-500' : 'bg-gray-500'
                          }`}></div>
                          {assignment.developer?.availability ? 'Available' : 'Busy'}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <span>{assignment.developer?.experience_years || 0} years experience</span>
                        {assignment.developer?.location && (
                          <span>{assignment.developer.location}</span>
                        )}
                        <span>Assigned {new Date(assignment.assigned_at).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center space-x-2 mb-4">
                        {assignment.developer?.top_languages?.slice(0, 4).map((lang, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                      assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                      assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {assignment.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-sm">
                      <Eye className="w-4 h-4 mr-1 inline" />
                      View Profile
                    </button>
                    <button className="px-3 py-2 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors font-semibold text-sm">
                      <MessageSquare className="w-4 h-4 mr-1 inline" />
                      Message
                    </button>
                  </div>

                  {userProfile?.role === 'recruiter' && userProfile.id === jobRole.recruiter_id && (
                    <div className="flex items-center space-x-2">
                      {assignment.status === 'New' && (
                        <button 
                          onClick={() => updateAssignmentStatus(assignment.id, 'Contacted')}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                        >
                          Mark Contacted
                        </button>
                      )}
                      {assignment.status === 'Contacted' && (
                        <button 
                          onClick={() => updateAssignmentStatus(assignment.id, 'Shortlisted')}
                          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-sm"
                        >
                          <Star className="w-4 h-4 mr-1 inline" />
                          Shortlist
                        </button>
                      )}
                      {assignment.status === 'Shortlisted' && (
                        <button 
                          onClick={() => updateAssignmentStatus(assignment.id, 'Hired')}
                          className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold text-sm"
                        >
                          <CheckCircle className="w-4 h-4 mr-1 inline" />
                          Mark as Hired
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Developers Assigned</h3>
            <p className="text-gray-600">Developers will appear here once they are assigned to this job.</p>
          </div>
        )}
      </div>
    </div>
  );
};