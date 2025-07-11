import React from 'react';
import { PortfolioItem } from '../../types';
import { ExternalLink, Image as ImageIcon, Zap } from 'lucide-react';

interface FeaturedProjectProps {
  project: PortfolioItem | null | undefined;
}

export const FeaturedProject: React.FC<FeaturedProjectProps> = ({ project }) => {
  if (!project) {
    return (
      <div className="bg-white shadow rounded-lg p-6 border border-gray-200 text-center">
        <Zap size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-1">No Featured Project</h3>
        <p className="text-sm text-gray-500">You can select a project to feature from your portfolio.</p>
        {/* TODO: Add a button/link to navigate to portfolio to feature a project */}
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">Featured Project</h3>
      </div>
      {project.image_url ? (
        <img src={project.image_url} alt={project.title} className="w-full h-48 object-cover" />
      ) : (
        <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
          <ImageIcon size={48} className="text-gray-400" />
        </div>
      )}
      <div className="p-6">
        <h4 className="text-lg font-semibold text-gray-700">{project.title}</h4>
        <p className="text-sm text-gray-500 mt-1 mb-3 line-clamp-3">{project.description || "No description available."}</p>

        {project.technologies && project.technologies.length > 0 && (
          <div className="mb-3">
            <h5 className="text-xs font-semibold text-gray-500 mb-1">Tech Stack:</h5>
            <div className="flex flex-wrap gap-1">
              {project.technologies.map((tech, index) => (
                <span key={index} className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {project.url && (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            View Project <ExternalLink size={14} className="ml-1" />
          </a>
        )}
      </div>
    </div>
  );
};
