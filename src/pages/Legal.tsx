import React from 'react';
import { Helmet } from 'react-helmet-async';

export const Legal = () => {
  return (
    <div>
      <Helmet>
        <title>Legal | GitTalent</title>
      </Helmet>
      <div className="bg-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-extrabold text-gray-900">GitTalent Legal</h1>
          <p className="mt-2 text-sm text-gray-500">Effective Date: August 23, 2025</p>
          <div className="mt-6 prose prose-lg text-gray-500">
            <p>
              Welcome to GitTalent! We care about your privacy and want you to understand how our site works. This page explains both our terms of service and how we handle your data in plain English.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">1. Who Can Use GitTalent</h2>
            <ul>
              <li>You must be at least 16 years old.</li>
              <li>Make sure the info you provide is real and accurate.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">2. Your Account</h2>
            <ul>
              <li>Keep your password and login info private.</li>
              <li>You’re responsible for everything that happens under your account.</li>
              <li>We may suspend or delete accounts that break these rules.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">3. Using GitTalent</h2>
            <p>You promise not to:</p>
            <ul>
              <li>Post fake or misleading info.</li>
              <li>Spam, harass, or harm other users.</li>
              <li>Break laws.</li>
              <li>Interfere with our site’s security or operations.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">4. What You Share</h2>
            <ul>
              <li>You own what you post (profiles, job listings, applications, messages, etc.).</li>
              <li>By posting it, you give GitTalent permission to show it on the site so our services work.</li>
              <li>Make sure your posts don’t violate anyone else’s rights.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">5. Job Postings &amp; Hiring</h2>
            <ul>
              <li>Recruiters should post accurate, lawful, and non-discriminatory jobs.</li>
              <li>We may remove posts that violate these rules.</li>
              <li>We don’t guarantee job matches, hires, or employment outcomes.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">6. Payments (if applicable)</h2>
            <ul>
              <li>If you pay for premium features, you agree to the fees at checkout.</li>
              <li>Payments go through secure third-party providers (e.g., Stripe).</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">7. Cookies &amp; Tracking</h2>
            <ul>
              <li>GitTalent uses local storage for login sessions.</li>
              <li>We may also use cookies or similar tech if we add analytics or other services in the future.</li>
              <li>Third-party services (like GitHub OAuth) may set their own cookies.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">8. Your Privacy &amp; Data</h2>
            <p>We collect only what’s necessary to provide our services, such as:</p>
            <ul>
              <li>Account info: Name, email, GitHub login.</li>
              <li>Profile info: Skills, experience, job history, preferences.</li>
              <li>Job applications &amp; messages.</li>
              <li>Technical data: IP, device type, browser, usage stats.</li>
            </ul>
            <p>We use this info to:</p>
            <ul>
              <li>Authenticate and secure your account.</li>
              <li>Display profiles and connect recruiters with developers.</li>
              <li>Improve and personalize the site.</li>
              <li>Monitor security and prevent fraud.</li>
            </ul>
            <p>We do not sell your data. We may share it only with:</p>
            <ul>
              <li>Service providers (Supabase, Stripe, analytics tools).</li>
              <li>Recruiters and developers, as needed to use the platform.</li>
              <li>Legal authorities if required.</li>
            </ul>
            <p>Your rights: You can access, correct, or delete your data, or request a copy of it. Contact us at <a href="mailto:support@mail.gittalent.dev" className="text-blue-600 hover:underline">support@mail.gittalent.dev</a>.</p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">9. Ending Accounts</h2>
            <ul>
              <li>We can suspend or delete accounts that break rules or for security reasons.</li>
              <li>You can delete your account anytime.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">10. Disclaimer</h2>
            <ul>
              <li>GitTalent is provided “as is.”</li>
              <li>We don’t guarantee results, job matches, or accuracy of content.</li>
              <li>Use the site at your own risk.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">11. Limitation of Liability</h2>
            <p>We aren’t responsible for indirect or unexpected damages.</p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">12. Changes to This Legal Page</h2>
            <ul>
              <li>We may update these terms or privacy practices occasionally.</li>
              <li>Updates will be posted here with a new date.</li>
              <li>Continuing to use GitTalent means you accept the new terms.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">13. Governing Law</h2>
            <p>These terms follow the laws of the United States.</p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">14. Contact</h2>
            <p>
              Questions? Reach out:
              <br />
              Email: <a href="mailto:support@mail.gittalent.dev" className="text-blue-600 hover:underline">support@mail.gittalent.dev</a>
              <br />
              Website: <a href="https://gittalent.dev" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://gittalent.dev</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Legal;
