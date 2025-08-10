import React from 'react';
import { Link } from 'react-router-dom';

export const About = () => {
  return (
    <div id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-4">About GitTalent</h2>
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
          <div className="flex justify-center">
            <img src="https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/public/illustrations/undraw_pair-programming_9jyg.svg" alt="Pair Programming Illustration" className="w-full max-w-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};