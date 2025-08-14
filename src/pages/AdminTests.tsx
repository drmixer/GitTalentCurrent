import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CodingTest, CodingQuestion } from '../types';
import { Plus, Edit, Trash2, Save, X, Copy, Eye } from 'lucide-react';

const AdminTests: React.FC = () => {
    const [tests, setTests] = useState<CodingTest[]>([]);
    const [questions, setQuestions] = useState<{ [key: string]: CodingQuestion[] }>({});
    const [editingTest, setEditingTest] = useState<Partial<CodingTest> | null>(null);
    const [editingQuestion, setEditingQuestion] = useState<Partial<CodingQuestion> | null>(null);
    const [previewQuestion, setPreviewQuestion] = useState<CodingQuestion | null>(null);

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        const { data, error } = await supabase.from('coding_tests').select('*').order('created_at', { ascending: true });
        if (error) {
            console.error('Error fetching tests:', error);
        } else {
            setTests(data as CodingTest[]);
        }
    };

    const fetchQuestions = async (testId: string) => {
        const { data, error } = await supabase
            .from('coding_questions')
            .select('*')
            .eq('test_id', testId)
            .order('created_at', { ascending: true });
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

    const sandpackLanguages = ['react', 'vue', 'angular', 'javascript'];
    const judge0Languages = ['python', 'java', 'c++', 'swift', 'kotlin'];

    const handleSaveQuestion = async () => {
        if (!editingQuestion || !editingQuestion.test_id) return;

        const isSandpack = sandpackLanguages.includes(editingQuestion.language?.toLowerCase() || '');

        let questionData: Partial<CodingQuestion>;

        if (isSandpack) {
            // Handle Sandpack languages (React, Vue, Angular, JavaScript)
            let finalTestCode = editingQuestion.test_code || '';
            if (['react', 'javascript'].includes(editingQuestion.language?.toLowerCase() || '') && !finalTestCode.includes('@testing-library/jest-dom')) {
                finalTestCode = `import '@testing-library/jest-dom';\n${finalTestCode}`;
            }
            questionData = {
                test_id: editingQuestion.test_id,
                title: editingQuestion.title,
                question_text: editingQuestion.question_text,
                language: editingQuestion.language,
                starter_code: editingQuestion.starter_code,
                test_code: finalTestCode,
                expected_output: editingQuestion.expected_output,
                test_cases: null, // Sandpack uses test_code instead
            };
        } else {
            // Handle Judge0 languages (Python, Java, C++, Swift, Kotlin)
            questionData = {
                test_id: editingQuestion.test_id,
                title: editingQuestion.title,
                question_text: editingQuestion.question_text,
                language: editingQuestion.language,
                starter_code: editingQuestion.starter_code,
                test_cases: editingQuestion.test_cases,
                test_code: null, // Judge0 uses test_cases instead
                expected_output: null, // Judge0 uses test_cases for expected outputs
            };
        }

        const { id, ...dataToSave } = questionData;

        if (editingQuestion.id) {
            const { error } = await supabase.from('coding_questions').update(dataToSave).eq('id', editingQuestion.id);
            if (error) {
                console.error('Error updating question:', error);
            } else {
                fetchQuestions(editingQuestion.test_id);
                setEditingQuestion(null);
            }
        } else {
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
        if (window.confirm('Are you sure you want to delete this question?')) {
            const { error } = await supabase.from('coding_questions').delete().eq('id', questionId);
            if (error) {
                console.error('Error deleting question:', error);
            } else {
                fetchQuestions(testId);
            }
        }
    };

    const getLanguageTemplate = (language: string) => {
        const templates = {
            python: `# Write your solution here
def solve():
    # Your code here
    pass

# Test your solution
if __name__ == "__main__":
    result = solve()
    print(result)`,
            java: `import java.util.Scanner;

class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Your code here
        // Read input and process
        // Print your answer
        scanner.close();
    }
}`,
            javascript: `// Write your solution here
function solve() {
    // Your code here
    return "Hello World";
}

// Export for testing
module.exports = solve;`,
            'c++': `#include <iostream>
using namespace std;

int main() {
    // Your code here
    return 0;
}`,
            swift: `import Foundation

// Write your solution here
func solve() {
    // Your code here
}

// Test your solution
solve()`,
            kotlin: `fun main() {
    // Your code here
}`,
            react: `import React from 'react';

const MyComponent = () => {
    // Your code here
    return <div>Hello World</div>;
};

export default MyComponent;`
        };
        return templates[language as keyof typeof templates] || templates.javascript;
    };

    const addDefaultTestCase = () => {
        if (!editingQuestion) return;
        const newTestCases = [...(editingQuestion.test_cases || []), { input: '', expected_output: '' }];
        setEditingQuestion({ ...editingQuestion, test_cases: newTestCases });
    };

    const updateTestCase = (index: number, field: 'input' | 'expected_output', value: string) => {
        if (!editingQuestion) return;
        const newTestCases = [...(editingQuestion.test_cases || [])];
        newTestCases[index] = { ...newTestCases[index], [field]: value };
        setEditingQuestion({ ...editingQuestion, test_cases: newTestCases });
    };

    const removeTestCase = (index: number) => {
        if (!editingQuestion) return;
        const newTestCases = [...(editingQuestion.test_cases || [])];
        newTestCases.splice(index, 1);
        setEditingQuestion({ ...editingQuestion, test_cases: newTestCases });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Manage Coding Tests</h1>
                <button 
                    onClick={() => setEditingTest({})} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center hover:bg-blue-700 transition-colors"
                >
                    <Plus size={16} className="mr-2" /> Add New Test
                </button>
            </div>

            {/* Test Editing Modal */}
            {editingTest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{editingTest.id ? 'Edit Test' : 'New Test'}</h2>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Test Title"
                                value={editingTest.title || ''}
                                onChange={(e) => setEditingTest({ ...editingTest, title: e.target.value })}
                                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <textarea
                                placeholder="Test Description"
                                value={editingTest.description || ''}
                                onChange={(e) => setEditingTest({ ...editingTest, description: e.target.value })}
                                className="w-full p-3 border rounded-md h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                            <button 
                                onClick={() => setEditingTest(null)}
                                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                <X size={16} className="inline mr-2" />Cancel
                            </button>
                            <button 
                                onClick={handleSaveTest}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                <Save size={16} className="inline mr-2" />Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tests List */}
            <div className="space-y-6">
                {tests.map(test => (
                    <div key={test.id} className="bg-white border rounded-lg shadow-sm">
                        <div className="p-6 border-b">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-semibold">{test.title}</h2>
                                    <p className="text-gray-600 mt-1">{test.description}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={() => setEditingTest(test)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteTest(test.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Questions</h3>
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={() => fetchQuestions(test.id)} 
                                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                    >
                                        Load Questions
                                    </button>
                                    <button 
                                        onClick={() => setEditingQuestion({ 
                                            test_id: test.id, 
                                            title: '', 
                                            language: 'javascript',
                                            starter_code: getLanguageTemplate('javascript'),
                                            test_code: ''
                                        })} 
                                        className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                                    >
                                        Add Question
                                    </button>
                                </div>
                            </div>

                            {questions[test.id] && (
                                <div className="grid gap-3">
                                    {questions[test.id].map(q => (
                                        <div key={q.id} className="p-4 border rounded-md bg-gray-50">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <h4 className="font-medium">{q.title}</h4>
                                                    <p className="text-sm text-gray-600 mt-1">{q.language}</p>
                                                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{q.question_text}</p>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button 
                                                        onClick={() => setPreviewQuestion(q)}
                                                        className="p-1 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingQuestion(q)}
                                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteQuestion(q.id, test.id)}
                                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Question Preview Modal */}
            {previewQuestion && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Preview: {previewQuestion.title}</h2>
                            <button 
                                onClick={() => setPreviewQuestion(null)}
                                className="p-2 hover:bg-gray-100 rounded-md"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold">Language:</h3>
                                <p className="bg-gray-100 px-2 py-1 rounded text-sm inline-block">{previewQuestion.language}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold">Question:</h3>
                                <p className="whitespace-pre-wrap">{previewQuestion.question_text}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold">Starter Code:</h3>
                                <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">{previewQuestion.starter_code}</pre>
                            </div>
                            {previewQuestion.test_cases && (
                                <div>
                                    <h3 className="font-semibold">Test Cases:</h3>
                                    <div className="space-y-2">
                                        {previewQuestion.test_cases.map((tc, index) => (
                                            <div key={index} className="bg-gray-100 p-2 rounded text-sm">
                                                <div><strong>Input:</strong> <code>{tc.input || '(empty)'}</code></div>
                                                <div><strong>Expected:</strong> <code>{tc.expected_output}</code></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {previewQuestion.test_code && (
                                <div>
                                    <h3 className="font-semibold">Test Code:</h3>
                                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">{previewQuestion.test_code}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Question Editing Modal */}
            {editingQuestion && editingQuestion.test_id && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-5xl max-h-[95vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-6">{editingQuestion.id ? 'Edit Question' : 'New Question'}</h2>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column - Basic Info */}
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Question Title"
                                    value={editingQuestion.title || ''}
                                    onChange={(e) => setEditingQuestion({ ...editingQuestion, title: e.target.value })}
                                    className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500"
                                />
                                
                                <textarea
                                    placeholder="Question Description"
                                    value={editingQuestion.question_text || ''}
                                    onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                                    className="w-full p-3 border rounded-md h-32 focus:ring-2 focus:ring-blue-500"
                                />
                                
                                <select
                                    value={editingQuestion.language || ''}
                                    onChange={(e) => {
                                        const newLanguage = e.target.value;
                                        setEditingQuestion({ 
                                            ...editingQuestion, 
                                            language: newLanguage,
                                            starter_code: getLanguageTemplate(newLanguage),
                                            // Reset test data when changing language
                                            test_cases: judge0Languages.includes(newLanguage) ? [{ input: '', expected_output: '' }] : null,
                                            test_code: sandpackLanguages.includes(newLanguage) ? '' : null
                                        });
                                    }}
                                    className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Language</option>
                                    <optgroup label="Judge0 Languages">
                                        <option value="python">Python</option>
                                        <option value="java">Java</option>
                                        <option value="c++">C++</option>
                                        <option value="swift">Swift</option>
                                        <option value="kotlin">Kotlin</option>
                                    </optgroup>
                                    <optgroup label="Sandpack Languages">
                                        <option value="react">React</option>
                                        <option value="angular">Angular</option>
                                        <option value="vue">Vue</option>
                                        <option value="javascript">JavaScript</option>
                                    </optgroup>
                                </select>
                            </div>

                            {/* Right Column - Code and Tests */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Starter Code</label>
                                    <textarea
                                        placeholder="Initial code provided to students"
                                        value={editingQuestion.starter_code || ''}
                                        onChange={(e) => setEditingQuestion({ ...editingQuestion, starter_code: e.target.value })}
                                        className="w-full p-3 border rounded-md h-48 font-mono text-sm focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Test Configuration */}
                        <div className="mt-6">
                            {sandpackLanguages.includes(editingQuestion.language?.toLowerCase() || '') ? (
                                // Sandpack Test Configuration
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">Sandpack Test Configuration</h3>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Test Code (Jest/Testing Library)</label>
                                        <textarea
                                            placeholder="Enter test code using Jest and appropriate testing libraries"
                                            value={editingQuestion.test_code || ''}
                                            onChange={(e) => setEditingQuestion({ ...editingQuestion, test_code: e.target.value })}
                                            className="w-full p-3 border rounded-md h-64 font-mono text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Expected Behavior (Optional)</label>
                                        <textarea
                                            placeholder="Describe what the component/function should do or how it should behave"
                                            value={editingQuestion.expected_output || ''}
                                            onChange={(e) => setEditingQuestion({ ...editingQuestion, expected_output: e.target.value })}
                                            className="w-full p-3 border rounded-md h-24 focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            ) : (
                                // Judge0 Test Configuration
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-semibold text-lg">Judge0 Test Cases</h3>
                                        <button 
                                            onClick={addDefaultTestCase}
                                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                                        >
                                            Add Test Case
                                        </button>
                                    </div>
                                    
                                    <div className="bg-blue-50 p-4 rounded-md">
                                        <h4 className="font-medium text-blue-900 mb-2">📝 Test Case Guidelines:</h4>
                                        <ul className="text-sm text-blue-800 space-y-1">
                                            <li>• <strong>Input:</strong> The stdin input for your program</li>
                                            <li>• <strong>Expected Output:</strong> Exact output your program should produce</li>
                                            <li>• Your starter code should read from stdin and print to stdout</li>
                                            <li>• Test cases will be run automatically when students submit</li>
                                        </ul>
                                    </div>

                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {editingQuestion.test_cases?.map((tc, index) => (
                                            <div key={index} className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border rounded-md bg-gray-50">
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">
                                                        Test Case {index + 1} - Input:
                                                    </label>
                                                    <textarea
                                                        placeholder="Enter the input for this test case"
                                                        value={tc.input || ''}
                                                        onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                                                        className="w-full p-2 border rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500"
                                                        rows={3}
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="block text-sm font-medium">
                                                            Expected Output:
                                                        </label>
                                                        <button 
                                                            onClick={() => removeTestCase(index)}
                                                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        placeholder="Enter the expected output for this test case"
                                                        value={tc.expected_output || ''}
                                                        onChange={(e) => updateTestCase(index, 'expected_output', e.target.value)}
                                                        className="w-full p-2 border rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500"
                                                        rows={3}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {(!editingQuestion.test_cases || editingQuestion.test_cases.length === 0) && (
                                        <div className="text-center py-8 text-gray-500">
                                            No test cases added yet. Click "Add Test Case" to get started.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-3 mt-8 pt-4 border-t">
                            <button 
                                onClick={() => setEditingQuestion(null)}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveQuestion}
                                disabled={!editingQuestion.title || !editingQuestion.language}
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Save Question
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTests;
