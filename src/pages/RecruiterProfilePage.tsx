import React from 'react';
import { useParams } from 'react-router-dom';
import RecruiterProfile from '../components/Profile/RecruiterProfile';

const RecruiterProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Recruiter not found.</div>;
  }

  return (
    <div>
      <RecruiterProfile recruiterId={id} />
    </div>
  );
};

export default RecruiterProfilePage;
