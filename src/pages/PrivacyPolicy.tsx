import React from 'react';
import { Helmet } from 'react-helmet-async';

export const PrivacyPolicy = () => {
  return (
    <div>
      <Helmet>
        <title>Privacy Policy | GitTalent</title>
      </Helmet>
      <div className="bg-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-extrabold text-gray-900">Privacy Policy</h1>
          <div className="mt-6 prose prose-lg text-gray-500">
            <p>
              This is the privacy policy for GitTalent. We are committed to protecting your privacy. This policy outlines how we collect, use, and protect your personal information.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">Information We Collect</h2>
            <p>
              We may collect personal information from you such as your name, email address, and other contact details when you register on our site, subscribe to our newsletter, or fill out a form.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">How We Use Your Information</h2>
            <p>
              We use the information we collect to personalize your experience, improve our website, and send periodic emails.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">How We Protect Your Information</h2>
            <p>
              We implement a variety of security measures to maintain the safety of your personal information. Your personal information is contained behind secured networks and is only accessible by a limited number of persons who have special access rights to such systems, and are required to keep the information confidential.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">Contact Us</h2>
            <p>
              If you have any questions about this privacy policy, please contact us.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
