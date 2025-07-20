import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="px-8 py-4">
      <nav className="bg-neutral-800 px-6 py-2 rounded-xl shadow-lg max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <Link
              to="/"
              className={`text-neutral-100 hover:text-neutral-200 transition-colors duration-200 text-sm font-medium ${
                isActive('/') ? 'text-slate-300' : ''
              }`}
            >
              Home
            </Link>
            <Link
              to="/survey"
              className={`text-neutral-100 hover:text-neutral-200 transition-colors duration-200 text-sm font-medium ${
                isActive('/survey') ? 'text-slate-300' : ''
              }`}
            >
              Survey
            </Link>
            <Link
              to="/citation-map"
              className={`text-neutral-100 hover:text-neutral-200 transition-colors duration-200 text-sm font-medium ${
                isActive('/citation-map') ? 'text-slate-300' : ''
              }`}
            >
              Citation Map
            </Link>
            <Link
              to="/taxonomy"
              className={`text-neutral-100 hover:text-neutral-200 transition-colors duration-200 text-sm font-medium ${
                isActive('/taxonomy') ? 'text-slate-300' : ''
              }`}
            >
              Taxonomy
            </Link>
            <Link
              to="/charts"
              className={`text-neutral-100 hover:text-neutral-200 transition-colors duration-200 text-sm font-medium ${
                isActive('/charts') ? 'text-slate-300' : ''
              }`}
            >
              Charts
            </Link>
          </div>

          {/* Contact Button */}
          <button className="bg-neutral-700 hover:bg-neutral-600 text-neutral-100 px-4 py-1.5 rounded-lg transition-colors duration-200 text-sm font-medium border border-neutral-600">
            Contact Us
          </button>
        </div>
      </nav>
    </div>
  );
}

export default Navigation; 