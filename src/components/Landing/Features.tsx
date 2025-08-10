import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const recruiterFeatures = [
  {
    title: 'Powerful Developer Search',
    description: 'Find top software engineers quickly using advanced filters and direct GitHub profile integration, so you see verified skills and real work samples.'
  },
  {
    title: 'Built-In Coding Tests',
    description: 'Streamline technical evaluations with integrated coding tests you can send directly through the platform — no third-party tools needed.'
  },
  {
    title: 'Seamless Job Posting & Applicant Tracking',
    description: 'Post open roles effortlessly, track candidate progress, and manage applications in one intuitive dashboard designed for recruiters.'
  }
];

const developerFeatures = [
  {
    title: 'Developer Portfolio & Applications',
    description: 'Developers can showcase their projects, skills, and GitHub contributions, making it easy to apply and stand out to employers.'
  },
  {
    title: 'Direct Messaging & Collaboration',
    description: 'Facilitate fast, transparent communication between recruiters and developers with built-in messaging — helping teams move from interest to hire faster.'
  },
  {
    title: 'Open Platform & Transparent Hiring',
    description: 'Built for transparency and ease, GitTalent connects recruiters and developers without gatekeepers, creating a fair, efficient tech hiring experience.'
  }
];

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
            <img src="https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/public/illustrations/undraw_dev-environment_n5by.svg" alt="Developer Environment Illustration" className="w-2/5" />
            <img src="https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/public/illustrations/undraw_portfolio-website_838t.svg" alt="Portfolio Website Illustration" className="w-2/5" />
          </div>

          <div className="text-center mt-16">
            <h3 className="text-4xl font-black text-gray-900 mb-12">Features</h3>
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 text-left">
              <div>
                <h4 className="text-2xl font-bold text-gray-800 mb-6 text-center">For Recruiters</h4>
                <ul className="space-y-6">
                  {recruiterFeatures.map(feature => (
                    <li key={feature.title} className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mr-4 mt-1 flex-shrink-0" />
                      <div>
                        <h5 className="font-bold text-lg text-gray-900">{feature.title}</h5>
                        <p className="text-gray-600">{feature.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-2xl font-bold text-gray-800 mb-6 text-center">For Developers</h4>
                <ul className="space-y-6">
                  {developerFeatures.map(feature => (
                    <li key={feature.title} className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-blue-500 mr-4 mt-1 flex-shrink-0" />
                      <div>
                        <h5 className="font-bold text-lg text-gray-900">{feature.title}</h5>
                        <p className="text-gray-600">{feature.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center mt-16">
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
