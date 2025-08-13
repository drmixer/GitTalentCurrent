import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CodingQuestion, TestAssignment } from '../types';
import Editor from '@monaco-editor/react';
import { Play, Send, Loader, CheckCircle, ArrowRight } from 'lucide-react';
import SandpackTest from '../components/Tests/SandpackTest';

const TestPage: React.FC = () => {
    const { assignmentId } = useParams<{ assignmentId: string }>();
    const [assignment, setAssignment] = useState<TestAssignment | null>(null);
    const [questions, setQuestions] = useState<CodingQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [code, setCode] = useState('');
    const [output, setOutput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [lastResult, setLastResult] = useState<any>(null);
    const navigate = useNavigate();

    const fetchAssignmentAndQuestions = useCallback(async () => {
        if (!assignmentId) return;
        setIsLoading(true);
        const { data: assignmentData, error: assignmentError } = await supabase
            .from('test_assignments')
            .select('*, coding_tests(*)')
            .eq('id', assignmentId)
            .single();

        if (assignmentError) {
            console.error('Error fetching assignment:', assignmentError);
            setIsLoading(false);
            return;
        }

        setAssignment(assignmentData as TestAssignment);

        const { data: questionsData, error: questionsError } = await supabase
            .from('coding_questions')
            .select('*')
            .eq('test_id', assignmentData.test_id)
            .order('created_at', { ascending: true });

        if (questionsError) {
            console.error('Error fetching questions:', questionsError);
        } else {
            setQuestions(questionsData as CodingQuestion[]);
        }
        setIsLoading(false);
    }, [assignmentId]);

    useEffect(() => {
        fetchAssignmentAndQuestions();
        markNotificationAsRead();
    }, [fetchAssignmentAndQuestions]);

    const markNotificationAsRead = async () => {
        if (!assignmentId) return;
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('entity_id', assignmentId)
            .eq('type', 'test_assignment');
        if (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    useEffect(() => {
        if (questions.length > 0) {
            setCode(questions[currentQuestionIndex].starter_code || '');
            setOutput(''); // Clear output when switching questions
            setLastResult(null); // Clear last result
        }
    }, [questions, currentQuestionIndex]);

    const getLanguageId = (language: string): number => {
        const languageMap: { [key: string]: number } = {
            'python': 71,
            'javascript': 63,
            'java': 62,
            'c++': 54,
            'swift': 83,
            'kotlin': 78,
            'react': 63,
            'angular': 63,
            'vue': 63
        };
        return languageMap[language.toLowerCase()] || 71;
    };

    const handleRunCode = async () => {
        const question = questions[currentQuestionIndex];
        setOutput('Running code...');
        setIsSubmitting(true);
        
        try {
            // For run-code, we'll just run the first test case to give feedback
            const firstTestCase = question.test_cases?.[0];
            const { data, error } = await supabase.functions.invoke('run-code', {
                body: {
                    code: code,
                    language_id: getLanguageId(question.language),
                    stdin: firstTestCase?.input || '',
                },
            });

            if (error) {
                setOutput(`Error running code: ${error.message}`);
            } else {
                let displayOutput = '';
                if (data.stdout) displayOutput += `Output:\n${data.stdout}\n`;
                if (data.stderr) displayOutput += `\nErrors:\n${data.stderr}\n`;
                if (!data.stdout && !data.stderr) displayOutput = 'No output generated';
                
                displayOutput += `\nStatus: ${data.status?.description || 'Unknown'}`;
                setOutput(displayOutput);
            }
        } catch (error) {
            setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!assignmentId) return;
        setIsSubmitting(true);
        setOutput('Submitting and running all test cases...');
        
        try {
            const question = questions[currentQuestionIndex];
            
            const { data, error } = await supabase.functions.invoke('grade-submission', {
                body: {
                    code: code,
                    language_id: getLanguageId(question.language),
                    assignment_id: assignmentId,
                    question_id: question.id,
                },
            });

            if (error) {
                setOutput(`Error submitting code: ${error.message}`);
            } else if (data) {
                setLastResult(data);
                
                // Display detailed results
                let resultOutput = '';
                if (data.stdout) {
                    resultOutput += `Test Output:\n${data.stdout}\n`;
                }
                if (data.stderr && data.stderr.trim()) {
                    resultOutput += `\nErrors:\n${data.stderr}\n`;
                }
                if (data.compile_output && data.compile_output.trim()) {
                    resultOutput += `\nCompile Output:\n${data.compile_output}\n`;
                }
                
                resultOutput += `\n=== FINAL RESULT ===`;
                resultOutput += `\nStatus: ${data.status?.description || 'Unknown'}`;
                resultOutput += `\nTests Passed: ${data.test_summary?.passed_tests || 0}/${data.test_summary?.total_tests || 1}`;
                resultOutput += `\nOverall Result: ${data.passed ? 'PASSED ✅' : 'FAILED ❌'}`;
                
                setOutput(resultOutput);
                
                // Auto-advance after showing results
                setTimeout(() => {
                    handleNextQuestion();
                }, 3000);
            }
        } catch (error) {
            setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            // Test completed
            setIsCompleted(true);
            setTimeout(() => {
                navigate('/developer');
            }, 3000);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader className="animate-spin w-8 h-8" />
                <span className="ml-2">Loading test...</span>
            </div>
        );
    }

    if (!assignment) {
        return <div className="p-8 text-center">Test not found.</div>;
    }

    if (questions.length === 0) {
        return <div className="p-8 text-center">This test has no questions.</div>;
    }

    if (isCompleted) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Test Completed! 🎉</h1>
                <p className="text-gray-600 text-center">
                    Your results have been saved and sent to the recruiter.
                </p>
                <p className="text-gray-600 text-center">
                    You will be redirected to your dashboard shortly.
                </p>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const sandpackLanguages = ['react', 'vue', 'angular'];

    // Handle Sandpack languages (React, Vue, Angular)
    if (sandpackLanguages.includes(currentQuestion.language.toLowerCase())) {
        return (
            <div className="p-8">
                <div className="w-full lg:w-2/3 mx-auto">
                    <h1 className="text-2xl font-bold mb-4">{assignment.coding_tests.title}</h1>
                    <h2 className="text-xl font-semibold mb-2">{currentQuestion.title}</h2>
                    <p className="mb-4">{currentQuestion.question_text}</p>
                    
                    {currentQuestion.expected_output && (
                        <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                            <h3 className="font-semibold text-blue-800 mb-2">Expected Behavior/Output:</h3>
                            <p className="text-blue-700 whitespace-pre-wrap">{currentQuestion.expected_output}</p>
                        </div>
                    )}
                    
                    <SandpackTest
                        framework={currentQuestion.language.toLowerCase() as 'react' | 'vue' | 'angular'}
                        starterCode={currentQuestion.starter_code || ''}
                        testCode={currentQuestion.test_code}
                        assignmentId={assignmentId!}
                        questionId={currentQuestion.id}
                        onTestComplete={handleNextQuestion}
                    />
                </div>
            </div>
        );
    }

    // Handle Judge0 languages (Python, Java, C++, JavaScript, Swift, Kotlin)
    return (
        <div className="p-8">
            <div className="flex h-screen">
                {/* Question Panel */}
                <div className="w-1/3 p-4 overflow-y-auto border-r border-gray-200">
                    <h1 className="text-2xl font-bold mb-4">{assignment.coding_tests.title}</h1>
                    <h2 className="text-xl font-semibold mb-2">{currentQuestion.title}</h2>
                    
                    <div className="mb-4 p-3 bg-gray-100 rounded-md">
                        <p className="text-sm text-gray-600">
                            Question {currentQuestionIndex + 1} of {questions.length}
                        </p>
                        <p className="text-sm text-gray-600">
                            Language: {currentQuestion.language}
                        </p>
                    </div>
                    
                    <div className="mb-4">
                        <h3 className="font-semibold mb-2">Problem Description:</h3>
                        <p className="whitespace-pre-wrap">{currentQuestion.question_text}</p>
                    </div>
                    
                    {/* Show test cases if available */}
                    {currentQuestion.test_cases && currentQuestion.test_cases.length > 0 && (
                        <div className="mb-4">
                            <h3 className="font-semibold mb-2">Test Cases:</h3>
                            <div className="space-y-2">
                                {currentQuestion.test_cases.slice(0, 3).map((tc, index) => (
                                    <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                                        <div><strong>Input:</strong> <code>{tc.input || '(empty)'}</code></div>
                                        <div><strong>Expected:</strong> <code>{tc.expected_output}</code></div>
                                    </div>
                                ))}
                                {currentQuestion.test_cases.length > 3 && (
                                    <p className="text-sm text-gray-500">
                                        + {currentQuestion.test_cases.length - 3} more test cases...
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Show last result if available */}
                    {lastResult && (
                        <div className={`mb-4 p-3 rounded-md ${lastResult.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <h3 className="font-semibold mb-2">Last Submission Result:</h3>
                            <p className={`text-sm ${lastResult.passed ? 'text-green-700' : 'text-red-700'}`}>
                                {lastResult.passed ? '✅ PASSED' : '❌ FAILED'}
                            </p>
                            {lastResult.test_summary && (
                                <p className="text-sm text-gray-600">
                                    {lastResult.test_summary.passed_tests}/{lastResult.test_summary.total_tests} tests passed
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Code Editor and Output Panel */}
                <div className="w-2/3 flex flex-col">
                    {/* Code Editor */}
                    <div className="flex-1">
                        <Editor
                            height="60vh"
                            language={getEditorLanguage(currentQuestion.language)}
                            value={code}
                            onChange={(value) => setCode(value || '')}
                            theme="vs-dark"
                            options={{
                                fontSize: 14,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                automaticLayout: true
                            }}
                        />
                    </div>
                    
                    {/* Output Panel */}
                    <div className="p-4 bg-gray-800 text-white flex-1 min-h-[250px]">
                        <h3 className="text-lg font-semibold mb-2">Output</h3>
                        <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto h-full">
                            {output || 'Run your code to see output here...'}
                        </pre>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-white">
                        <div className="text-sm text-gray-600">
                            {isSubmitting && (
                                <span className="flex items-center">
                                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                                    {output.includes('Submitting') ? 'Grading submission...' : 'Running code...'}
                                </span>
                            )}
                        </div>
                        <div className="flex space-x-4">
                            <button 
                                onClick={handleRunCode} 
                                disabled={isSubmitting} 
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md flex items-center hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Play size={16} className="mr-2" /> 
                                {isSubmitting && !output.includes('Submitting') ? 'Running...' : 'Test Run'}
                            </button>
                            <button 
                                onClick={handleSubmit} 
                                disabled={isSubmitting} 
                                className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={16} className="mr-2" /> 
                                {isSubmitting && output.includes('Submitting') ? 'Submitting...' : 'Submit Solution'}
                            </button>
                            {lastResult && lastResult.passed && (
                                <button 
                                    onClick={handleNextQuestion}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md flex items-center hover:bg-green-700 transition-colors"
                                >
                                    <ArrowRight size={16} className="mr-2" />
                                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Test'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper function to map language names to Monaco editor language IDs
function getEditorLanguage(language: string): string {
    const languageMap: { [key: string]: string } = {
        'python': 'python',
        'java': 'java',
        'javascript': 'javascript',
        'c++': 'cpp',
        'swift': 'swift',
        'kotlin': 'kotlin'
    };
    return languageMap[language.toLowerCase()] || 'python';
}

export default TestPage;
