import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Github, Play } from 'lucide-react';

export const Hero = () => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-center min-h-[80vh] py-16 lg:py-24">
          {/* Left Side - Hero Content */}
          <div className="lg:col-span-12 text-center">
            <div className="max-w-4xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/50 mb-10 shadow-sm">
                <Github className="w-4 h-4 mr-2" />
                GitHub-powered talent matching
                <div className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>

              {/* Main Headings */}
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-600 mb-6">
                Connecting Devs & Recruiters
              </h2>
              
              <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-gray-900 leading-none mb-10">
                One <span className="relative inline-block mx-1">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 font-black">
                    Commit
                  </span>
                  <div className="absolute -bottom-2 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full"></div>
                </span> At A Time
              </h1>

              {/* Subtitle */}
              <p className="text-xl lg:text-2xl text-gray-600 mb-8 leading-relaxed font-medium max-w-3xl mx-auto">
                We match developers based on <span className="text-gray-900 font-semibold">real GitHub work</span> — not resumes.
              </p>
              <p className="text-lg text-gray-500 mb-12">
                Quality connections. Proven results. Zero upfront costs.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-16 justify-center">
                <Link
                  to="/signup"
                  className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-2xl text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  Start Hiring Today
                  <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-2xl text-gray-700 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all duration-300">
                  <Play className="mr-3 w-5 h-5 text-blue-600" />
                  Watch Demo
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-gray-200 max-w-2xl mx-auto">
                <div className="text-center">
                  <div className="text-3xl font-black text-gray-900 mb-1">2.5K+</div>
                  <div className="text-sm font-medium text-gray-600">Active Developers</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-gray-900 mb-1">450+</div>
                  <div className="text-sm font-medium text-gray-600">Companies</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-gray-900 mb-1">98%</div>
                  <div className="text-sm font-medium text-gray-600">Success Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};