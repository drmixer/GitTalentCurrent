import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqs = [
  {
    question: "How does GitTalent's AI matching work?",
    answer: "Our AI analyzes GitHub activity, contribution patterns, project involvement, and technical skills to create meaningful matches. The system recommends developers to recruiters based on job requirements and technical compatibility, ensuring quality matches without manual intervention."
  },
  {
    question: "Is GitTalent free for developers?",
    answer: "Yes! GitTalent is completely free for developers, and always will be. You can create your profile, showcase your GitHub activity, browse job opportunities, and communicate with recruiters at no cost."
  },
  {
    question: "How much does GitTalent cost for recruiters?",
    answer: "During our launch phase, GitTalent is completely free for recruiters. There are no upfront costs, subscription fees, or hiring fees. Enjoy full access to our platform and hire top developers at no cost."
  },
  {
    question: "Can developers contact recruiters directly?",
    answer: "Developers can browse all job listings and view recruiter profiles. However, to prevent spam, developers can only message recruiters after the recruiter has initiated contact first."
  },
  {
    question: "How do I get approved as a recruiter?",
    answer: "After signing up, recruiter accounts require admin approval. We review your company information and verify your legitimacy before granting access to the platform. This typically takes 1-2 business days."
  },
  {
    question: "What information do you pull from GitHub?",
    answer: "We analyze public GitHub data including contribution activity, repository information, programming languages used, project involvement, and code quality metrics. We never access private repositories or sensitive information."
  },
  {
    question: "Can I import multiple job postings at once?",
    answer: "Yes! Recruiters can import job postings in bulk using our CSV import feature. This makes it easy to manage multiple positions and streamline your hiring process."
  },
  {
    question: "How do I express interest in a job as a developer?",
    answer: "Developers can browse all job listings and express interest in specific positions. This notifies the recruiter, who can then review your profile and initiate contact if they're interested."
  },
  {
    question: "Can I see all developers on the platform?",
    answer: "Yes! Unlike traditional platforms, GitTalent provides open access to all developer profiles. You can browse, search, and filter to find the perfect match for your job openings."
  }
];

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div id="faq" className="py-20 bg-gray-50 dark:bg-dark-card">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-dark-text mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Everything you need to know about GitTalent
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white dark:bg-dark-background rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden"
            >
              <button
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => toggleFAQ(index)}
              >
                <span className="text-lg font-semibold text-gray-900 dark:text-dark-text pr-4">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5">
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-4">Still have questions?</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Can't find the answer you're looking for? Please chat with our friendly team.
          </p>
          <Link to="/contact" className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
};

// Add missing import
import { Link } from 'react-router-dom';