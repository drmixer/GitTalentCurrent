import React from 'react';
import { Brain, Users, MessageSquare, TrendingUp, Shield, Zap, CheckCircle, Target, Code, Award, Search, DollarSign, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Matching',
    description: 'Our AI analyzes GitHub activity to match developers with the right opportunities.',
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200',
  },
  {
    icon: Search,
    title: 'Transparent Profiles',
    description: 'Browse developer profiles and job listings freely to find the perfect match.',
    color: 'from-purple-500 to-pink-600',
    bgColor: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-200',
  },
  {
    icon: MessageSquare,
    title: 'Direct Communication',
    description: 'Connect directly with developers and recruiters through our messaging system.',
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'from-emerald-50 to-teal-50',
    borderColor: 'border-emerald-200',
  },
  {
    icon: Shield,
    title: 'Verified GitHub Profiles',
    description: 'Ensure authenticity with profiles verified through GitHub.',
    color: 'from-cyan-500 to-blue-600',
    bgColor: 'from-cyan-50 to-blue-50',
    borderColor: 'border-cyan-200',
  },
  {
    icon: Zap,
    title: 'Self-Directed Search',
    description: 'Take control of your search with powerful filtering and search tools.',
    color: 'from-yellow-500 to-orange-600',
    bgColor: 'from-yellow-50 to-orange-50',
    borderColor: 'border-yellow-200',
  },
  {
    icon: Award,
    title: 'Free During Launch',
    description: 'Enjoy all features for free during our early access period.',
    color: 'from-red-500 to-pink-600',
    bgColor: 'from-red-50 to-pink-50',
    borderColor: 'border-red-200',
  },
];

const benefits = [
  {
    icon: CheckCircle,
    title: 'Hire Based on Skill',
    description: 'Our AI matches candidates based on demonstrated skills, not just resumes.',
  },
  {
    icon: Code,
    title: 'See the Real Work',
    description: 'View actual GitHub contributions to assess the quality of a developer\'s work.',
  },
  {
    icon: Sparkles,
    title: 'Free to Get Started',
    description: 'No monthly fees or hiring costs during our Early Access program.',
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
            Why GitTalent?
          </div>
          <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-tight">
            A Better Way to Hire
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              and Get Hired
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            GitTalent is a hiring platform built for engineers, by engineers.
            We connect talented developers with innovative companies.
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
            <h3 className="text-3xl font-black text-gray-900 mb-4">The GitTalent Advantage</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
             A hiring platform built for engineers — not just HR.
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