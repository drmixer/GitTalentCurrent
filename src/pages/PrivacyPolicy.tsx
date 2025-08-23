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
              GitTalent (“we,” “our,” or “us”) respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and share your information when you use our website and services.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">1. Information We Collect</h2>
            <p>
              When you use GitTalent, we may collect:
            </p>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, and authentication details from GitHub or email sign-up.</li>
              <li><strong>Profile Information:</strong> Developer or recruiter profiles, resumes, skills, job history, and preferences.</li>
              <li><strong>Job Applications:</strong> Information you provide when applying to jobs, including attachments.</li>
              <li><strong>Communications:</strong> Messages sent between recruiters and developers.</li>
              <li><strong>Technical Data:</strong> IP address, browser type, device information, and usage data through cookies and analytics tools.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">2. How We Use Your Information</h2>
            <p>
              We use your information to:
            </p>
            <ul>
              <li>Provide authentication and secure access to GitTalent.</li>
              <li>Create and display developer and recruiter profiles.</li>
              <li>Facilitate job applications and communication between developers and recruiters.</li>
              <li>Improve and personalize your experience.</li>
              <li>Monitor platform security and prevent fraud.</li>
              <li>Comply with legal obligations.</li>
            </ul>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">3. How We Share Your Information</h2>
            <p>
              We may share your information with:
            </p>
            <ul>
                <li><strong>Service Providers:</strong> Such as Supabase (authentication, database), hosting providers, analytics tools, and payment processors if applicable.</li>
                <li><strong>Recruiters and Developers:</strong> Profile and job-related information is shared between users as part of the platform’s core functionality.</li>
                <li><strong>Legal Compliance:</strong> If required by law or to protect the rights and safety of GitTalent and its users.</li>
            </ul>
            <p>We do not sell your personal data to third parties.</p>


            <h2 className="mt-8 text-2xl font-bold text-gray-900">4. Cookies &amp; Tracking</h2>
            <p>
              GitTalent uses local storage and may use cookies from third-party services (e.g., GitHub for OAuth login, analytics if enabled)
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">5. Data Security</h2>
            <p>
              We take reasonable technical and organizational measures to protect your data. However, no system is 100% secure, and we cannot guarantee absolute security.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">6. Your Rights</h2>
            <p>
              Depending on your location, you may have rights to:
            </p>
            <ul>
                <li>Access the information we hold about you.</li>
                <li>Request correction or deletion of your data.</li>
                <li>Withdraw consent where processing is based on consent.</li>
                <li>Export your data in a portable format.</li>
            </ul>
            <p>
              To exercise these rights, contact us at: <a href="mailto:support@mail.gittalent.dev" className="text-blue-600 hover:underline">support@mail.gittalent.dev</a>
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">7. Data Retention</h2>
            <p>
              We retain your information as long as your account is active or needed to provide services. You may request account deletion at any time.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">8. Children’s Privacy</h2>
            <p>
              GitTalent is not directed to individuals under 16. We do not knowingly collect data from children.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted here with an updated effective date.
            </p>

            <h2 className="mt-8 text-2xl font-bold text-gray-900">10. Contact Us</h2>
            <p>
              If you have questions or concerns, please contact us at:
              <br />
              GitTalent
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

export default PrivacyPolicy;
