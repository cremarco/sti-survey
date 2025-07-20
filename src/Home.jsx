import React from 'react';
import Navigation from './Navigation';
import DataOverview from './DataOverview';

function Home() {
  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      {/* Navigation Menu */}
      <Navigation />
      
      {/* Main Content */}
      <div className="flex-1">
        <DataOverview />
      </div>
    </div>
  );
}

export default Home; 