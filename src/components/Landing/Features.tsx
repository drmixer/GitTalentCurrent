import React from 'react';
import { Brain, Code, Sparkles, CheckCircle, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

const benefits = [
  {
    icon: CheckCircle,
    title: 'AI Matching Based on Real Work',
    description: 'We analyze real GitHub contributions, not resumes, to match you with developers who have proven their skills in public. No fluff, just signal.',
  },
  {
    icon: Code,
    title: 'Profiles That Actually Mean Something',
    description: 'Get visibility into how candidates code, contribute, and collaborate beyond job titles or buzzwords.',
  },
  {
    icon: Award,
    title: 'Free While We Grow',
    description: 'No subscriptions. No upfront costs. During Early Access, recruiters pay nothing to post or hire. Devs are free forever.',
  },
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
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {benefits.map((benefit, index) => (
              <div key={benefit.title} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <benefit.icon className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-xl font-black text-gray-900 mb-3">{benefit.title}</h4>
                <p className="text-gray-600 leading-relaxed font-medium">{benefit.description}</p>
              </div>
            ))}
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
