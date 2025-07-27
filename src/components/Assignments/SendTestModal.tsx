import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CodingTest } from '../../types';
import { X, Send } from 'lucide-react';

interface SendTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    developerId: string;
    jobId: string;
    onTestSent: () => void;
}

const SendTestModal: React.FC<SendTestModalProps> = ({ isOpen, onClose, developerId, jobId, onTestSent }) => {
    const [tests, setTests] = useState<CodingTest[]>([]);
    const [selectedTest, setSelectedTest] = useState<string>('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchTests();
        }
    }, [isOpen]);

    const fetchTests = async () => {
        const { data, error } = await supabase.from('coding_tests').select('*');
        if (error) {
            console.error('Error fetching tests:', error);
            setError('Failed to load tests.');
        } else {
            setTests(data as CodingTest[]);
        }
    };

    const handleSendTest = async () => {
        if (!selectedTest) {
            setError('Please select a test to send.');
            return;
        }
        setIsSending(true);
        setError('');

        const { error: insertError } = await supabase.from('test_assignments').insert({
            developer_id: developerId,
            job_id: jobId,
            test_id: selectedTest,
            status: 'Pending',
        });

        if (insertError) {
            setError('Failed to send test: ' + insertError.message);
        } else {
            onTestSent();
            onClose();
        }
        setIsSending(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Send Coding Test</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
                        <X size={20} />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="test-select" className="block text-sm font-medium text-gray-700 mb-1">
                            Choose a test:
                        </label>
                        <select
                            id="test-select"
                            value={selectedTest}
                            onChange={(e) => setSelectedTest(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md"
                        >
                            <option value="" disabled>Select a test</option>
                            {tests.map((test) => (
                                <option key={test.id} value={test.id}>
                                    {test.title}
                                </option>
                            ))}
                        </select>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                        Cancel
                    </button>
                    <button
                        onClick={handleSendTest}
                        disabled={isSending || !selectedTest}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
                    >
                        {isSending ? 'Sending...' : <><Send size={16} className="mr-2" /> Send Test</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SendTestModal;
