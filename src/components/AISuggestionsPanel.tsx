import React from 'react';

const AISuggestionsPanel: React.FC = () => {
    const suggestions = [
        "Follow up with John Doe (3 days no contact).",
        "Jane Smith seems like a good fit for 'Frontend Developer'. Consider moving her to 'Interviewing'.",
        "New candidate 'Peter Jones' has skills matching your 'Backend Developer' role."
    ];

    return (
        <div className="p-4 bg-gray-50 rounded-lg border">
            <h2 className="text-lg font-bold mb-2">AI Suggestions</h2>
            <ul className="list-disc pl-5 space-y-2">
                {suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm">{suggestion}</li>
                ))}
            </ul>
        </div>
    );
};

export default AISuggestionsPanel;
