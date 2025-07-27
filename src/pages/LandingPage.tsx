import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Hero } from '../components/Landing/Hero';
import { Features } from '../components/Landing/Features';
import { HowItWorks } from '../components/Landing/HowItWorks';
import { About } from '../components/Landing/About';
import { FAQ } from '../components/Landing/FAQ';
import { Contact } from '../components/Landing/Contact';

export const LandingPage = () => {
  return (
    <div>
      <Helmet>
        <title>GitTalent – Connecting Devs and Recruiters</title>
        <meta name="description" content="GitTalent connects developers and recruiters through a transparent, AI-assisted hiring experience built on GitHub activity, not fluff." />
      </Helmet>
      <Hero />
      <Features />
      <HowItWorks />
      <About />
      <FAQ />
      <Contact />
    </div>
  );
};