import React from 'react';
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