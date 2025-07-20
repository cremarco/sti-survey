/**
 * Data Overview Component
 * 
 * Displays comprehensive statistics and overview of the STI survey data.
 * Shows key metrics including total entries, year range, task distributions,
 * and various data quality indicators.
 */

import React, { useState, useEffect, useMemo } from 'react';

/**
 * Utility function to check if a value is empty, null, or undefined
 */
const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
};

/**
 * Required fields configuration for validation
 */
const REQUIRED_FIELDS = {
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
};

/**
 * Checks if a required field is missing from a row
 */
const isRequiredFieldMissing = (row, fieldPath) => {
  if (!REQUIRED_FIELDS[fieldPath]) return false;
  
  // Optimized nested value getter
  const getNestedValue = (obj, path) => {
    const keys = path.split(".");
    let current = obj;
    for (const key of keys) {
      if (current == null) return undefined;
      current = current[key];
    }
    return current;
  };
  
  const value = getNestedValue(row, fieldPath);
  return isEmpty(value);
};

/**
 * Main DataOverview component
 */
function DataOverview() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showStatistics, setShowStatistics] = useState(false);

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

  // Calculate summary statistics with optimized performance
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
      const missingFields = Object.keys(REQUIRED_FIELDS).filter(field => isRequiredFieldMissing(row, field));
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
    
    return {
      totalEntries,
      entriesWithMissingFields: stats.entriesWithMissingFields,
      totalMissingFields: stats.totalMissingFields,
      mostMissing,
      mainMethodTypeDistribution: stats.mainMethodTypeDistribution,
      domainDistribution: stats.domainDistribution,
      yearRange,
      approachesWithCode: stats.approachesWithCode,
      approachesWithCodePercentage: totalEntries > 0 ? (stats.approachesWithCode / totalEntries) * 100 : 0,
      licenseDistribution: stats.licenseDistribution,
      taskCounts: stats.taskCounts,
    };
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-neutral-300 text-lg">Loading data...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-400 bg-red-900/20 rounded-lg p-6 text-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex-shrink-0">
      {/* Overall Data Snapshot */}
      <div className="mb-6 bg-neutral-800 shadow-lg overflow-hidden">
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-neutral-100 flex items-center">
              <span className="material-icons-round mr-2 text-blue-400">analytics</span>
              Data Overview
            </h3>
          </div>
          
          {/* Summary when closed */}
          {!showStatistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-slate-500/10 p-3">
                <div className="text-2xl font-bold text-slate-100">{summaryStats.totalEntries}</div>
                <div className="text-xs text-slate-300">Total Approaches</div>
              </div>
              <div className="bg-blue-500/10 p-3">
                <div className="text-2xl font-bold text-blue-100">{summaryStats.yearRange.min} - {summaryStats.yearRange.max}</div>
                <div className="text-xs text-blue-300">Year Range</div>
              </div>
              <div className="bg-rose-500/10 p-3">
                <div className="text-2xl font-bold text-rose-100">{summaryStats.taskCounts.cta}</div>
                <div className="text-xs text-rose-300">CTA</div>
              </div>
              <div className="bg-orange-500/10 p-3">
                <div className="text-2xl font-bold text-orange-100">{summaryStats.taskCounts.cpa}</div>
                <div className="text-xs text-orange-300">CPA</div>
              </div>
              <div className="bg-amber-500/10 p-3">
                <div className="text-2xl font-bold text-amber-100">{summaryStats.taskCounts.cea}</div>
                <div className="text-xs text-amber-300">CEA</div>
              </div>
              <div className="bg-yellow-500/10 p-3">
                <div className="text-2xl font-bold text-yellow-100">{summaryStats.taskCounts.cnea}</div>
                <div className="text-xs text-yellow-300">CNEA</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataOverview; 