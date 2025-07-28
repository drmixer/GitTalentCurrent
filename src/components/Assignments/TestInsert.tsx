import React from 'react';
import { supabase } from '../../lib/supabase';

const TestInsert: React.FC = () => {
    const handleInsert = async () => {
        const { error } = await supabase.from('coding_questions').insert({
            test_id: '8a8e8e8e-8e8e-8e8e-8e8e-8e8e8e8e8e8e', // Replace with a valid test_id
            title: 'Test Question',
            question_text: 'This is a test question.',
            language: 'python',
        });

        if (error) {
            console.error('Error inserting question:', error);
        } else {
            console.log('Question inserted successfully!');
        }
    };

    return (
        <button onClick={handleInsert} className="px-4 py-2 bg-red-600 text-white rounded-md">
            Test Insert
        </button>
    );
};

export default TestInsert;
