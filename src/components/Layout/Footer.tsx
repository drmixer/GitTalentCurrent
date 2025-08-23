import React from 'react';
import { Link } from 'react-router-dom';
import { Github, X, Linkedin } from 'lucide-react';

export const Footer = () => {
  const navLinks = [
    { label: 'Features', id: 'features' },
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'About', id: 'about' },
    { label: 'FAQ', id: 'faq' },
    { label: 'Contact', id: 'contact' },
  ];

  const scrollToSection = (sectionId: string) => {
    const headerHeight = document.querySelector('header')?.offsetHeight || 0;
    const element = document.getElementById(sectionId);
    if (element) {
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <Link to="/" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="flex items-center group">
              <div className="h-24 w-auto flex items-center justify-center">
                <img
                  src="https://rsfebnaixdwkqxzadvub.supabase.co/storage/v1/object/sign/logo/GitTalentLogo%20(2).png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jNzQ0ZjQ0OC0yOTg1LTQyNmYtYWVmMy1lYmVmMTRlZGRmNWIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL0dpdFRhbGVudExvZ28gKDIpLnBuZyIsImlhdCI6MTc1MTMxNzQ1OSwiZXhwIjoxNzgyODUzNDU5fQ.PK6RssY3w4Sqwr6wc2AlFy7OwRyq4iMTmxAH1MMaKvs"
                  alt="GitTalent Logo"
                  className="h-full w-auto object-contain"
                />
              </div>
            </Link>
            <p className="text-gray-600 text-lg">
              Connecting Devs &amp; Recruiters <br /> One <span className="underline decoration-blue-500 decoration-2">Commit</span> At A Time
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Navigation</h3>
              <ul className="mt-4 space-y-4">
                {navLinks.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => scrollToSection(item.id)}
                      className="text-base text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Legal</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link to="/legal" className="text-base text-gray-500 hover:text-gray-900 transition-colors">
                    Legal
                  </Link>
                </li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Follow Us</h3>
              <div className="mt-4 flex space-x-6">
                <a href="https://github.com/GitTalent-dev" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">GitHub</span>
                  <Github className="h-6 w-6" />
                </a>
                <a href="https://x.com/GitTalent" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">X</span>
                  <X className="h-6 w-6" />
                </a>
                <a href="https://www.linkedin.com/company/gittalent" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">LinkedIn</span>
                  <Linkedin className="h-6 w-6" />
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
          <p className="text-base text-gray-500">&copy; {new Date().getFullYear()} GitTalent. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
