import React from 'react';
import Navigation from './Navigation';

function Home() {
  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      {/* Navigation Menu */}
      <Navigation />
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-300 text-lg">
          Welcome to the STI Survey Home Page
        </div>
      </div>
    </div>
  );
}

export default Home; 