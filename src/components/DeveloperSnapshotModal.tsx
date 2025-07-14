import React from 'react';
import { Developer } from '../types';
import { X } from 'lucide-react';
import DeveloperSnapshotCard from './DeveloperSnapshotCard';

interface DeveloperSnapshotModalProps {
  developer: Developer;
  onClose: () => void;
  onViewProfile: (developer: Developer) => void;
}

export const DeveloperSnapshotModal: React.FC<DeveloperSnapshotModalProps> = ({ developer, onClose, onViewProfile }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Developer Snapshot</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
        </div>
        <div className="p-6">
          <DeveloperSnapshotCard developer={developer} onViewProfile={onViewProfile} />
        </div>
      </div>
    </div>
  );
};
