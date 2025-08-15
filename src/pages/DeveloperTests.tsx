// src/components/DeveloperTests.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { TestAssignment, CodingTest, JobRole } from '../types';
import { Clock, FileText, CheckCircle, XCircle, Loader, AlertCircle, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ExtendedTestAssignment extends TestAssignment {
  coding_tests: CodingTest;
  job_roles: JobRole & {
    recruiters: {
      company_name: string;
      users: {
        id: string;
        name: string;
        email: string;
      };
    };
  };
}

const DeveloperTests: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [testAssignments, setTestAssignments] = useState<ExtendedTestAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userProfile?.id) {
      fetchTestAssignments();
    }
  }, [userProfile]);

  const fetchTestAssignments = async () => {
    if (!userProfile?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      const { data, error: fetchError } = await supabase
        .from('test_assignments')
        .select(`
          *,
          coding_tests (
            id,
            title,
            description,
            language,
            difficulty,
            time_limit,
            created_at
          ),
          job_roles!test_assignments_job_id_fkey (
            id,
            title,
            description,
            location,
            employment_type,
            salary,
            recruiters!fk_job_roles_recruiter_user_id (
              company_name,
              users!recruiters_user_id_fkey (
                id,
                name,
                email
              )
            )
          )
        `)
        .eq('developer_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Filter out any assignments with incomplete data
      const validAssignments = (data || []).filter(assignment => 
        assignment.coding_tests && 
        assignment.job_roles && 
        assignment.job_roles.recruiters &&
        assignment.job_roles.recruiters.users
      ) as ExtendedTestAssignment[];

      setTestAssignments(validAssignments);
    } catch (err) {
      console.error('Error fetching test assignments:', err);
      setError('Failed to load test assignments: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = (assignmentId: string) => {
    navigate(`/test/${assignmentId}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'In Progress':
        return <Clock className="text-yellow-500" size={20} />;
      case 'Pending':
        return <Clock className="text-blue-500" size={20} />;
      default:
        return <FileText className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'In Progress':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'Pending':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const formatTimeLimit = (minutes: number | null) => {
    if (!minutes) return 'No time limit';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
        <span className="text-gray-600 font-medium">Loading your tests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (testAssignments.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tests Assigned</h3>
        <p className="text-gray-600">You haven't been assigned any coding tests yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Your Coding Tests</h2>
      
      <div className="grid gap-6">
        {testAssignments.map((assignment) => (
          <div
            key={assignment.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {assignment.coding_tests.title}
                  </h3>
                  <p className="text-gray-600 mb-3">
                    {assignment.coding_tests.description}
                  </p>
                  
                  {/* Job and Company Info */}
                  <div className="space-y-1 text-sm text-gray-600 mb-4">
                    <div>
                      <span className="font-medium">Position:</span> {assignment.job_roles.title}
                    </div>
                    <div>
                      <span className="font-medium">Company:</span> {assignment.job_roles.recruiters.company_name}
                    </div>
                    <div>
                      <span className="font-medium">Recruiter:</span> {assignment.job_roles.recruiters.users.name}
                    </div>
                  </div>

                  {/* Test Details */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <span className="font-medium mr-1">Language:</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {assignment.coding_tests.language}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Difficulty:</span> {assignment.coding_tests.difficulty}
                    </div>
                    <div>
                      <span className="font-medium">Time Limit:</span> {formatTimeLimit(assignment.coding_tests.time_limit)}
                    </div>
                    <div>
                      <span className="font-medium">Assigned:</span> {new Date(assignment.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="ml-6 text-right">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(assignment.status)}`}>
                    {getStatusIcon(assignment.status)}
                    <span className="ml-2">{assignment.status}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                {assignment.status === 'Completed' ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle size={16} className="mr-2" />
                    <span className="font-medium">Test Completed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartTest(assignment.id)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Play size={16} className="mr-2" />
                    {assignment.status === 'In Progress' ? 'Continue Test' : 'Start Test'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Export as default to match the import in DeveloperDashboard.tsx
export default DeveloperTests;
