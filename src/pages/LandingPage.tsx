import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Hero } from '../components/Landing/Hero';
import { Features } from '../components/Landing/Features';
import { HowItWorks } from '../components/Landing/HowItWorks';
import { About } from '../components/Landing/About';
import { FAQ } from '../components/Landing/FAQ';
import { Contact } from '../components/Landing/Contact';
import { AnimatedSection } from '../components/Landing/AnimatedSection';

export const LandingPage = () => {
  return (
    <div>
      <Helmet>
        <title>GitTalent | The All-in-One Platform for Hiring Developers</title>
        <meta name="description" content="Hire top software developers or find your next tech role with GitTalent. Post jobs, search talent, send coding tests, and hire faster — all in one platform." />
      </Helmet>
      <Hero />
      <AnimatedSection>
        <Features />
      </AnimatedSection>
      <AnimatedSection>
        <HowItWorks />
      </AnimatedSection>
      <AnimatedSection>
        <About />
      </AnimatedSection>
      <AnimatedSection>
        <FAQ />
      </AnimatedSection>
      <AnimatedSection>
        <Contact />
      </AnimatedSection>
    </div>
  );
};