import React from 'react';
import { Hero } from '../components/Landing/Hero';
import { Features } from '../components/Landing/Features';
import { About } from '../components/Landing/About';
import { FAQ } from '../components/Landing/FAQ';
import { Contact } from '../components/Landing/Contact';

export const LandingPage = () => {
  return (
    <div>
      <Hero />
      <Features />
      <About />
      <FAQ />
      <Contact />
    </div>
  );
};