import React from 'react';
import { Check, ArrowRight, Star, Zap, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Pricing = () => {
  return (
    <div id="pricing" className="py-24 bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-emerald-50 to-blue-50 text-emerald-700 border border-emerald-200 mb-6">
            <Star className="w-4 h-4 mr-2" />
            Simple Pricing
          </div>
          <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-tight">
            Only Pay When You
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">
              Successfully Hire
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            No hidden fees, no monthly subscriptions, no setup costs. 
            Invest in results, not promises.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto mb-20">
          {/* Developers */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 overflow-hidden hover:shadow-2xl transition-all duration-500">
            <div className="p-10">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 mb-3">For Developers</h3>
                <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                  Showcase your GitHub work and get matched with dream opportunities
                </p>
                <div className="mb-8">
                  <span className="text-6xl font-black text-gray-900">Free</span>
                  <span className="text-gray-600 ml-3 text-xl font-medium">forever</span>
                </div>
                <Link
                  to="/signup"
                  className="w-full inline-flex items-center justify-center px-8 py-4 border-2 border-blue-600 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-all duration-300 hover:scale-105"
                >
                  Join as Developer
                  <ArrowRight className="ml-3 w-5 h-5" />
                </Link>
              </div>

              <div className="space-y-6">
                <h4 className="font-black text-gray-900 text-sm uppercase tracking-wider">Everything Included</h4>
                <ul className="space-y-4">
                  {[
                    'GitHub integration & real-time sync',
                    'Unlimited profile updates',
                    'Direct messaging with recruiters',
                    'Job opportunity notifications',
                    'Assignment status tracking',
                    'Priority support & guidance',
                    'Portfolio showcase tools',
                    'Skills verification badges'
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start space-x-4">
                      <div className="w-6 h-6 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Recruiters */}
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-blue-500 overflow-hidden relative hover:shadow-3xl transition-all duration-500">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <span className="inline-flex px-6 py-2 rounded-full text-sm font-black tracking-wide uppercase bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl">
                <Star className="w-4 h-4 mr-2" />
                Most Popular
              </span>
            </div>
            
            <div className="p-10">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <Zap className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 mb-3">For Recruiters</h3>
                <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                  Access top-tier developers and pay only for successful hires
                </p>
                <div className="mb-3">
                  <span className="text-6xl font-black text-gray-900">15%</span>
                  <span className="text-gray-600 ml-3 text-xl font-medium">of first-year salary</span>
                </div>
                <p className="text-sm font-semibold text-emerald-600 mb-8 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
                  ✨ Only charged upon successful hire
                </p>
                <Link
                  to="/signup"
                  className="w-full inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-xl hover:shadow-2xl hover:scale-105 duration-300"
                >
                  Start Hiring Today
                  <ArrowRight className="ml-3 w-5 h-5" />
                </Link>
              </div>

              <div className="space-y-6">
                <h4 className="font-black text-gray-900 text-sm uppercase tracking-wider">Premium Features</h4>
                <ul className="space-y-4">
                  {[
                    'Access to curated developer pool',
                    'Unlimited job postings',
                    'CSV bulk job import',
                    'Advanced filtering & search',
                    'Direct messaging with matches',
                    'Hiring analytics & reporting',
                    'Dedicated account manager',
                    'Priority assignment queue'
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start space-x-4">
                      <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-200">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-black text-gray-900 mb-4">How Our Pricing Works</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Simple, transparent, and aligned with your success. No surprises, no hidden costs.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                step: '1',
                title: 'Post Jobs Free',
                description: 'Create unlimited job postings and get matched with qualified developers at zero cost.',
                color: 'from-blue-500 to-indigo-600',
              },
              {
                step: '2',
                title: 'Interview & Hire',
                description: 'Connect with assigned developers, conduct interviews, and make your hiring decisions.',
                color: 'from-purple-500 to-pink-600',
              },
              {
                step: '3',
                title: 'Pay on Success',
                description: 'Pay 15% of first-year salary only when you successfully hire a developer.',
                color: 'from-emerald-500 to-teal-600',
              },
            ].map((step, index) => (
              <div key={step.step} className="text-center">
                <div className={`w-16 h-16 bg-gradient-to-r ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                  <span className="text-2xl font-black text-white">{step.step}</span>
                </div>
                <h4 className="text-xl font-black text-gray-900 mb-3">{step.title}</h4>
                <p className="text-gray-600 leading-relaxed font-medium">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl p-8 border border-gray-200">
            <h4 className="font-black text-gray-900 mb-6 text-center text-xl">Example Investment</h4>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              {[
                { role: 'Junior Developer', salary: '$75k', fee: '$11,250' },
                { role: 'Senior Developer', salary: '$130k', fee: '$19,500' },
                { role: 'Lead Engineer', salary: '$180k', fee: '$27,000' },
              ].map((example, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="text-lg font-black text-gray-900 mb-2">{example.role}</div>
                  <div className="text-sm text-gray-600 mb-1">{example.salary}/year</div>
                  <div className="text-xl font-black text-blue-600">{example.fee} fee</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-6 text-center">
              * Fees are only charged after successful hire and are based on the actual first-year salary.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};