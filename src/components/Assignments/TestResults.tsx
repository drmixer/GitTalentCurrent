import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { TestResult, CodingQuestion } from '../../types';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

interface TestResultsProps {
    assignmentId: string;
}

const TestResults: React.FC<TestResultsProps> = ({ assignmentId }) => {
    const [results, setResults] = useState<(TestResult & { coding_questions: CodingQuestion })[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchResults = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('test_results')
            .select('*, coding_questions(*)')
            .eq('assignment_id', assignmentId);

        if (error) {
            console.error('Error fetching results:', error);
        } else {
            setResults(data as (TestResult & { coding_questions: CodingQuestion })[]);
        }
        setIsLoading(false);
    }, [assignmentId]);

    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    if (isLoading) {
        return <div className="flex justify-center items-center p-4"><Loader className="animate-spin" /></div>;
    }

    return (
        <div className="p-4 bg-white shadow rounded-lg">
            <h3 className="text-lg font-bold mb-4">Test Results</h3>
            {results.length === 0 ? (
                <p>No results available yet.</p>
            ) : (
                <ul className="space-y-4">
                    {results.map((result) => (
                        <li key={result.id} className="p-4 border rounded-md">
                            <div className="flex justify-between items-center">
                                <h4 className="font-semibold">{result.coding_questions.question_text}</h4>
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

export default TestResults;
