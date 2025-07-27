import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Github, Play, Star, GitFork, Eye } from 'lucide-react';

export const Hero = () => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-center min-h-[90vh] py-16 lg:py-24">
          {/* Left Side - Hero Content */}
          <div className="lg:col-span-7">
            <div className="max-w-3xl">
              {/* Badge */}
              <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/50 mb-10 shadow-sm">
                <Github className="w-4 h-4 mr-2" />
                GitHub-powered talent matching
                <div className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>

              {/* Main Headings */}
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-600 mb-6">
                Connecting Devs & Recruiters
              </h2>
              
              <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-gray-900 leading-none mb-8">
                One <span className="relative inline-block mx-1">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 font-black">
                    Commit
                  </span>
                  <div className="absolute -bottom-2 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full"></div>
                </span> At A Time
              </h1>

              {/* Subtitle */}
              <p className="text-xl lg:text-2xl text-gray-600 mb-8 leading-relaxed font-medium">
                We match developers based on <span className="text-gray-900 font-semibold">real GitHub work</span> — not resumes.
              </p>
              <p className="text-lg text-gray-500 mb-12">
                Quality connections. Proven results. Zero upfront costs.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-16">
                <Link
                  to="/signup"
                  className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-2xl text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  Start Hiring Today
                  <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/signup?role=developer"
                  className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-2xl text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-600 hover:via-teal-600 hover:to-sky-600 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  Devs - Start Now
                  <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
          
          {/* Right Side - GitHub Activity Card */}
          <div className="lg:col-span-5 mt-16 lg:mt-0">
            <div className="max-w-lg mx-auto lg:max-w-none">
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden transform hover:scale-105 transition-all duration-500">
                {/* Profile Header */}
                <div className="bg-gradient-to-r from-gray-50 to-slate-100 px-8 py-6 border-b border-gray-100">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="w-16 h-16 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <Github className="w-8 h-8 text-white" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-white flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-black text-gray-900">sarah_codes</h3>
                      <p className="text-sm font-medium text-gray-600">Senior Full-Stack Engineer</p>
                      <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                        <div className="flex items-center">
                          <Eye className="w-3 h-3 mr-1" />
                          <span className="font-medium">2.1k followers</span>
                        </div>
                        <div className="flex items-center">
                          <GitFork className="w-3 h-3 mr-1" />
                          <span className="font-medium">156 following</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
                        Available
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contribution Activity */}
                <div className="px-8 py-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-bold text-gray-900">Contribution Activity</h4>
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">Last 12 months</span>
                  </div>
                  
                  {/* Contribution Graph */}
                  <div className="mb-6">
                    <div className="grid grid-cols-12 gap-1 mb-3">
                      {Array.from({ length: 84 }, (_, i) => {
                        const intensity = Math.random();
                        let bgColor = 'bg-gray-100';
                        if (intensity > 0.8) bgColor = 'bg-emerald-600';
                        else if (intensity > 0.6) bgColor = 'bg-emerald-500';
                        else if (intensity > 0.4) bgColor = 'bg-emerald-400';
                        else if (intensity > 0.2) bgColor = 'bg-emerald-300';
                        else if (intensity > 0.1) bgColor = 'bg-emerald-200';
                        
                        return (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-sm ${bgColor} hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all duration-200 hover:scale-110`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-medium">Less</span>
                      <div className="flex items-center space-x-1">
                        <div className="w-2.5 h-2.5 bg-gray-100 rounded-sm"></div>
                        <div className="w-2.5 h-2.5 bg-emerald-200 rounded-sm"></div>
                        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-sm"></div>
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div>
                        <div className="w-2.5 h-2.5 bg-emerald-600 rounded-sm"></div>
                      </div>
                      <span className="font-medium">More</span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-6 mb-6 text-center">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                      <div className="text-2xl font-black text-gray-900">127</div>
                      <div className="text-xs font-semibold text-gray-600">Repositories</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
                      <div className="text-2xl font-black text-gray-900">3.2k</div>
                      <div className="text-xs font-semibold text-gray-600">Contributions</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-4 border border-yellow-100">
                      <div className="flex items-center justify-center mb-1">
                        <Star className="w-4 h-4 text-yellow-500 mr-1" />
                        <div className="text-2xl font-black text-gray-900">892</div>
                      </div>
                      <div className="text-xs font-semibold text-gray-600">Stars Earned</div>
                    </div>
                  </div>

                  {/* Language Stats */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-4">Top Languages</h4>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                        <span className="text-gray-700 flex-1 font-medium">TypeScript</span>
                        <span className="text-gray-900 font-bold">42%</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                        <span className="text-gray-700 flex-1 font-medium">JavaScript</span>
                        <span className="text-gray-900 font-bold">31%</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-gray-700 flex-1 font-medium">Python</span>
                        <span className="text-gray-900 font-bold">18%</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                        <span className="text-gray-700 flex-1 font-medium">Go</span>
                        <span className="text-gray-900 font-bold">9%</span>
                      </div>
                    </div>
                    
                    {/* Language Progress Bar */}
                    <div className="flex mt-4 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                      <div className="bg-blue-500" style={{ width: '42%' }}></div>
                      <div className="bg-yellow-500" style={{ width: '31%' }}></div>
                      <div className="bg-green-500" style={{ width: '18%' }}></div>
                      <div className="bg-purple-500" style={{ width: '9%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};