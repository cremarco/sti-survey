import React, { useState, useEffect, useMemo } from 'react';

// Helper function to check if a value is empty, null, or undefined
const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
};

// Required fields configuration for validation
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

// Checks if a required field is missing from a row
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

      // Input type distribution
      const inputType = row.inputs?.['type-of-table'] || 'N/A';
      acc.inputTypeDistribution[inputType] = (acc.inputTypeDistribution[inputType] || 0) + 1;

      // Knowledge graph usage
      if (row.inputs?.kg?.['triple-store']) acc.kgUsage.withTripleStore++;
      if (row.inputs?.kg?.index) acc.kgUsage.withIndex++;

      // Author verification
      if (row['checked-by-author'] === true) acc.authorVerification.verified++;
      else if (row['checked-by-author'] === false) acc.authorVerification.notVerified++;
      else acc.authorVerification.missing++;

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
      inputTypeDistribution: {},
      kgUsage: { withTripleStore: 0, withIndex: 0, total: totalEntries },
      authorVerification: { verified: 0, notVerified: 0, missing: 0 },
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
      inputTypeDistribution: stats.inputTypeDistribution,
      kgUsage: stats.kgUsage,
      authorVerification: stats.authorVerification,
      conferenceJournalDistribution: stats.conferenceJournalDistribution,
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
        <div className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-6 text-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex-shrink-0">
      {/* Overall Data Snapshot */}
      <div className="mb-6 bg-neutral-800 border border-neutral-700 shadow-lg overflow-hidden">
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
              <div className="bg-slate-500/10 p-3 border border-slate-500/20">
                <div className="text-2xl font-bold text-slate-100">{summaryStats.totalEntries}</div>
                <div className="text-xs text-slate-300">Total Approaches</div>
              </div>
              <div className="bg-blue-500/10 p-3 border border-blue-500/20">
                <div className="text-2xl font-bold text-blue-100">{summaryStats.yearRange.min} - {summaryStats.yearRange.max}</div>
                <div className="text-xs text-blue-300">Year Range</div>
              </div>
              <div className="bg-rose-500/10 p-3 border border-rose-500/20">
                <div className="text-2xl font-bold text-rose-100">{summaryStats.taskCounts.cta}</div>
                <div className="text-xs text-rose-300">CTA</div>
              </div>
              <div className="bg-orange-500/10 p-3 border border-orange-500/20">
                <div className="text-2xl font-bold text-orange-100">{summaryStats.taskCounts.cpa}</div>
                <div className="text-xs text-orange-300">CPA</div>
              </div>
              <div className="bg-amber-500/10 p-3 border border-amber-500/20">
                <div className="text-2xl font-bold text-amber-100">{summaryStats.taskCounts.cea}</div>
                <div className="text-xs text-amber-300">CEA</div>
              </div>
              <div className="bg-yellow-500/10 p-3 border border-yellow-500/20">
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