import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../hooks/useNotifications';
import { TestResult, CodingQuestion } from '../types';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

const TestResultsPage: React.FC = () => {
    const { assignmentId } = useParams<{ assignmentId: string }>();
    const [results, setResults] = useState<(TestResult & { coding_questions: CodingQuestion })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { markAsReadByEntity } = useNotifications();

    useEffect(() => {
        fetchResults();
        if (assignmentId) {
            markAsReadByEntity(assignmentId, 'test_completion');
        }
    }, [assignmentId]);

    const fetchResults = async () => {
        if (!assignmentId) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('test_results')
            .select('*, coding_questions(*)')
            .eq('assignment_id', assignmentId);

        if (error) {
            console.error('Error fetching results:', error);
        } else {
            setResults(data as any);
        }
        setIsLoading(false);
    };

    if (isLoading) {
        return <div className="flex justify-center items-center p-4"><Loader className="animate-spin" /></div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Test Results</h1>
            {results.length === 0 ? (
                <p>No results available yet.</p>
            ) : (
                <ul className="space-y-4">
                    {results.map((result) => (
                        <li key={result.id} className="p-4 border rounded-md">
                            <div className="flex justify-between items-center">
                                <h4 className="font-semibold">{result.coding_questions.title}</h4>
                                {result.score === 1 ? (
                                    <span className="flex items-center text-green-600">
                                        <CheckCircle size={20} className="mr-2" /> Passed
                                    </span>
                                ) : (
                                    <span className="flex items-center text-red-600">
                                        <XCircle size={20} className="mr-2" /> Failed
                                    </span>
                                )}
                            </div>
                            <div className="mt-2 text-sm text-gray-600">
                                <p><strong>Output:</strong></p>
                                <pre className="bg-gray-100 p-2 rounded-md whitespace-pre-wrap">{result.stdout || result.stderr}</pre>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TestResultsPage;
