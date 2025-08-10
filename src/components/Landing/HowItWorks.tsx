import React from 'react';

const steps = [
  {
    illustration: 'https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/public/illustrations/undraw_github-profile_abde%20(1).svg',
    title: 'Developers Join with GitHub',
  },
  {
    illustration: 'https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/public/illustrations/undraw_live-collaboration_i8an.svg',
    title: 'Recruiters Post Open Roles',
  },
  {
    illustration: 'https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/public/illustrations/undraw_avatars_xsfb.svg',
    title: 'AI-Powered Matching Begins',
  },
  {
    illustration: 'https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/public/illustrations/undraw_ship-it_vn4g.svg',
    title: 'Chat, Hire, Repeat – Free During Early Access',
  },
];

export const HowItWorks = () => {
  return (
    <div id="how-it-works" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-tight">
            How It Works
          </h2>
        </div>

        <div className="space-y-16">
          {steps.map((step, index) => (
            <div key={index} className={`flex items-center gap-16 ${index % 2 !== 0 ? 'flex-row-reverse' : ''}`}>
              <div className="w-1/2">
                <img src={step.illustration} alt={`${step.title} illustration`} className="w-full" />
              </div>
              <div className="w-1/2">
                <div className="text-2xl font-bold text-blue-600 mb-4">Step {index + 1}</div>
                <h3 className="text-4xl font-black text-gray-900">{step.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
