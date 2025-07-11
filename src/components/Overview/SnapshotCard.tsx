import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SnapshotCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  bgColor?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const SnapshotCard: React.FC<SnapshotCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = "text-blue-600",
  bgColor = "bg-blue-50",
  action,
}) => {
  return (
    <div className={`shadow rounded-lg p-5 border border-gray-200 flex flex-col justify-between bg-white hover:shadow-md transition-shadow duration-200`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-full ${bgColor}`}>
          <Icon size={24} className={iconColor} />
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
};
