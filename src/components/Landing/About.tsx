import React from 'react';
import { Link } from 'react-router-dom';

export const About = () => {
  return (
    <div id="about" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Built by Developers, for Developers and Recruiters</h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-lg text-gray-600 mb-6">
              We started GitTalent because hiring devs should not be about buzzwords and resumes. It should be about work – real code, real projects, real proof.
            </p>
            <p className="text-lg text-gray-600 mb-8">
              We believe developers deserve to be discovered for what they actually do, not how they talk about it. And recruiters deserve better tools to surface great talent faster.
            </p>
            <p className="text-lg text-gray-600 mb-8">
              GitTalent connects both sides through a transparent, AI-assisted hiring experience built on GitHub activity, not fluff.
            </p>
            <p className="text-lg text-gray-600">
              We are just getting started. Join us while we grow and help shape the future of developer hiring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};