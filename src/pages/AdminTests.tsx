import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CodingTest, CodingQuestion } from '../types';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

const AdminTests: React.FC = () => {
    const [tests, setTests] = useState<CodingTest[]>([]);
    const [questions, setQuestions] = useState<{ [key: string]: CodingQuestion[] }>({});
    const [editingTest, setEditingTest] = useState<Partial<CodingTest> | null>(null);
    const [editingQuestion, setEditingQuestion] = useState<Partial<CodingQuestion> | null>(null);

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        const { data, error } = await supabase.from('coding_tests').select('*');
        if (error) {
            console.error('Error fetching tests:', error);
        } else {
            setTests(data as CodingTest[]);
        }
    };

    const fetchQuestions = async (testId: string) => {
        const { data, error } = await supabase.from('coding_questions').select('*').eq('test_id', testId);
        if (error) {
            console.error('Error fetching questions:', error);
        } else {
            setQuestions(prev => ({ ...prev, [testId]: data as CodingQuestion[] }));
        }
    };

    const handleSaveTest = async () => {
        if (!editingTest) return;
        const { id, ...testData } = editingTest;
        const { error } = id
            ? await supabase.from('coding_tests').update(testData).eq('id', id)
            : await supabase.from('coding_tests').insert(testData);

        if (error) {
            console.error('Error saving test:', error);
        } else {
            setEditingTest(null);
            fetchTests();
        }
    };

    const handleDeleteTest = async (testId: string) => {
        if (window.confirm('Are you sure you want to delete this test and all its questions?')) {
            const { error } = await supabase.from('coding_tests').delete().eq('id', testId);
            if (error) {
                console.error('Error deleting test:', error);
            } else {
                fetchTests();
            }
        }
    };

    const sandpackLanguages = ['react', 'vue', 'angular'];

    const handleSaveQuestion = async () => {
        if (!editingQuestion || !editingQuestion.test_id) return;

        const isSandpack = sandpackLanguages.includes(editingQuestion.language || '');

        let questionData: Partial<CodingQuestion>;

        if (isSandpack) {
            questionData = {
                test_id: editingQuestion.test_id,
                title: editingQuestion.title,
                question_text: editingQuestion.question_text,
                language: editingQuestion.language,
                starter_code: editingQuestion.starter_code,
                test_code: editingQuestion.test_code, // Use test_code for Sandpack
                test_cases: null, // Ensure test_cases is null for Sandpack
            };
        } else {
            questionData = {
                test_id: editingQuestion.test_id,
                title: editingQuestion.title,
                question_text: editingQuestion.question_text,
                language: editingQuestion.language,
                starter_code: editingQuestion.starter_code,
                test_cases: editingQuestion.test_cases, // Use test_cases for Judge0
                test_code: null, // Ensure test_code is null for Judge0
            };
        }

        // Remove id from data to be inserted/updated
        const { id, ...dataToSave } = questionData;

        if (editingQuestion.id) {
            // Update existing question
            const { error } = await supabase.from('coding_questions').update(dataToSave).eq('id', editingQuestion.id);
            if (error) {
                console.error('Error updating question:', error);
            } else {
                fetchQuestions(editingQuestion.test_id);
                setEditingQuestion(null);
            }
        } else {
            // Insert new question
            const { error } = await supabase.from('coding_questions').insert(dataToSave);
            if (error) {
                console.error('Error inserting question:', error);
            } else {
                fetchQuestions(editingQuestion.test_id);
                setEditingQuestion(null);
            }
        }
    };

    const handleDeleteQuestion = async (questionId: string, testId: string) => {
        const { error } = await supabase.from('coding_questions').delete().eq('id', questionId);
        if (error) {
            console.error('Error deleting question:', error);
        } else {
            fetchQuestions(testId);
        }
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Manage Coding Tests</h1>
            <button onClick={() => setEditingTest({})} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md flex items-center">
                <Plus size={16} className="mr-2" /> Add New Test
            </button>

            {editingTest && (
                <div className="mb-4 p-4 border rounded-md">
                    <h2 className="text-xl font-semibold mb-2">{editingTest.id ? 'Edit Test' : 'New Test'}</h2>
                    <input
                        type="text"
                        placeholder="Title"
                        value={editingTest.title || ''}
                        onChange={(e) => setEditingTest({ ...editingTest, title: e.target.value })}
                        className="w-full p-2 mb-2 border rounded-md"
                    />
                    <textarea
                        placeholder="Description"
                        value={editingTest.description || ''}
                        onChange={(e) => setEditingTest({ ...editingTest, description: e.target.value })}
                        className="w-full p-2 mb-2 border rounded-md"
                    />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setEditingTest(null)}><X /></button>
                        <button onClick={handleSaveTest}><Save /></button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {tests.map(test => (
                    <div key={test.id} className="p-4 border rounded-md">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold">{test.title}</h2>
                            <div>
                                <button onClick={() => setEditingTest(test)}><Edit className="mr-2" /></button>
                                <button onClick={() => handleDeleteTest(test.id)}><Trash2 /></button>
                            </div>
                        </div>
                        <p className="text-gray-600">{test.description}</p>
                        <div className="mt-4">
                            <h3 className="font-bold">Questions</h3>
                            <button onClick={() => fetchQuestions(test.id)} className="text-sm text-blue-600">Load Questions</button>
                            <button onClick={() => setEditingQuestion({ test_id: test.id, title: '', language: 'python' })} className="ml-4 px-2 py-1 bg-gray-200 rounded-md text-sm">Add Question</button>
                            {questions[test.id] && (
                                <div className="space-y-2 mt-2">
                                    {questions[test.id].map(q => (
                                        <div key={q.id} className="p-2 border rounded-md">
                                            <p>{q.title}</p>
                                            <div className="flex justify-end space-x-2">
                                                <button onClick={() => setEditingQuestion(q)}><Edit size={16} /></button>
                                                <button onClick={() => handleDeleteQuestion(q.id, test.id)}><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {editingQuestion && editingQuestion.test_id === test.id && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                                    <h2 className="text-xl font-bold mb-4">{editingQuestion.id ? 'Edit Question' : 'New Question'}</h2>
                                    <input
                                        type="text"
                                        placeholder="Title"
                                        value={editingQuestion.title || ''}
                                        onChange={(e) => setEditingQuestion({ ...editingQuestion, title: e.target.value })}
                                        className="w-full p-2 mb-2 border rounded-md"
                                    />
                                    <textarea
                                        placeholder="Question Text"
                                        value={editingQuestion.question_text || ''}
                                        onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                                        className="w-full p-2 mb-2 border rounded-md"
                                    />
                                    <select
                                        value={editingQuestion.language || ''}
                                        onChange={(e) => setEditingQuestion({ ...editingQuestion, language: e.target.value })}
                                        className="w-full p-2 mb-2 border rounded-md"
                                    >
                                        <option value="">Select Language</option>
                                        <option value="python">Python</option>
                                        <option value="javascript">JavaScript</option>
                                        <option value="java">Java</option>
                                        <option value="c++">C++</option>
                                        <option value="react">React</option>
                                        <option value="angular">Angular</option>
                                        <option value="vue">Vue</option>
                                    </select>
                                    <textarea
                                        placeholder="Starter Code"
                                        value={editingQuestion.starter_code || ''}
                                        onChange={(e) => setEditingQuestion({ ...editingQuestion, starter_code: e.target.value })}
                                        className="w-full p-2 mb-2 border rounded-md h-32"
                                    />
                                    {sandpackLanguages.includes(editingQuestion.language || '') ? (
                                        <div>
                                            <h3 className="font-semibold mb-2">Test Code</h3>
                                            <textarea
                                                placeholder="Enter the test code (e.g., using Jest and @testing-library/react)"
                                                value={editingQuestion.test_code || ''}
                                                onChange={(e) => setEditingQuestion({ ...editingQuestion, test_code: e.target.value })}
                                                className="w-full p-2 mb-2 border rounded-md h-48 font-mono"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <h3 className="font-semibold mb-2">Test Cases (for Judge0)</h3>
                                            {editingQuestion.test_cases?.map((tc, index) => (
                                                <div key={index} className="flex space-x-2 mb-2">
                                                    <textarea
                                                        placeholder="Stdin"
                                                        value={tc.stdin}
                                                        onChange={(e) => {
                                                            const newTestCases = [...(editingQuestion.test_cases || [])];
                                                            newTestCases[index] = { ...newTestCases[index], stdin: e.target.value };
                                                            setEditingQuestion({ ...editingQuestion, test_cases: newTestCases });
                                                        }}
                                                        className="w-full p-2 border rounded-md"
                                                    />
                                                    <textarea
                                                        placeholder="Expected Output"
                                                        value={tc.expected_output}
                                                        onChange={(e) => {
                                                            const newTestCases = [...(editingQuestion.test_cases || [])];
                                                            newTestCases[index] = { ...newTestCases[index], expected_output: e.target.value };
                                                            setEditingQuestion({ ...editingQuestion, test_cases: newTestCases });
                                                        }}
                                                        className="w-full p-2 border rounded-md"
                                                    />
                                                    <button onClick={() => {
                                                        const newTestCases = [...(editingQuestion.test_cases || [])];
                                                        newTestCases.splice(index, 1);
                                                        setEditingQuestion({ ...editingQuestion, test_cases: newTestCases });
                                                    }}><Trash2 size={16} /></button>
                                                </div>
                                            ))}
                                            <button onClick={() => {
                                                const newTestCases = [...(editingQuestion.test_cases || []), { stdin: '', expected_output: '' }];
                                                setEditingQuestion({ ...editingQuestion, test_cases: newTestCases });
                                            }} className="text-sm text-blue-600">Add Test Case</button>
                                        </div>
                                    )}
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => setEditingQuestion(null)} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                                        <button onClick={handleSaveQuestion} className="px-4 py-2 bg-blue-600 text-white rounded-md">Save</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

        </div>
    );
};

export default AdminTests;
