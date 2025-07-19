import React from 'react';
import { useParams } from 'react-router-dom';
import CompanyProfile from '../components/Profile/CompanyProfile';

const CompanyProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Company not found.</div>;
  }

  return (
    <div>
      <CompanyProfile companyId={id} />
    </div>
  );
};

export default CompanyProfilePage;
