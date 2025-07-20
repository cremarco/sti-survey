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
import { Routes, Route } from 'react-router-dom';
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