import React from 'react';
import { Hero } from '../components/Landing/Hero';
import { WhyGitTalent } from '../components/Landing/WhyGitTalent';
import { HowItWorks } from '../components/Landing/HowItWorks';
import { About } from '../components/Landing/About';
import { FAQ } from '../components/Landing/FAQ';
import { Contact } from '../components/Landing/Contact';

export const LandingPage = () => {
  return (
    <div>
      <Hero />
      <HowItWorks />
      <WhyGitTalent />
      <About />
      <FAQ />
      <Contact />
    </div>
  );
};