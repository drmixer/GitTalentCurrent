import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CodingQuestion, TestAssignment } from '../types';
import Editor from '@monaco-editor/react';
import { Play, Send, Loader } from 'lucide-react';

const TestPage: React.FC = () => {
    const { assignmentId } = useParams<{ assignmentId: string }>();
    const [assignment, setAssignment] = useState<TestAssignment | null>(null);
    const [questions, setQuestions] = useState<CodingQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [code, setCode] = useState('');
    const [output, setOutput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
    }, [fetchAssignmentAndQuestions]);

    useEffect(() => {
        if (questions.length > 0) {
            setCode(questions[currentQuestionIndex].starter_code || '');
        }
    }, [questions, currentQuestionIndex]);

    const handleRunCode = async () => {
        setOutput('');
        setIsSubmitting(true);
        const question = questions[currentQuestionIndex];
        const { data, error } = await supabase.functions.invoke('grade-submission', {
            body: {
                code,
                language_id: 71, // Python
                stdin: question.test_cases?.[0]?.stdin || '',
            },
        });

        if (error) {
            setOutput(`Error: ${error.message}`);
        } else {
            setOutput(data.stdout || data.stderr || 'No output');
        }
        setIsSubmitting(false);
    };

    const handleSubmit = async () => {
        if (!assignmentId) return;
        setIsSubmitting(true);
        const question = questions[currentQuestionIndex];
        const { data, error } = await supabase.functions.invoke<{ status: { id: number }, stdout: string, stderr: string }>('grade-submission', {
            body: {
                code,
                language_id: 71, // Python
                stdin: question.test_cases?.[0]?.stdin || '',
                expected_output: question.expected_output,
            },
        });

        if (error) {
            // Handle error
        } else if (data) {
            // Store result
            await supabase.from('test_results').insert({
                assignment_id: assignmentId,
                question_id: question.id,
                score: data.status.id === 3 ? 1 : 0, // 3 is "Accepted"
                stdout: data.stdout,
                stderr: data.stderr,
                passed_test_cases: data.status.id === 3 ? 1 : 0,
                total_test_cases: 1,
            });
        }

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            // Test finished
            await supabase.from('test_assignments').update({ status: 'Completed' }).eq('id', assignmentId);
            // Redirect or show completion message
        }
        setIsSubmitting(false);
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

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="flex h-screen">
            <div className="w-1/3 p-4 overflow-y-auto">
                <h1 className="text-2xl font-bold mb-4">{assignment.coding_tests.title}</h1>
                <h2 className="text-xl font-semibold mb-2">{currentQuestion.question_text}</h2>
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
    );
};

export default TestPage;
