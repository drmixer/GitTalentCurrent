import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { 
  Eye, 
  MessageSquare, 
  Star, 
  CheckCircle, 
  Loader,
  AlertCircle,
  Filter,
  Search,
  Users
} from 'lucide-react';
import { Assignment, JobRole, User } from '../../types';
import { MarkAsHiredModal } from '../Hires/MarkAsHiredModal';

interface AssignmentListProps {
  recruiterId: string;
  jobRoleId?: string;
  onViewDeveloper?: (developerId: string) => void;
  onSendMessage?: (developerId: string, developerName: string, jobRoleId: string, jobRoleTitle: string) => void;
}

export const AssignmentList: React.FC<AssignmentListProps> = ({ 
  recruiterId, 
  jobRoleId,
  onViewDeveloper,
  onSendMessage
}) => {
  const { userProfile } = useAuth();
  const [assignments, setAssignments] = useState<(Assignment & {
    developer: User,
    job_role: JobRole
  })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, [recruiterId, jobRoleId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError('');

      let query = supabase
        .from('assignments')
        .select(`
          *,
          developer:users!assignments_developer_id_fkey(*),
          job_role:job_roles(*)
        `)
        .eq('recruiter_id', recruiterId);

      // If jobRoleId is provided, filter by it
      if (jobRoleId) {
        query = query.eq('job_role_id', jobRoleId);
      }

      const { data, error: fetchError } = await query.order('assigned_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAssignments(data || []);

    } catch (error: any) {
      console.error('Error fetching assignments:', error);
      setError(error.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status: newStatus })
        .eq('id', assignmentId)
        .eq('recruiter_id', recruiterId); // Ensure recruiter can only update their own assignments

      if (error) throw error;

      // Refresh assignments
      fetchAssignments();
    } catch (error: any) {
      console.error('Error updating assignment status:', error);
      setError(error.message || 'Failed to update assignment status');
    }
  };

  const handleMarkAsHired = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowHireModal(true);
  };

  const filteredAssignments = assignments.filter(assignment => {
    // Filter by search term (developer name or job title)
    const matchesSearch = !searchTerm || 
      assignment.developer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.job_role?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by status
    const matchesStatus = !filterStatus || assignment.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
        <span className="text-gray-600 font-medium">Loading assignments...</span>
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
      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by developer or job title..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Hired">Hired</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {filteredAssignments.length > 0 ? (
        <div className="space-y-4">
          {filteredAssignments.map((assignment) => (
            <div key={assignment.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                    {assignment.developer?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {assignment.developer?.name || 'Unknown Developer'}
                      </h3>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                        assignment.status === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                        assignment.status === 'Shortlisted' ? 'bg-blue-100 text-blue-800' :
                        assignment.status === 'Contacted' ? 'bg-purple-100 text-purple-800' :
                        assignment.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {assignment.status}
                      </span>
                    </div>
                    
                    <div className="text-sm text-blue-600 font-medium mb-2">
                      {assignment.job_role?.title || 'Unknown Job'}
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-2">
                  {onViewDeveloper && (
                    <button 
                      onClick={() => onViewDeveloper(assignment.developer_id)}
                      className="px-3 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-sm"
                    >
                      <Eye className="w-4 h-4 mr-1 inline" />
                      View Profile
                    </button>
                  )}
                  
                  {onSendMessage && (
                    <button 
                      onClick={() => onSendMessage(
                        assignment.developer_id, 
                        assignment.developer?.name || 'Developer',
                        assignment.job_role_id,
                        assignment.job_role?.title || 'Job Role'
                      )}
                      className="px-3 py-2 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors font-semibold text-sm"
                    >
                      <MessageSquare className="w-4 h-4 mr-1 inline" />
                      Message
                    </button>
                  )}
                </div>

                {userProfile?.role === 'recruiter' && userProfile.id === recruiterId && (
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
                        onClick={() => handleMarkAsHired(assignment)}
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
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assignments Found</h3>
          <p className="text-gray-600">
            {searchTerm || filterStatus
              ? "No assignments match your search criteria" 
              : "You don't have any assigned developers yet"}
          </p>
          {(searchTerm || filterStatus) && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setFilterStatus(null);
              }}
              className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Hire Modal */}
      {showHireModal && selectedAssignment && (
        <MarkAsHiredModal
          isOpen={showHireModal}
          onClose={() => {
            setShowHireModal(false);
            setSelectedAssignment(null);
          }}
          assignment={selectedAssignment}
          onSuccess={() => {
            setShowHireModal(false);
            setSelectedAssignment(null);
            fetchAssignments();
          }}
        />
      )}
    </div>
  );
};