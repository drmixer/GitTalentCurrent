import React from 'react';
import { Github, Briefcase, Bot, MessageSquare, Repeat } from 'lucide-react';

const steps = [
  {
    icon: Github,
    title: 'Developers Join with GitHub',
  },
  {
    icon: Briefcase,
    title: 'Recruiters Post Open Roles',
  },
  {
    icon: Bot,
    title: 'AI-Powered Matching Begins',
  },
  {
    icon: MessageSquare,
    title: 'Chat, Hire, Repeat – Free During Early Access',
  },
];

export const HowItWorks = () => {
  return (
    <div id="how-it-works" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-tight font-heading">
            How It Works
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <step.icon className="w-12 h-12 text-white" />
              </div>
              <h4 className="text-xl font-black text-gray-900 font-heading">{step.title}</h4>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
