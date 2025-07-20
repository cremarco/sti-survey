/**
 * STI Survey Data Application
 * 
 * This application provides a comprehensive interface for viewing and analyzing
 * survey data related to semantic table interpretation approaches.
 * 
 * Features:
 * - Interactive data table with sorting and filtering
 * - Field validation with missing data indicators
 * - Visual badges for method types, domains, and user revision types
 * - Responsive design with collapsible navigation
 * - Integration with external chart components
 * 
 * Data Structure:
 * - Each row represents a research paper/approach
 * - Fields include authors, methods, domains, tasks, and validation info
 * - Required fields are validated and highlighted when missing
 * 
 * Components:
 * - Main data table with React Table
 * - Cell renderers for different data types
 * - Navigation and routing system
 * - Statistics calculation and display
 */

import { useState, useEffect } from "react";
import { Routes, Route, Link } from 'react-router-dom';
import CitationMap from "./CitationMap";
import Taxonomy from "./Taxonomy";
import Navigation from "./Navigation";
import DataOverview from "./DataOverview";
import Charts from "./Charts";
import SurveyTable from "./SurveyTable";

/**
 * Main App component with routing
 */
function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(import.meta.env.BASE_URL + 'data/sti-survey.json');
        if (!response.ok) {
          throw new Error('Failed to load data');
        }
        const jsonData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-neutral-300 text-lg">Loading data...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-6 text-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        <div className="min-h-screen bg-neutral-900 flex flex-col">
          <Navigation />
          <div className="flex-1">
            {/* Main Title */}
            <div className="p-8 text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-neutral-100 mb-2">
                STI Survey Companion
              </h1>
              <p className="text-neutral-400 text-lg mb-4">
                Interactive resources for the <span className="italic">Survey on Semantic Interpretation of Tabular Data: Challenges and Directions</span>
              </p>
              
              {/* Authors */}
              <div className="text-neutral-300 text-sm mb-2">
                <p>Marco Cremaschi¹, Blerina Spahiu¹, Matteo Palmonari¹, Ernesto Jimenez-Ruiz²</p>
              </div>
              
              {/* Affiliations */}
              <div className="text-neutral-400 text-xs mb-4">
                <p>¹ University of Milano - Bicocca, viale Sarca, 336 - Edificio U14, Milan, 20126, Italy</p>
                <p>² City, University of London, Northampton Square, London, EC1V 0HB, United Kingdom</p>
              </div>
              
            </div>
            <DataOverview />
            
            {/* Navigation Boxes */}
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Link to="/survey" className="bg-neutral-800 shadow-lg overflow-hidden hover:bg-neutral-700 transition-all duration-300 group">
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center mr-4">
                        <span className="material-icons-round text-blue-400 text-xl">table_chart</span>
                      </div>
                      <h3 className="text-lg font-bold text-neutral-100">Survey Data</h3>
                    </div>
                    <p className="text-neutral-400 text-sm">
                      Explore the complete dataset with interactive filtering, sorting, and detailed information about each approach.
                    </p>
                  </div>
                </Link>

                <Link to="/citation-map" className="bg-neutral-800 shadow-lg overflow-hidden hover:bg-neutral-700 transition-all duration-300 group">
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-green-500/20 flex items-center justify-center mr-4">
                        <span className="material-icons-round text-green-400 text-xl">account_tree</span>
                      </div>
                      <h3 className="text-lg font-bold text-neutral-100">Citation Map</h3>
                    </div>
                    <p className="text-neutral-400 text-sm">
                      Visualize the relationships between research papers through their citation networks and connections.
                    </p>
                  </div>
                </Link>

                <Link to="/taxonomy" className="bg-neutral-800 shadow-lg overflow-hidden hover:bg-neutral-700 transition-all duration-300 group">
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-purple-500/20 flex items-center justify-center mr-4">
                        <span className="material-icons-round text-purple-400 text-xl">category</span>
                      </div>
                      <h3 className="text-lg font-bold text-neutral-100">Taxonomy</h3>
                    </div>
                    <p className="text-neutral-400 text-sm">
                      Discover the hierarchical classification of methods, techniques, and approaches in semantic table interpretation.
                    </p>
                  </div>
                </Link>

                <Link to="/charts" className="bg-neutral-800 shadow-lg overflow-hidden hover:bg-neutral-700 transition-all duration-300 group">
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-orange-500/20 flex items-center justify-center mr-4">
                        <span className="material-icons-round text-orange-400 text-xl">bar_chart</span>
                      </div>
                      <h3 className="text-lg font-bold text-neutral-100">Analytics</h3>
                    </div>
                    <p className="text-neutral-400 text-sm">
                      View comprehensive charts and analytics showing trends, distributions, and insights from the survey data.
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      } />
      <Route path="/survey" element={<SurveyTable />} />
      <Route path="/citation-map" element={<CitationMap />} />
      <Route path="/taxonomy" element={<Taxonomy />} />
      <Route path="/charts" element={<Charts data={data} />} />
    </Routes>
  );
}

export default App;