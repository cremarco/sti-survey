/**
 * Navigation Component
 * 
 * Provides the main navigation menu for the STI Survey application.
 * Features active page highlighting and responsive design.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();

  /**
   * Checks if a navigation item is currently active
   * @param {string} path - The path to check
   * @returns {boolean} True if the path matches the current location
   */
  const isActive = (path) => {
    return location.pathname === path;
  };

  /**
   * Opens a pre-filled email to the contact address
   */
  const handleContactClick = () => {
    const email = 'marco.cremaschi@unimib.it';
    const subject = 'Info about STI survey';
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    window.open(mailtoLink, '_blank');
  };

  return (
    <div className="px-8 py-4">
      <nav className="bg-neutral-800 px-6 py-2 rounded-xl shadow-lg max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <Link
              to="/"
              className={`px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive('/') 
                  ? 'text-indigo-100 bg-indigo-600/20 shadow-lg' 
                  : 'text-neutral-100 hover:text-neutral-200 hover:bg-neutral-700/50'
              }`}
            >
              Home
            </Link>
            <Link
              to="/survey"
              className={`px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive('/survey') 
                  ? 'text-indigo-100 bg-indigo-600/20 shadow-lg' 
                  : 'text-neutral-100 hover:text-neutral-200 hover:bg-neutral-700/50'
              }`}
            >
              Survey
            </Link>
            <Link
              to="/citation-map"
              className={`px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive('/citation-map') 
                  ? 'text-indigo-100 bg-indigo-600/20 shadow-lg' 
                  : 'text-neutral-100 hover:text-neutral-200 hover:bg-neutral-700/50'
              }`}
            >
              Citation Map
            </Link>
            <Link
              to="/taxonomy"
              className={`px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive('/taxonomy') 
                  ? 'text-indigo-100 bg-indigo-600/20 shadow-lg' 
                  : 'text-neutral-100 hover:text-neutral-200 hover:bg-neutral-700/50'
              }`}
            >
              Taxonomy
            </Link>
            <Link
              to="/charts"
              className={`px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive('/charts') 
                  ? 'text-indigo-100 bg-indigo-600/20 shadow-lg' 
                  : 'text-neutral-100 hover:text-neutral-200 hover:bg-neutral-700/50'
              }`}
            >
              Charts
            </Link>
          </div>

          {/* Contact Button */}
          <button 
            onClick={handleContactClick}
            className="bg-neutral-700 hover:bg-neutral-600 text-neutral-100 px-4 py-1.5 rounded-lg transition-colors duration-200 text-sm font-medium"
            title="Send email to marco.cremaschi@unimib.it"
          >
            Contact Us
          </button>
        </div>
      </nav>
    </div>
  );
}

export default Navigation; 