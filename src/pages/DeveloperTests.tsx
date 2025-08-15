// src/pages/DeveloperTests.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { TestAssignment, CodingTest, JobRole } from '../types';
import { Clock, FileText, CheckCircle, XCircle, Loader, AlertCircle, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ExtendedTestAssignment extends TestAssignment {
  coding_tests: CodingTest & {
    coding_questions: Array<{
      language: string;
    }>;
  };
  job_roles: JobRole & {
    company_name?: string; // Company name from recruiters table
    recruiter_name?: string; // Recruiter name from users table
    recruiter_email?: string; // Recruiter email from users table
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
      // First, get the test assignments with coding tests and job roles
      const { data: assignments, error: assignmentsError } = await supabase
        .from('test_assignments')
        .select(`
          *,
          coding_tests (
            id,
            title,
            description,
            difficulty,
            created_at,
            coding_questions (
              language
            )
          ),
          job_roles (
            id,
            title,
            description,
            location,
            job_type,
            salary,
            recruiter_id
          )
        `)
        .eq('developer_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        throw assignmentsError;
      }

      if (!assignments || assignments.length === 0) {
        setTestAssignments([]);
        return;
      }

      // Get recruiter details for all unique recruiter IDs
      const recruiterIds = [...new Set(
        assignments
          .filter(a => a.job_roles?.recruiter_id)
          .map(a => a.job_roles.recruiter_id)
      )];

      if (recruiterIds.length === 0) {
        setTestAssignments(assignments as ExtendedTestAssignment[]);
        return;
      }

      // Fetch recruiter company names
      const { data: recruiters, error: recruitersError } = await supabase
        .from('recruiters')
        .select('user_id, company_name')
        .in('user_id', recruiterIds);

      if (recruitersError) {
        console.error('Error fetching recruiters:', recruitersError);
      }

      // Fetch user details for recruiters
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', recruiterIds);

      if (usersError) {
        console.error('Error fetching users:', usersError);
      }

      // Combine the data
      const enrichedAssignments = assignments.map(assignment => {
        if (!assignment.job_roles?.recruiter_id) {
          return assignment as ExtendedTestAssignment;
        }

        const recruiter = recruiters?.find(r => r.user_id === assignment.job_roles.recruiter_id);
        const user = users?.find(u => u.id === assignment.job_roles.recruiter_id);

        return {
          ...assignment,
          job_roles: {
            ...assignment.job_roles,
            company_name: recruiter?.company_name || 'Unknown Company',
            recruiter_name: user?.name || 'Unknown Recruiter',
            recruiter_email: user?.email || ''
          }
        } as ExtendedTestAssignment;
      });

      // Filter out any assignments with incomplete data
      const validAssignments = enrichedAssignments.filter(assignment => 
        assignment.coding_tests && assignment.job_roles
      );

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

  // Helper function to get the primary language for a test (from first question)
  const getTestLanguage = (codingTest: ExtendedTestAssignment['coding_tests']): string => {
    if (codingTest.coding_questions && codingTest.coding_questions.length > 0) {
      return codingTest.coding_questions[0].language;
    }
    return 'N/A';
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
                      <span className="font-medium">Company:</span> {assignment.job_roles.company_name || 'Unknown Company'}
                    </div>
                    <div>
                      <span className="font-medium">Recruiter:</span> {assignment.job_roles.recruiter_name || 'Unknown Recruiter'}
                    </div>
                  </div>

                  {/* Test Details */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <span className="font-medium mr-1">Language:</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {getTestLanguage(assignment.coding_tests)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Difficulty:</span> {assignment.coding_tests.difficulty}
                    </div>
                    <div>
                      <span className="font-medium">Job Type:</span> {assignment.job_roles.job_type}
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
