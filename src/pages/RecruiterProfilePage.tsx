import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RecruiterProfile from '../components/Profile/RecruiterProfile';
import { ArrowLeft } from 'lucide-react';

const RecruiterProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return <div>Recruiter not found.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4">
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back
      </button>
      <RecruiterProfile recruiterId={id} />
    </div>
  );
};

export default RecruiterProfilePage;
