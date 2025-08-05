import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CodingQuestion, TestAssignment } from '../types';
import Editor from '@monaco-editor/react';
import { Play, Send, Loader, CheckCircle } from 'lucide-react';
import SandpackTest from '../components/Tests/SandpackTest'; // Import the Sandpack component

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
            .eq('test_id', assignmentData.test_id);

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
        }
    }, [questions, currentQuestionIndex]);

    const getLanguageId = (language: string) => {
        switch (language) {
            case 'python':
                return 71;
            case 'javascript':
                return 63;
            case 'java':
                return 62;
            case 'c++':
                return 54;
            case 'react':
                return 63; // Use JavaScript for React
            case 'angular':
                return 63; // Use JavaScript for Angular
            case 'vue':
                return 63; // Use JavaScript for Vue
            default:
                return 71; // Default to Python
        }
    }

    const handleRunCode = async () => {
        setOutput('');
        setIsSubmitting(true);
        const question = questions[currentQuestionIndex];
        const { data, error } = await supabase.functions.invoke('run-code', {
            body: {
                code,
                language_id: getLanguageId(question.language),
                stdin: question.test_cases?.[0]?.stdin || '',
            },
        });

        if (error) {
            setOutput(`Error running code: ${error.message}`);
        } else {
            setOutput(data.stdout || data.stderr || 'No output');
        }
        setIsSubmitting(false);
    };

    const handleSubmit = async () => {
        if (!assignmentId) return;
        setIsSubmitting(true);
        
        try {
            const question = questions[currentQuestionIndex];
            const { data, error } = await supabase.functions.invoke<{ 
                status: { id: number }, 
                stdout: string, 
                stderr: string 
            }>('grade-submission', {
                body: {
                    code,
                    language_id: getLanguageId(question.language),
                    stdin: question.test_cases?.[0]?.stdin || '',
                    expected_output: question.expected_output,
                    assignment_id: assignmentId,
                    question_id: question.id,
                },
            });

            if (error) {
                console.error('Failed to submit code:', error);
                setOutput(`Error submitting code: ${error.message}`);
            } else if (data) {
                // Use upsert to prevent duplicates
                const { error: insertError } = await supabase.from('test_results').upsert({
                    assignment_id: assignmentId,
                    question_id: question.id,
                    score: data.status.id === 3 ? 1 : 0, // 3 is "Accepted"
                    stdout: data.stdout,
                    stderr: data.stderr,
                    passed_test_cases: data.status.id === 3 ? 1 : 0,
                    total_test_cases: 1,
                }, {
                    onConflict: 'assignment_id,question_id'
                });

                if (insertError) {
                    console.error('Error saving test result:', insertError);
                }

                // Show result to user
                setOutput(data.stdout || data.stderr || 'Submission completed');
            }

            // Move to next question or complete test
            if (currentQuestionIndex < questions.length - 1) {
                setCurrentQuestionIndex(currentQuestionIndex + 1);
            } else {
                // Test finished
                await supabase.from('test_assignments').update({ 
                    status: 'Completed' 
                }).eq('id', assignmentId);
                setIsCompleted(true);
                setTimeout(() => {
                    navigate('/developer');
                }, 3000);
            }
        } catch (error) {
            console.error('Error in handleSubmit:', error);
            setOutput(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader className="animate-spin" /></div>;
    }

    if (!assignment) {
        return <div>Test not found.</div>;
    }

    if (questions.length === 0) {
        return <div>This test has no questions.</div>;
    }

    if (isCompleted) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Test Completed!</h1>
                <p className="text-gray-600">Your results have been sent to the recruiter.</p>
                <p className="text-gray-600">You will be redirected to your dashboard shortly.</p>
            </div>
        );
    }

    const sandpackLanguages = ['react', 'vue', 'angular'];
    const currentQuestion = questions[currentQuestionIndex];

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            // Test finished
            supabase.from('test_assignments').update({ status: 'Completed' }).eq('id', assignmentId)
            .then(({ error }) => {
                if (error) {
                    console.error('Error updating assignment status:', error);
                } else {
                    console.log('Assignment status updated to Completed.');
                }
            });
            setIsCompleted(true);
            setTimeout(() => {
                navigate('/developer');
            }, 3000);
        }
    }

    // Check if the current question is a Sandpack question
    if (sandpackLanguages.includes(currentQuestion.language.toLowerCase())) {
        return (
            <div className="p-8">
                <div className="w-full lg:w-2/3 mx-auto">
                    <h1 className="text-2xl font-bold mb-4">{assignment.coding_tests.title}</h1>
                    <h2 className="text-xl font-semibold mb-2">{currentQuestion.title}</h2>
                    <p className="mb-4">{currentQuestion.question_text}</p>
                    
                    {/* Show expected output if it exists */}
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

    // Fallback to the Judge0 editor for other languages
    return (
        <div className="p-8">
            <div className="flex h-screen">
                <div className="w-1/3 p-4 overflow-y-auto">
                    <h1 className="text-2xl font-bold mb-4">{assignment.coding_tests.title}</h1>
                    <h2 className="text-xl font-semibold mb-2">{currentQuestion.title}</h2>
                    <p>{currentQuestion.question_text}</p>
                </div>
                <div className="w-2/3 flex flex-col">
                    <Editor
                        height="60vh"
                        language={currentQuestion.language.toLowerCase()}
                        value={code}
                        onChange={(value) => setCode(value || '')}
                        theme="vs-dark"
                    />
                    <div className="p-4 bg-gray-800 text-white flex-grow">
                        <h3 className="text-lg font-semibold">Output</h3>
                        <pre className="whitespace-pre-wrap">{output}</pre>
                    </div>
                    <div className="p-4 border-t border-gray-200 flex justify-end space-x-4">
                        <button onClick={handleRunCode} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 rounded-md flex items-center">
                            <Play size={16} className="mr-2" /> Run
                        </button>
                        <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center">
                            <Send size={16} className="mr-2" /> Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestPage;
