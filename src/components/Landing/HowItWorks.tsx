import React from 'react';
import { User, Briefcase, Search, MessageSquare, CheckCircle } from 'lucide-react';

const developerSteps = [
  {
    icon: User,
    title: 'Create Your Profile',
    description: 'Sign up and connect your GitHub account to automatically build your developer profile.',
  },
  {
    icon: Search,
    title: 'Browse Opportunities',
    description: 'Explore job openings from top companies that match your skills and interests.',
  },
  {
    icon: MessageSquare,
    title: 'Connect with Recruiters',
    description: 'Get contacted by recruiters for relevant positions and start the conversation.',
  },
];

const recruiterSteps = [
  {
    icon: Briefcase,
    title: 'Post a Job',
    description: 'Create a job posting detailing your requirements and company culture.',
  },
  {
    icon: Search,
    title: 'Find Talent',
    description: 'Search our database of skilled developers and use our AI matching to find the perfect fit.',
  },
  {
    icon: CheckCircle,
    title: 'Hire with Confidence',
    description: 'Connect with candidates, interview, and hire the best talent for your team.',
  },
];

export const HowItWorks = () => {
  return (
    <div id="how-it-works" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-tight">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            A simple, transparent process for developers and recruiters.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16">
          <div>
            <h3 className="text-3xl font-bold text-center mb-10">For Developers</h3>
            <div className="space-y-12">
              {developerSteps.map((step, index) => (
                <div key={index} className="flex items-start space-x-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-gray-900 mb-2">{step.title}</h4>
                    <p className="text-gray-600 leading-relaxed font-medium">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-3xl font-bold text-center mb-10">For Recruiters</h3>
            <div className="space-y-12">
              {recruiterSteps.map((step, index) => (
                <div key={index} className="flex items-start space-x-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-gray-900 mb-2">{step.title}</h4>
                    <p className="text-gray-600 leading-relaxed font-medium">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
