import React from 'react';
import { Users, Target, Award, Zap, Brain, Search, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export const About = () => {
  return (
    <div id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">About GitTalent</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            We're revolutionizing tech hiring with AI-powered matching based on real GitHub contributions.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <h3 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h3>
            <p className="text-lg text-gray-600 mb-6">
              Traditional job boards rely on keywords and resumes. We believe in showcasing real talent 
              through actual GitHub contributions, project involvement, and coding activity.
            </p>
            <p className="text-lg text-gray-600 mb-8">
              By using AI to match recruiters with developers based on their actual work and skills, 
              we create meaningful connections that benefit both parties.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">AI-Powered</h4>
                <p className="text-sm text-gray-600">Matching based on real GitHub data and coding patterns</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Open Access</h4>
                <p className="text-sm text-gray-600">Browse all profiles and jobs without restrictions</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-orange-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Self-Managed</h4>
                <p className="text-sm text-gray-600">Control your own experience without waiting for approvals</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Free to Use</h4>
                <p className="text-sm text-gray-600">Free for developers forever, and free for recruiters during our launch phase.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-12 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Transform Your Hiring?</h3>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Join developers and companies who have already discovered
            a better way to connect talent with opportunity.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup?role=recruiter" className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
              Start Hiring Today
            </Link>
            <Link to="/signup?role=developer" className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold">
              Join as Developer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};