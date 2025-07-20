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

import { useState, useEffect, useMemo } from "react";
import { Routes, Route } from 'react-router-dom';
import CitationMap from "./CitationMap";
import Taxonomy from "./Taxonomy";
import Home from "./Home";
import Navigation from "./Navigation";
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

  // Calculate summary statistics for Charts component
  const summaryStats = useMemo(() => {
    if (data.length === 0) {
      return {
        totalEntries: 0,
        entriesWithMissingFields: 0,
        totalMissingFields: 0,
        mostMissing: 'N/A',
        mainMethodTypeDistribution: {},
        domainDistribution: {},
        yearRange: { min: 'N/A', max: 'N/A' },
        approachesWithCode: 0,
        licenseDistribution: {},
        taskCounts: { cta: 0, cpa: 0, cea: 0, cnea: 0 },
      };
    }

    const totalEntries = data.length;
    
    // Single pass through data for better performance
    const stats = data.reduce((acc, row) => {
      // Missing fields analysis
      const missingFields = Object.keys({
        id: true,
        authors: true,
        author: true,
        year: true,
        "title.text": true,
        "conference-journal": true,
        "main-method.type": true,
        "main-method.technique": true,
        "domain.domain": true,
        "tasks.cta": true,
        "tasks.cpa": true,
        "tasks.cea": true,
        "tasks.cnea": true,
        "user-revision.type": true,
        "license": true,
        "inputs.type-of-table": true,
        "inputs.kg.triple-store": true,
        "output-format": true,
        "checked-by-author": true,
        doi: true,
      }).filter(field => {
        const keys = field.split(".");
        let current = row;
        for (const key of keys) {
          if (current == null) return true;
          current = current[key];
        }
        const value = current;
        if (value === null || value === undefined) return true;
        if (typeof value === "string") return value.trim() === "";
        if (typeof value === "object" && !Array.isArray(value)) {
          return Object.keys(value).length === 0;
        }
        return false;
      });
      
      if (missingFields.length > 0) {
        acc.entriesWithMissingFields++;
        acc.totalMissingFields += missingFields.length;
        missingFields.forEach(field => {
          acc.fieldCounts[field] = (acc.fieldCounts[field] || 0) + 1;
        });
      }

      // Main method distribution
      const methodType = row['main-method']?.type || 'N/A';
      acc.mainMethodTypeDistribution[methodType] = (acc.mainMethodTypeDistribution[methodType] || 0) + 1;

      // Domain distribution
      const domain = row['domain']?.domain || 'N/A';
      acc.domainDistribution[domain] = (acc.domainDistribution[domain] || 0) + 1;

      // Year range
      if (typeof row.year === 'number') {
        acc.years.push(row.year);
      }

      // Code availability
      if (row['code-availability'] && row['code-availability'].trim() !== '') {
        acc.approachesWithCode++;
      }

      // License distribution
      const license = row['license'] || 'N/A';
      acc.licenseDistribution[license] = (acc.licenseDistribution[license] || 0) + 1;

      // Task counts
      if (row.tasks?.cta) acc.taskCounts.cta++;
      if (row.tasks?.cpa) acc.taskCounts.cpa++;
      if (row.tasks?.cea) acc.taskCounts.cea++;
      if (row.tasks?.cnea) acc.taskCounts.cnea++;

      // User revision distribution
      const userRevisionType = row['user-revision']?.type || 'N/A';
      acc.userRevisionDistribution[userRevisionType] = (acc.userRevisionDistribution[userRevisionType] || 0) + 1;

      // Steps coverage
      if (row.steps?.['data-preparation']?.description) acc.stepsCoverage['data-preparation']++;
      if (row.steps?.['subject-detection']) acc.stepsCoverage['subject-detection']++;
      if (row.steps?.['column-analysis']) acc.stepsCoverage['column-analysis']++;
      if (row.steps?.['type-annotation']) acc.stepsCoverage['type-annotation']++;
      if (row.steps?.['predicate-annotation']) acc.stepsCoverage['predicate-annotation']++;
      if (row.steps?.['datatype-annotation']) acc.stepsCoverage['datatype-annotation']++;
      if (row.steps?.['entity-linking']?.description) acc.stepsCoverage['entity-linking']++;
      if (row.steps?.['nil-annotation']) acc.stepsCoverage['nil-annotation']++;

      // Conference/Journal distribution
      const venue = row['conference-journal'] || 'N/A';
      acc.conferenceJournalDistribution[venue] = (acc.conferenceJournalDistribution[venue] || 0) + 1;

      return acc;
    }, {
      entriesWithMissingFields: 0,
      totalMissingFields: 0,
      fieldCounts: {},
      mainMethodTypeDistribution: {},
      domainDistribution: {},
      years: [],
      approachesWithCode: 0,
      licenseDistribution: {},
      taskCounts: { cta: 0, cpa: 0, cea: 0, cnea: 0 },
      userRevisionDistribution: {},
      stepsCoverage: {
        'data-preparation': 0,
        'subject-detection': 0,
        'column-analysis': 0,
        'type-annotation': 0,
        'predicate-annotation': 0,
        'datatype-annotation': 0,
        'entity-linking': 0,
        'nil-annotation': 0
      },
      conferenceJournalDistribution: {}
    });

    // Calculate most missing field
    const mostMissingEntry = Object.entries(stats.fieldCounts)
      .sort(([,a], [,b]) => b - a)[0];
    const mostMissing = mostMissingEntry ? `${mostMissingEntry[0]} (${mostMissingEntry[1]})` : 'None';

    // Calculate year range
    const yearRange = {
      min: stats.years.length > 0 ? Math.min(...stats.years) : 'N/A',
      max: stats.years.length > 0 ? Math.max(...stats.years) : 'N/A',
    };

    // Calculate percentages
    const calculatePercentages = (distribution) => 
      Object.fromEntries(
        Object.entries(distribution).map(([key, value]) => [
          key,
          { count: value, percentage: totalEntries > 0 ? (value / totalEntries) * 100 : 0 },
        ])
      );

    const taskPercentages = {
      cta: totalEntries > 0 ? (stats.taskCounts.cta / totalEntries) * 100 : 0,
      cpa: totalEntries > 0 ? (stats.taskCounts.cpa / totalEntries) * 100 : 0,
      cea: totalEntries > 0 ? (stats.taskCounts.cea / totalEntries) * 100 : 0,
      cnea: totalEntries > 0 ? (stats.taskCounts.cnea / totalEntries) * 100 : 0,
    };
    
    return {
      totalEntries,
      entriesWithMissingFields: stats.entriesWithMissingFields,
      totalMissingFields: stats.totalMissingFields,
      mostMissing,
      mainMethodTypeDistribution: calculatePercentages(stats.mainMethodTypeDistribution),
      domainDistribution: calculatePercentages(stats.domainDistribution),
      yearRange,
      approachesWithCode: stats.approachesWithCode,
      approachesWithCodePercentage: totalEntries > 0 ? (stats.approachesWithCode / totalEntries) * 100 : 0,
      licenseDistribution: calculatePercentages(stats.licenseDistribution),
      taskCounts: stats.taskCounts,
      taskPercentages,
      userRevisionDistribution: stats.userRevisionDistribution,
      stepsCoverage: stats.stepsCoverage,
      conferenceJournalDistribution: stats.conferenceJournalDistribution,
    };
  }, [data]);

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
      <Route path="/" element={<Home />} />
      <Route path="/survey" element={<SurveyTable />} />
      <Route path="/citation-map" element={<CitationMap />} />
      <Route path="/taxonomy" element={<Taxonomy />} />
      <Route path="/charts" element={<Charts data={data} summaryStats={summaryStats} />} />
    </Routes>
  );
}

export default App;