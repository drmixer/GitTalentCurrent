import React from 'react';
import { Developer } from '../types';
import { X, Github, Briefcase, Mail, Phone, MapPin, Award, Code } from 'lucide-react';
import { GitHubUserActivityDetails } from './GitHub/GitHubUserActivityDetails';
import { useDeveloperProfile } from '@/hooks/useDeveloperProfile';

interface DeveloperProfileModalProps {
  developer: Developer;
  onClose: () => void;
}

export const DeveloperProfileModal: React.FC<DeveloperProfileModalProps> = ({ developer, onClose }) => {
  const { applications, loading, error } = useDeveloperProfile(developer.user_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">Developer Profile</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
        </div>
        <div className="p-6">
          <div className="flex items-start space-x-6">
            <img src={developer.user?.profile_pic_url || ''} alt={developer.user?.name || ''} className="w-24 h-24 rounded-full" />
            <div>
              <h3 className="text-xl font-bold">{developer.user?.name || 'Unnamed Developer'}</h3>
              <p className="text-gray-600">{developer.user?.headline}</p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                <a href={`https://github.com/${developer.github_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-blue-600"><Github size={16} className="mr-1" />{developer.github_handle}</a>
                {developer.user?.email && <span className="flex items-center"><Mail size={16} className="mr-1" />{developer.user.email}</span>}
                {developer.user?.location && <span className="flex items-center"><MapPin size={16} className="mr-1" />{developer.user.location}</span>}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-lg mb-2">Skills</h4>
              <div className="flex flex-wrap gap-2">
                {developer.skills?.map(skill => <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">{skill}</span>)}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-2">Experience</h4>
              {/* This would be built out with more structured data */}
              <p className="text-sm text-gray-600">{developer.experience_level}</p>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-bold text-lg mb-2">Application History</h4>
            <div className="space-y-2">
              {applications.map(app => (
                <div key={app.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{app.job_role.title}</p>
                    <p className="text-sm text-gray-500">Applied on {new Date(app.applied_at).toLocaleDateString()}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 capitalize">{app.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-bold text-lg mb-2">GitHub Activity</h4>
            <div className="border rounded-lg p-4">
              <GitHubUserActivityDetails username={developer.github_handle} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
