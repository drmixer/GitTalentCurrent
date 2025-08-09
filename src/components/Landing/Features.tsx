import React from 'react';
import { Link } from 'react-router-dom';

export const Features = () => {
  return (
    <div id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20">
          <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-tight">
            Designed for Developers.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Trusted by Recruiters.
            </span>
          </h2>
        </div>

        {/* Benefits Section */}
        <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-3xl p-12 border border-gray-200">
          <div className="flex justify-around items-center mb-12">
            <img src="https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/public/illustrations/undraw_dev-environment_n5by.svg" alt="Developer Environment Illustration" className="w-1/3" />
            <img src="https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/public/illustrations/undraw_portfolio-website_838t.svg" alt="Portfolio Website Illustration" className="w-1/3" />
          </div>

          <div className="text-center">
            <div className="inline-flex flex-col sm:flex-row gap-4">
              <Link to="/signup?role=recruiter" className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 duration-300">
                Start Hiring Today
              </Link>
              <Link to="/signup?role=developer" className="px-8 py-4 border-2 border-gray-300 text-gray-700 font-bold rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-300">
                Find Your Dream Job
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
