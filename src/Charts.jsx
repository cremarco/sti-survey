/**
 * Charts Component
 * 
 * This component provides interactive data visualizations and analytics for the STI survey data.
 * Features include:
 * - D3.js powered charts and visualizations
 * - Interactive flip cards with statistics and charts
 * - Download functionality for SVG charts
 * - Responsive design with Tailwind CSS
 * - Comprehensive data analysis and statistics
 */

import React, { useState, useRef, useMemo } from 'react';
import * as d3 from "d3";
import Navigation from './Navigation';

/**
 * D3 Chart Components
 */

/**
 * Main Method Stacked Chart Component
 * 
 * Creates a stacked bar chart showing the distribution of main method types over years
 * using D3.js for data visualization.
 */
const MainMethodStackedChart = ({ data }) => {
  const svgRef = useRef();

  React.useEffect(() => {
    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, left: 40, bottom: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const chartSvg = svg
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Process data for stacked chart
    const years = [...new Set(data.map(d => d.year))].sort();
    const methodTypes = ['unsup', 'sup', 'hybrid'];
    
    const stackedData = years.map(year => {
      const yearData = data.filter(d => d.year === year);
      const result = { year };
      methodTypes.forEach(type => {
        result[type] = yearData.filter(d => d['main-method']?.type === type).length;
      });
      return result;
    });

    const stack = d3.stack().keys(methodTypes);
    const series = stack(stackedData);

    const x = d3.scaleBand()
      .domain(years)
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(series, d => d3.max(d, d => d[1]))])
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(methodTypes)
      .range(['#6366f1', '#818cf8', '#a78bfa']); // Tailwind indigo colors

    // Add bars
    chartSvg.append("g")
      .selectAll("g")
      .data(series)
      .join("g")
      .attr("fill", d => color(d.key))
      .selectAll("rect")
      .data(d => d)
      .join("rect")
      .attr("x", d => x(d.data.year))
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth());

    // Add axes
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y);

    chartSvg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "12px");

    chartSvg.append("g")
      .call(yAxis)
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "12px");

    // Add axis labels
    chartSvg.append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 5)
      .style("text-anchor", "middle")
      .style("fill", "#9ca3af")
      .style("font-size", "14px")
      .text("Year");

    chartSvg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "#9ca3af")
      .style("font-size", "14px")
      .text("Number of Papers");

  }, [data]);

  return <div ref={svgRef}></div>;
};

/**
 * Conference Journal Bar Chart Component
 * 
 * Creates a horizontal bar chart showing the distribution of approaches by conference/journal
 * using D3.js for data visualization.
 */
const ConferenceJournalBarChart = ({ data, total, barColor = "#06b6d4", labelColor = "#bae6fd" }) => {
  const svgRef = useRef();

  React.useEffect(() => {
    if (!data || Object.keys(data).length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, left: 40, bottom: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const chartSvg = svg
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Sort data by count
    const sortedData = Object.entries(data)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10); // Show top 10

    const x = d3.scaleBand()
      .domain(sortedData.map(d => d[0]))
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(sortedData, d => d[1])])
      .range([height, 0]);

    // Add bars
    chartSvg.selectAll("rect")
      .data(sortedData)
      .join("rect")
      .attr("x", d => x(d[0]))
      .attr("y", d => y(d[1]))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d[1]))
      .attr("fill", barColor)
      .attr("rx", 2);

    // Add value labels
    chartSvg.selectAll("text")
      .data(sortedData)
      .join("text")
      .attr("x", d => x(d[0]) + x.bandwidth() / 2)
      .attr("y", d => y(d[1]) - 5)
      .attr("text-anchor", "middle")
      .style("fill", labelColor)
      .style("font-size", "12px")
      .text(d => d[1]);

    // Add axes
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y);

    chartSvg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "10px")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    chartSvg.append("g")
      .call(yAxis)
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "12px");

  }, [data, total, barColor, labelColor]);

  return <div ref={svgRef}></div>;
};

/**
 * Utility Functions
 */

/**
 * Downloads an SVG element as a file
 * @param {SVGElement} svgElement - The SVG element to download
 * @param {string} filename - The filename for the downloaded file
 */
function downloadSVG(svgElement, filename = "chart.svg") {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  
  const downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(svgUrl);
}

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
 * Gets nested value from object using dot notation path
 */
const getNestedValue = (obj, path) => {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
};

/**
 * Checks if a required field is missing from a row
 */
const isRequiredFieldMissing = (row, fieldPath) => {
  if (!REQUIRED_FIELDS[fieldPath]) return false;
  const value = getNestedValue(row, fieldPath);
  return isEmpty(value);
};

/**
 * Calculate summary statistics for the charts
 * 
 * Processes the survey data to generate comprehensive statistics including:
 * - Missing field analysis
 * - Method type distributions
 * - Domain distributions
 * - Task coverage
 * - License distributions
 * - Conference/Journal distributions
 */
const calculateSummaryStats = (data) => {
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
};

/**
 * Main Charts Component
 * 
 * Renders the complete charts dashboard with interactive visualizations
 * and comprehensive data analytics for the STI survey data.
 */
function Charts({ data }) {
  // Calculate summary statistics using the data
  const summaryStats = useMemo(() => calculateSummaryStats(data), [data]);

  // State for chart visibility toggles
  const [showMainMethodChart, setShowMainMethodChart] = useState(false);
  const [showLicensesChart, setShowLicensesChart] = useState(false);
  const [showConferenceJournalChart, setShowConferenceJournalChart] = useState(false);
  const chartRef = useRef();

  if (!data || !summaryStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading charts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <Navigation />
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-1">
        <div className="w-full max-w-7xl flex flex-col items-center">
          <div className="w-full pb-4 mb-8">
            <h1 className="text-3xl md:text-4xl text-neutral-100 font-bold tracking-tight mb-2">Data Analytics & Charts</h1>
            <p className="text-neutral-400 text-base">Interactive visualizations and statistics from the STI survey data</p>
          </div>

          {/* Charts Content */}
          <div className="w-full transition-all duration-300 ease-in-out max-h-[3000px] opacity-100">
            <div className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {/* Main Method Types */}
                <div className="relative perspective-1000 h-[500px]">
                  <div 
                    className={`bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 p-4 border border-indigo-500/20 transition-transform duration-700 ease-in-out transform-style-preserve-3d h-[500px] ${showMainMethodChart ? 'rotate-y-180' : ''}`}
                    style={{ 
                      transformStyle: 'preserve-3d',
                      transform: showMainMethodChart ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front side - Statistics */}
                    <div className="backface-hidden h-[500px]">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-indigo-300 font-semibold text-lg">Main Method Types</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowMainMethodChart(!showMainMethodChart)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 transition-colors duration-200 text-indigo-300 hover:text-indigo-100 subtle-animated-border"
                            title={showMainMethodChart ? 'Show statistics' : 'Show chart'}
                            style={{
                              boxShadow: 'none',
                              padding: 0,
                              border: 'none'
                            }}
                          >
                            <span
                              className="material-icons-round"
                              style={{
                                fontSize: '1.5rem',
                                lineHeight: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                width: '100%',
                                textAlign: 'center'
                              }}
                            >
                              360
                            </span>
                          </button>
                          <span className="material-icons-round text-indigo-400">category</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {Object.entries(summaryStats.mainMethodTypeDistribution)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([type, data], index) => (
                          <div key={type} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-indigo-200 text-sm font-medium">{type}</span>
                              <span className="text-indigo-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-2 bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${data.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Back side - Chart */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 p-4 border border-indigo-500/20 backface-hidden h-[500px]"
                      style={{ 
                        transform: 'rotateY(180deg)',
                        backfaceVisibility: 'hidden'
                      }}
                    >
                      <div className="flex flex-col h-full w-full">
                        {/* Row 1: Title and icons + Download SVG Button */}
                        <div className="flex items-center justify-between mb-4 w-full">
                          <span className="text-indigo-300 font-semibold text-lg">Main Method Distribution by Year</span>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setShowMainMethodChart(!showMainMethodChart)}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 transition-colors duration-200 text-indigo-300 hover:text-indigo-100"
                              title={showMainMethodChart ? "Show statistics" : "Show chart"}
                            >
                              <span className="material-icons-round text-lg transition-transform duration-200" style={{ transform: showMainMethodChart ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                {showMainMethodChart ? 'analytics' : 'bar_chart'}
                              </span>
                            </button>
                            {/* Download SVG Button */}
                            <button
                              onClick={() => {
                                if (chartRef?.current?.children[0]?.children[0]) {
                                  downloadSVG(chartRef.current.children[0].children[0], "main-method-chart.svg");
                                }
                              }}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 transition-colors duration-200 text-indigo-300 hover:text-indigo-100"
                              title="Download SVG"
                            >
                              <span className="material-icons-round text-lg" style={{ fontSize: '1.5rem' }}>download</span>
                            </button>
                            <span className="material-icons-round text-indigo-400">{showMainMethodChart ? 'bar_chart' : 'category'}</span>
                          </div>
                        </div>
                        {/* Row 2: Legend */}
                        <div className="flex flex-row gap-4 mb-2 w-full justify-end">
                          {['unsup', 'sup', 'hybrid'].map(type => (
                            <div key={type} className="flex items-center gap-2">
                              <span className={`inline-block w-4 h-4 rounded ${type === 'unsup' ? 'bg-indigo-500' : type === 'sup' ? 'bg-indigo-400' : 'bg-violet-400'}`}></span>
                              <span className="text-indigo-100 text-sm font-semibold" style={{letterSpacing: 1}}>{type.toUpperCase()}</span>
                            </div>
                          ))}
                        </div>
                        {/* Row 3: Chart */}
                        <div className="flex-grow flex flex-col justify-end pt-2 h-[400px] w-full" ref={chartRef}>
                          <MainMethodStackedChart data={data} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Domains */}
                <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 p-4 border border-purple-500/20 h-[500px]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-purple-300 font-semibold text-lg">Domains</span>
                    <span className="material-icons-round text-purple-400">public</span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summaryStats.domainDistribution)
                      .sort(([, a], [, b]) => b.count - a.count)
                      .map(([domain, data], index) => (
                      <div key={domain} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-purple-200 text-sm font-medium">{domain}</span>
                          <span className="text-purple-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-2 bg-purple-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${data.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tasks Addressed */}
                <div className="bg-gradient-to-r from-rose-500/10 to-rose-600/10 p-4 border border-rose-500/20 h-[500px]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-rose-300 font-semibold text-lg">Tasks Addressed</span>
                    <span className="material-icons-round text-rose-400">assignment</span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summaryStats.taskPercentages).map(([task, percentage], index) => (
                      <div key={task} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-rose-200 text-sm font-medium">{task.toUpperCase()}</span>
                          <span className="text-rose-300 text-sm">{summaryStats.taskCounts[task]} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-2 bg-rose-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Steps Coverage */}
                <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 p-4 border border-green-500/20 h-[500px]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-green-300 font-semibold text-lg">Steps Coverage</span>
                    <span className="material-icons-round text-green-400">layers</span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summaryStats.stepsCoverage)
                      .sort(([, a], [, b]) => b - a)
                      .map(([step, count], index) => (
                      <div key={step} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-green-200 text-sm font-medium">{step.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                          <span className="text-green-300 text-sm">{count} ({(count / summaryStats.totalEntries * 100).toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-2 bg-green-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${(count / summaryStats.totalEntries * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User Revision */}
                <div className="bg-gradient-to-r from-teal-500/10 to-teal-600/10 p-4 border border-teal-500/20 h-[500px]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-teal-300 font-semibold text-lg">User Revision</span>
                    <span className="material-icons-round text-teal-400">edit</span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summaryStats.userRevisionDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count], index) => (
                      <div key={type} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-teal-200 text-sm font-medium">{type}</span>
                          <span className="text-teal-300 text-sm">{count} ({(count / summaryStats.totalEntries * 100).toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-2 bg-teal-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${(count / summaryStats.totalEntries * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Licenses */}
                <div className="relative perspective-1000 h-[500px]">
                  <div 
                    className={`bg-gradient-to-r from-amber-500/10 to-amber-600/10 p-4 border border-amber-500/20 transition-transform duration-700 ease-in-out transform-style-preserve-3d h-[500px] ${showLicensesChart ? 'rotate-y-180' : ''}`}
                    style={{ 
                      transformStyle: 'preserve-3d',
                      transform: showLicensesChart ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front side - Statistics */}
                    <div className="backface-hidden h-[500px]">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-amber-300 font-semibold text-lg">Licenses</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowLicensesChart(!showLicensesChart)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 transition-colors duration-200 text-amber-300 hover:text-amber-100 subtle-animated-border"
                            title={showLicensesChart ? 'Show statistics' : 'Show chart'}
                            style={{ boxShadow: 'none', padding: 0, border: 'none' }}
                          >
                            <span className="material-icons-round" style={{ fontSize: '1.5rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', textAlign: 'center' }}>360</span>
                          </button>
                          <span className="material-icons-round text-amber-400">gavel</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(summaryStats.licenseDistribution)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([license, data], index) => (
                          <div key={license} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-amber-200 text-sm font-medium">{license}</span>
                              <span className="text-amber-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-2 bg-amber-500 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${data.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Back side - Chart */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-amber-600/10 p-4 border border-amber-500/20 backface-hidden h-[500px]"
                      style={{ 
                        transform: 'rotateY(180deg)',
                        backfaceVisibility: 'hidden'
                      }}
                    >
                      <div className="flex flex-col h-full w-full">
                        <div className="flex items-center justify-between mb-4 w-full">
                          <span className="text-amber-300 font-semibold text-lg">License Distribution</span>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setShowLicensesChart(!showLicensesChart)}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 transition-colors duration-200 text-amber-300 hover:text-amber-100"
                              title={showLicensesChart ? 'Show statistics' : 'Show chart'}
                            >
                              <span className="material-icons-round text-lg transition-transform duration-200" style={{ transform: showLicensesChart ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                {showLicensesChart ? 'analytics' : 'bar_chart'}
                              </span>
                            </button>
                            {/* Download SVG Button */}
                            <button
                              onClick={() => {
                                const chartElement = document.querySelector('.licenses-chart svg');
                                if (chartElement) {
                                  downloadSVG(chartElement, "licenses-chart.svg");
                                }
                              }}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 transition-colors duration-200 text-amber-300 hover:text-amber-100"
                              title="Download SVG"
                            >
                              <span className="material-icons-round text-lg" style={{ fontSize: '1.5rem' }}>download</span>
                            </button>
                            <span className="material-icons-round text-amber-400">bar_chart</span>
                          </div>
                        </div>
                        <div className="flex-grow flex flex-col justify-end pt-2 h-[400px] w-full licenses-chart">
                          <ConferenceJournalBarChart 
                            data={Object.fromEntries(Object.entries(summaryStats.licenseDistribution).map(([k, v]) => [k, v.count]))} 
                            total={summaryStats.totalEntries} 
                            barColor="#f59e42" // Tailwind amber-500
                            labelColor="#fde68a" // Tailwind amber-200
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* New row: Approaches per Conference/Journal */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mt-6">
                {/* FLIP CARD Approaches per Conference/Journal */}
                <div className="relative perspective-1000 h-[500px]">
                  <div 
                    className={`bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 p-4 border border-cyan-500/20 transition-transform duration-700 ease-in-out transform-style-preserve-3d h-[500px] ${showConferenceJournalChart ? 'rotate-y-180' : ''}`}
                    style={{ 
                      transformStyle: 'preserve-3d',
                      transform: showConferenceJournalChart ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front: Text statistics */}
                    <div className="backface-hidden h-[500px]">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-cyan-300 font-semibold text-lg">Approaches per Conference/Journal</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowConferenceJournalChart(!showConferenceJournalChart)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 transition-colors duration-200 text-cyan-300 hover:text-cyan-100 subtle-animated-border"
                            title={showConferenceJournalChart ? 'Show statistics' : 'Show chart'}
                            style={{ boxShadow: 'none', padding: 0, border: 'none' }}
                          >
                            <span className="material-icons-round" style={{ fontSize: '1.5rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', textAlign: 'center' }}>360</span>
                          </button>
                          <span className="material-icons-round text-cyan-400">event</span>
                        </div>
                      </div>
                      <div className="space-y-3 overflow-y-scroll max-h-[420px] pr-2">
                        {Object.entries(summaryStats.conferenceJournalDistribution)
                          .sort(([, a], [, b]) => b - a)
                          .map(([venue, count], index) => (
                            <div key={venue} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-cyan-200 text-sm font-medium truncate max-w-[180px]" title={venue}>{venue}</span>
                                <span className="text-cyan-300 text-sm">{count} ({(count / summaryStats.totalEntries * 100).toFixed(1)}%)</span>
                              </div>
                              <div className="h-2 w-full bg-neutral-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-2 bg-cyan-500 rounded-full transition-all duration-1000 ease-out"
                                  style={{ width: `${(count / summaryStats.totalEntries * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        {Object.keys(summaryStats.conferenceJournalDistribution).length === 0 && (
                          <div className="text-cyan-200 text-sm">No data available</div>
                        )}
                      </div>
                    </div>
                    {/* Back: D3 Chart */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 p-4 border border-cyan-500/20 backface-hidden h-[500px]"
                      style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
                    >
                      <div className="flex flex-col h-full w-full">
                        <div className="flex items-center justify-between mb-4 w-full">
                          <span className="text-cyan-300 font-semibold text-lg">Approaches per Conference/Journal</span>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setShowConferenceJournalChart(!showConferenceJournalChart)}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 transition-colors duration-200 text-cyan-300 hover:text-cyan-100"
                              title={showConferenceJournalChart ? 'Show statistics' : 'Show chart'}
                            >
                              <span className="material-icons-round text-lg transition-transform duration-200" style={{ transform: showConferenceJournalChart ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                {showConferenceJournalChart ? 'analytics' : 'bar_chart'}
                              </span>
                            </button>
                            {/* Download SVG Button */}
                            <button
                              onClick={() => {
                                const chartElement = document.querySelector('.conference-journal-chart svg');
                                if (chartElement) {
                                  downloadSVG(chartElement, "conference-journal-chart.svg");
                                }
                              }}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 transition-colors duration-200 text-cyan-300 hover:text-cyan-100"
                              title="Download SVG"
                            >
                              <span className="material-icons-round text-lg" style={{ fontSize: '1.5rem' }}>download</span>
                            </button>
                            <span className="material-icons-round text-cyan-400">bar_chart</span>
                          </div>
                        </div>
                        <div className="flex-grow flex flex-col justify-end pt-2 h-[400px] w-full conference-journal-chart">
                          <ConferenceJournalBarChart 
                            data={summaryStats.conferenceJournalDistribution} 
                            total={summaryStats.totalEntries} 
                            barColor="#06b6d4" // Tailwind cyan-500
                            labelColor="#bae6fd" // Tailwind cyan-200
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Charts;