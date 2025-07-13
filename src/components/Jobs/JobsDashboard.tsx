import React from 'react';

const JobsDashboard: React.FC = () => {
  // Mock data for now
  const jobs = [
    { id: 1, title: 'Frontend Developer', status: 'Open', applicants: 25, lastUpdated: '2024-07-31' },
    { id: 2, title: 'Backend Developer', status: 'Closed', applicants: 15, lastUpdated: '2024-07-25' },
  ];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Jobs Dashboard</h1>
      <div className="grid grid-cols-1 gap-4">
        {jobs.map(job => (
          <div key={job.id} className="p-4 border rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold">{job.title}</h2>
            <p>Status: {job.status}</p>
            <p>Applicants: {job.applicants}</p>
            <p>Last Updated: {job.lastUpdated}</p>
            <div className="mt-4">
              <button className="mr-2 px-4 py-2 bg-blue-500 text-white rounded">Edit</button>
              <button className="mr-2 px-4 py-2 bg-green-500 text-white rounded">View Applicants</button>
              <button className="mr-2 px-4 py-2 bg-gray-500 text-white rounded">Duplicate</button>
              <button className="px-4 py-2 bg-indigo-500 text-white rounded">Share</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobsDashboard;
