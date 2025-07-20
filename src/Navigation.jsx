import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="px-8 py-4">
      <nav className="bg-gray-800 px-6 py-2 rounded-xl shadow-lg max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <Link
              to="/"
              className={`text-white hover:text-gray-200 transition-colors duration-200 text-sm font-medium ${
                isActive('/') ? 'text-blue-400' : ''
              }`}
            >
              Home
            </Link>
            <Link
              to="/survey"
              className={`text-white hover:text-gray-200 transition-colors duration-200 text-sm font-medium ${
                isActive('/survey') ? 'text-blue-400' : ''
              }`}
            >
              Survey
            </Link>
            <Link
              to="/citation-map"
              className={`text-white hover:text-gray-200 transition-colors duration-200 text-sm font-medium ${
                isActive('/citation-map') ? 'text-blue-400' : ''
              }`}
            >
              Citation Map
            </Link>
            <Link
              to="/taxonomy"
              className={`text-white hover:text-gray-200 transition-colors duration-200 text-sm font-medium ${
                isActive('/taxonomy') ? 'text-blue-400' : ''
              }`}
            >
              Taxonomy
            </Link>
          </div>

          {/* Contact Button */}
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg transition-colors duration-200 text-sm font-medium">
            Contact Us
          </button>
        </div>
      </nav>
    </div>
  );
}

export default Navigation; 