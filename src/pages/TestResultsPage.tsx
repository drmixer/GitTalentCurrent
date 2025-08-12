import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../contexts/NotificationsContext';
import { TestResult, CodingQuestion } from '../types';
import { CheckCircle, XCircle, Loader, Clock, Code, Eye, EyeOff } from 'lucide-react';

const TestResultsPage: React.FC = () => {
    const { assignmentId } = useParams<{ assignmentId: string }>();
    const [results, setResults] = useState<(TestResult & { coding_questions: CodingQuestion })[]>([]);
    const [assignment, setAssignment] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedResults, setExpandedResults] = useState<{ [key: string]: boolean }>({});
    const [showCode, setShowCode] = useState<{ [key: string]: boolean }>({});
    const { markAsReadByEntity } = useNotifications();

    useEffect(() => {
        fetchResults();
        fetchAssignment();
        if (assignmentId) {
            markAsReadByEntity(assignmentId, 'test_completion');
        }
    }, [assignmentId]);

    const fetchAssignment = async () => {
        if (!assignmentId) return;
        
        const { data, error } = await supabase
            .from('test_assignments')
            .select('*, coding_tests(*), users(*)')
            .eq('id', assignmentId)
            .single();

        if (error) {
            console.error('Error fetching assignment:', error);
        } else {
            setAssignment(data);
        }
    };

    const fetchResults = async () => {
        if (!assignmentId) return;
        setIsLoading(true);
        
        const { data, error } = await supabase
            .from('test_results')
            .select(`
                *,
                coding_questions(
                    id,
                    title,
                    question_text,
                    language,
                    starter_code
                )
            `)
            .eq('assignment_id', assignmentId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching results:', error);
        } else {
            setResults(data as any);
            // Initialize expanded states
            const initialExpanded: { [key: string]: boolean } = {};
            const initialShowCode: { [key: string]: boolean } = {};
            data?.forEach(result => {
                initialExpanded[result.id] = false;
                initialShowCode[result.id] = false;
            });
            setExpandedResults(initialExpanded);
            setShowCode(initialShowCode);
        }
        setIsLoading(false);
    };

    const toggleExpanded = (resultId: string) => {
        setExpandedResults(prev => ({
            ...prev,
            [resultId]: !prev[resultId]
        }));
    };

    const toggleShowCode = (resultId: string) => {
        setShowCode(prev => ({
            ...prev,
            [resultId]: !prev[resultId]
        }));
    };

    const getStatusIcon = (score: number) => {
        return score === 1 ? (
            <CheckCircle size={20} className="text-green-600" />
        ) : (
            <XCircle size={20} className="text-red-600" />
        );
    };

    const getStatusText = (score: number) => {
        return score === 1 ? 'PASSED' : 'FAILED';
    };

    const getStatusColor = (score: number) => {
        return score === 1 ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200';
    };

    const formatOutput = (result: any) => {
        // Try to use detailed_output first if available
        if (result.detailed_output && result.detailed_output.trim()) {
            return result.detailed_output;
        }

        // Fallback to constructing output from individual fields
        let output = '';
        
        if (result.stdout && result.stdout.trim()) {
            output += `=== TEST EXECUTION OUTPUT ===\n${result.stdout}\n`;
        }
        
        if (result.stderr && result.stderr.trim()) {
            output += `\n=== ERRORS ===\n${result.stderr}\n`;
        }
        
        if (result.compile_output && result.compile_output.trim()) {
            output += `\n=== COMPILE OUTPUT ===\n${result.compile_output}\n`;
        }

        // Add test summary
        output += `\n=== TEST SUMMARY ===\n`;
        output += `Status: ${result.status_description || 'Unknown'}\n`;
        output += `Tests Passed: ${result.passed_test_cases || 0}/${result.total_test_cases || 1}\n`;
        output += `Final Result: ${result.score === 1 ? 'PASSED ✅' : 'FAILED ❌'}\n`;
        
        if (result.execution_time) {
            output += `Execution Time: ${result.execution_time}ms\n`;
        }
        
        if (result.memory_used) {
            output += `Memory Used: ${result.memory_used}KB\n`;
        }

        return output || 'No output available';
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Loader className="animate-spin w-8 h-8 mr-3" />
                <span>Loading test results...</span>
            </div>
        );
    }

    const overallScore = results.length > 0 ? results.filter(r => r.score === 1).length : 0;
    const totalQuestions = results.length;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-4">Test Results</h1>
                
                {assignment && (
                    <div className="bg-white border rounded-lg p-6 shadow-sm mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">{assignment.coding_tests.title}</h2>
                                <p className="text-gray-600 mb-2">{assignment.coding_tests.description}</p>
                                <div className="flex items-center text-sm text-gray-500">
                                    <Clock size={16} className="mr-2" />
                                    <span>Completed: {new Date(assignment.updated_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-600 mb-1">Candidate</div>
                                    <div className="font-medium">{assignment.users.full_name || assignment.users.email}</div>
                                </div>
                                <div className="text-right mt-4">
                                    <div className={`inline-flex items-center px-3 py-2 rounded-lg border ${
                                        overallScore === totalQuestions 
                                            ? 'bg-green-50 border-green-200 text-green-800'
                                            : overallScore > 0
                                            ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                                            : 'bg-red-50 border-red-200 text-red-800'
                                    }`}>
                                        <span className="text-2xl font-bold mr-2">{overallScore}/{totalQuestions}</span>
                                        <span>Questions Passed</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Results */}
            {results.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-500 text-lg">No results available yet.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {results.map((result, index) => (
                        <div key={result.id} className={`border rounded-lg shadow-sm ${getStatusColor(result.score)}`}>
                            {/* Header */}
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center mb-2">
                                            <span className="text-sm text-gray-500 mr-3">Question {index + 1}</span>
                                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                                                {result.coding_questions.language}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-semibold mb-2">{result.coding_questions.title}</h3>
                                        <p className="text-gray-600 mb-3 line-clamp-2">{result.coding_questions.question_text}</p>
                                        
                                        {/* Test Summary */}
                                        <div className="flex items-center space-x-4 text-sm">
                                            <span className="flex items-center">
                                                Tests Passed: <span className="font-medium ml-1">{result.passed_test_cases || 0}/{result.total_test_cases || 1}</span>
                                            </span>
                                            {result.execution_time && (
                                                <span>Execution: {result.execution_time}ms</span>
                                            )}
                                            {result.memory_used && (
                                                <span>Memory: {result.memory_used}KB</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-3">
                                        <div className={`flex items-center px-3 py-2 rounded-md font-medium ${getStatusColor(result.score)}`}>
                                            {getStatusIcon(result.score)}
                                            <span className="ml-2">{getStatusText(result.score)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="px-6 py-4 bg-gray-50 flex justify-between items-center">
                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => toggleExpanded(result.id)}
                                        className="flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        {expandedResults[result.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        <span className="ml-2">
                                            {expandedResults[result.id] ? 'Hide' : 'View'} Output
                                        </span>
                                    </button>
                                    
                                    <button
                                        onClick={() => toggleShowCode(result.id)}
                                        className="flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        <Code size={16} />
                                        <span className="ml-2">
                                            {showCode[result.id] ? 'Hide' : 'View'} Code
                                        </span>
                                    </button>
                                </div>
                                
                                <div className="text-sm text-gray-500">
                                    Status: {result.status_description || 'Unknown'}
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {(expandedResults[result.id] || showCode[result.id]) && (
                                <div className="border-t border-gray-200">
                                    {showCode[result.id] && (
                                        <div className="p-6 bg-gray-50">
                                            <h4 className="font-semibold mb-3 flex items-center">
                                                <Code size={16} className="mr-2" />
                                                Submitted Code
                                            </h4>
                                            <pre className="bg-gray-800 text-green-400 p-4 rounded-md text-sm overflow-auto max-h-96 border">
                                                <code>{result.submitted_code || 'Code not available'}</code>
                                            </pre>
                                        </div>
                                    )}
                                    
                                    {expandedResults[result.id] && (
                                        <div className="p-6">
                                            <h4 className="font-semibold mb-3">Execution Output</h4>
                                            <pre className="bg-gray-900 text-gray-100 p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap border font-mono">
                                                {formatOutput(result)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TestResultsPage;
