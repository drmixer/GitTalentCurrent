import React from 'react';
import { Github, Users, MessageSquare, TrendingUp, Shield, Zap, CheckCircle, Target, Code, Award } from 'lucide-react';

const features = [
  {
    icon: Github,
    title: 'GitHub-First Matching',
    description: 'Analyze real contributions, code quality, and project involvement—not just keywords on resumes.',
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200',
  },
  {
    icon: Target,
    title: 'Precision Assignments',
    description: 'Our experts assign developers to specific roles based on technical fit and project requirements.',
    color: 'from-purple-500 to-pink-600',
    bgColor: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-200',
  },
  {
    icon: MessageSquare,
    title: 'Contextual Messaging',
    description: 'Built-in communication tools with job-specific context and conversation history.',
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'from-emerald-50 to-teal-50',
    borderColor: 'border-emerald-200',
  },
  {
    icon: TrendingUp,
    title: 'Advanced Analytics',
    description: 'Track hiring success rates, developer engagement, and ROI with detailed performance metrics.',
    color: 'from-orange-500 to-red-600',
    bgColor: 'from-orange-50 to-red-50',
    borderColor: 'border-orange-200',
  },
  {
    icon: Shield,
    title: 'Verified Profiles',
    description: 'Every developer profile is authenticated through GitHub integration with real-time updates.',
    color: 'from-cyan-500 to-blue-600',
    bgColor: 'from-cyan-50 to-blue-50',
    borderColor: 'border-cyan-200',
  },
  {
    icon: Zap,
    title: 'Instant Notifications',
    description: 'Real-time alerts for new assignments, messages, and hiring opportunities across all devices.',
    color: 'from-yellow-500 to-orange-600',
    bgColor: 'from-yellow-50 to-orange-50',
    borderColor: 'border-yellow-200',
  },
];

const benefits = [
  {
    icon: CheckCircle,
    title: '3x Faster Hiring',
    description: 'Reduce time-to-hire from months to weeks with pre-qualified matches.',
  },
  {
    icon: Code,
    title: '95% Match Accuracy',
    description: 'Our GitHub analysis ensures technical compatibility before first contact.',
  },
  {
    icon: Award,
    title: 'Zero Risk Investment',
    description: 'Pay only when you successfully hire. No upfront costs or subscriptions.',
  },
];

export const Features = () => {
  return (
    <div id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 mb-6">
            <Zap className="w-4 h-4 mr-2" />
            Powerful Features
          </div>
          <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-tight">
            Everything you need to
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              connect talent
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Our platform provides enterprise-grade tools to create meaningful connections 
            between world-class developers and forward-thinking companies.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <div key={feature.title} className="group relative">
              <div className={`bg-gradient-to-br ${feature.bgColor} p-8 rounded-3xl border ${feature.borderColor} hover:shadow-2xl hover:scale-105 transition-all duration-500 h-full`}>
                <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed font-medium">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-3xl p-12 border border-gray-200">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-black text-gray-900 mb-4">Why Companies Choose GitTalent</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Join hundreds of companies who have transformed their hiring process with data-driven matching.
            </p>
          </div>
          
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
              <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 duration-300">
                Start Free Trial
              </button>
              <button className="px-8 py-4 border-2 border-gray-300 text-gray-700 font-bold rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-300">
                Schedule Demo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};