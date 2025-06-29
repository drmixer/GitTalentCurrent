import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqs = [
  {
    question: "How does GitTalent match developers with recruiters?",
    answer: "We analyze GitHub activity, contribution patterns, project involvement, and technical skills to create meaningful matches. Our admin team then assigns developers to specific job roles based on this analysis, ensuring quality over quantity."
  },
  {
    question: "Is GitTalent free for developers?",
    answer: "Yes! GitTalent is completely free for developers. You can create your profile, showcase your GitHub activity, receive job assignments, and communicate with recruiters at no cost."
  },
  {
    question: "How does the payment system work for recruiters?",
    answer: "Recruiters only pay when they successfully hire a developer - 15% of the first-year salary. There are no upfront costs, subscription fees, or hidden charges. You only pay for results."
  },
  {
    question: "Can developers contact recruiters directly?",
    answer: "No, developers can only respond to recruiters who have been assigned to them by our admin team for specific job roles. This ensures all communications are relevant and targeted."
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
    question: "How do assignments work?",
    answer: "Our admin team reviews job requirements and developer profiles to make strategic assignments. Developers are assigned to specific job roles (not general recruiters), ensuring each match is purposeful and relevant."
  },
  {
    question: "What happens after a successful hire?",
    answer: "Once you hire a developer, you'll mark them as 'Hired' in the system and provide salary details. The 15% fee is calculated and invoiced based on the first-year salary you report."
  },
  {
    question: "Can I see all developers on the platform?",
    answer: "No, recruiters can only view and contact developers who have been specifically assigned to their job postings. This maintains developer privacy and ensures all interactions are meaningful."
  }
];

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about GitTalent
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => toggleFAQ(index)}
              >
                <span className="text-lg font-semibold text-gray-900 pr-4">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5">
                  <p className="text-gray-600 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Still have questions?</h3>
          <p className="text-gray-600 mb-8">
            Can't find the answer you're looking for? Please chat with our friendly team.
          </p>
          <button className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};