import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { TestAssignment } from '../types';
import { Link } from 'react-router-dom';
import { Code, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const DeveloperTests: React.FC = () => {
    const { userProfile } = useAuth();
    const [assignments, setAssignments] = useState<TestAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (userProfile) {
            fetchAssignments();
        }
    }, [userProfile]);

    const fetchAssignments = async () => {
        if (!userProfile) return;
        setLoading(true);
        setError('');
        
        try {
            const { data, error } = await supabase
                .from('test_assignments')
                .select(`
                    *,
                    coding_tests (*),
                    recruiters:users!test_assignments_recruiter_id_fkey (
                        name,
                        email
                    )
                `)
                .eq('developer_id', userProfile.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            setAssignments(data as TestAssignment[] || []);
        } catch (err) {
            console.error('Error fetching assignments:', err);
            setError('Failed to load test assignments: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Completed':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'Pending':
                return <Clock className="w-5 h-5 text-yellow-500" />;
            default:
                return <AlertCircle className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed':
                return 'bg-green-50 border-green-200 text-green-800';
            case 'Pending':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            default:
                return 'bg-gray-50 border-gray-200 text-gray-600';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading tests...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                    <p className="text-red-700">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">My Coding Tests</h1>
                <p className="text-gray-600">Complete coding assessments sent by recruiters</p>
            </div>

            {assignments.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
                    <Code className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tests Assigned</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                        You haven't been assigned any coding tests yet. When recruiters send you tests, 
                        they will appear here.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {assignments.map(assignment => (
                        <div key={assignment.id} className={`border rounded-xl p-6 transition-all hover:shadow-md ${getStatusColor(assignment.status)}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center mb-3">
                                        {getStatusIcon(assignment.status)}
                                        <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(assignment.status)}`}>
                                            {assignment.status}
                                        </span>
                                        <span className="ml-3 text-sm text-gray-500">
                                            Assigned {new Date(assignment.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    
                                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                        {assignment.coding_tests?.title || 'Untitled Test'}
                                    </h2>
                                    
                                    <p className="text-gray-700 mb-4 line-clamp-2">
                                        {assignment.coding_tests?.description || 'No description available'}
                                    </p>

                                    {/* Test metadata */}
                                    <div className="flex items-center space-x-6 text-sm text-gray-600 mb-4">
                                        {assignment.coding_tests?.time_limit && (
                                            <span className="flex items-center">
                                                <Clock size={14} className="mr-1" />
                                                {assignment.coding_tests.time_limit} minutes
                                            </span>
                                        )}
                                        {assignment.coding_tests?.difficulty && (
                                            <span className="capitalize">
                                                Difficulty: {assignment.coding_tests.difficulty}
                                            </span>
                                        )}
                                    </div>

                                    {/* Recruiter info */}
                                    {assignment.recruiters && (
                                        <div className="text-sm text-gray-600 mb-4">
                                            <span className="font-medium">From:</span> {assignment.recruiters.name || assignment.recruiters.email}
                                        </div>
                                    )}

                                    {/* Completion info */}
                                    {assignment.status === 'Completed' && assignment.updated_at && (
                                        <div className="text-sm text-green-600 mb-4">
                                            <CheckCircle size={14} className="inline mr-1" />
                                            Completed on {new Date(assignment.updated_at).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>

                                {/* Action button */}
                                <div className="ml-6">
                                    {assignment.status === 'Pending' ? (
                                        <Link 
                                            to={`/test/${assignment.id}`} 
                                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                        >
                                            <Code size={16} className="mr-2" /> 
                                            Start Test
                                        </Link>
                                    ) : assignment.status === 'Completed' ? (
                                        <div className="flex flex-col items-end space-y-2">
                                            <span className="inline-flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                                <CheckCircle size={16} className="mr-2" />
                                                Completed
                                            </span>
                                            <Link 
                                                to={`/test-results/${assignment.id}`}
                                                className="text-sm text-blue-600 hover:text-blue-800 underline"
                                            >
                                                View Results
                                            </Link>
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
                                            {assignment.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DeveloperTests;
