import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { TestAssignment } from '../types';
import { Link } from 'react-router-dom';
import { Code, Clock, CheckCircle } from 'lucide-react';

const DeveloperTests: React.FC = () => {
    const { userProfile } = useAuth();
    const [assignments, setAssignments] = useState<TestAssignment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userProfile) {
            fetchAssignments();
        }
    }, [userProfile]);

    const fetchAssignments = async () => {
        if (!userProfile) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('test_assignments')
            .select('*, coding_tests(*)')
            .eq('developer_id', userProfile.id);

        if (error) {
            console.error('Error fetching assignments:', error);
        } else {
            setAssignments(data as TestAssignment[]);
        }
        setLoading(false);
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">My Coding Tests</h1>
            {loading ? (
                <p>Loading...</p>
            ) : assignments.length === 0 ? (
                <p>You have not been assigned any tests yet.</p>
            ) : (
                <div className="space-y-4">
                    {assignments.map(assignment => (
                        <div key={assignment.id} className="p-4 border rounded-md flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-semibold">{assignment.coding_tests.title}</h2>
                                <p className="text-gray-600">{assignment.coding_tests.description}</p>
                                <div className="flex items-center text-sm text-gray-500 mt-2">
                                    {assignment.status === 'Completed' ? (
                                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                    ) : (
                                        <Clock className="w-4 h-4 mr-2 text-yellow-500" />
                                    )}
                                    <span>{assignment.status}</span>
                                </div>
                            </div>
                            <div>
                                {assignment.status === 'Pending' && (
                                    <Link to={`/test/${assignment.id}`} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center">
                                        <Code size={16} className="mr-2" /> Start Test
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DeveloperTests;
