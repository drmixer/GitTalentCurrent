import React from 'react';
import { useParams } from 'react-router-dom';
import CompanyProfile from '../components/Profile/CompanyProfile';

const CompanyProfilePage: React.FC = () => {
  const { name } = useParams<{ name: string }>();

  if (!name) {
    return <div>Company not found.</div>;
  }

  return (
    <div>
      <CompanyProfile companyName={name} />
    </div>
  );
};

export default CompanyProfilePage;
