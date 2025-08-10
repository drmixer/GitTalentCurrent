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
          <div className="space-y-6 text-lg text-gray-600">
            <p>
              We started GitTalent because hiring developers should be about proven work — real code, real projects, and real results.
            </p>
            <p>
              We believe developers should be recognized for what they build, not just what’s on a résumé. And recruiters deserve better tools to find great talent quickly and confidently.
            </p>
            <p>
              GitTalent connects both sides through a transparent hiring experience built on genuine developer contributions and meaningful opportunities.
            </p>
            <p>
              We’re just getting started. Join us as we grow and help shape the future of developer hiring.
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