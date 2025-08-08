import React from 'react';
import { Link } from 'react-router-dom';
import { GitBranch } from 'lucide-react';

export const About = () => {
  return (
    <div id="about" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 font-heading">About GitTalent</h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-lg text-gray-600 mb-6 font-sans">
              We started GitTalent because hiring devs should not be about buzzwords and resumes. It should be about work – real code, real projects, real proof.
            </p>
            <p className="text-lg text-gray-600 mb-8 font-sans">
              We believe developers deserve to be discovered for what they actually do, not how they talk about it. And recruiters deserve better tools to surface great talent faster.
            </p>
            <p className="text-lg text-gray-600 mb-8 font-sans">
              GitTalent connects both sides through a transparent, AI-assisted hiring experience built on GitHub activity, not fluff.
            </p>
            <p className="text-lg text-gray-600 font-sans">
              We are just getting started. Join us while we grow and help shape the future of developer hiring.
            </p>
          </div>
          <div className="flex justify-center">
            <svg width="256" height="256" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{stopColor: '#4F46E5', stopOpacity: 1}} />
                  <stop offset="100%" style={{stopColor: '#A855F7', stopOpacity: 1}} />
                </linearGradient>
              </defs>
              <path d="M6 3v12" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 15l12-6" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};