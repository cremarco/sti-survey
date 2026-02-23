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
import { useState, useRef, useMemo, useEffect } from 'react';
import Navigation from './Navigation';
import * as d3 from "d3";
import Icon from './Icon';
import MainMethodStackedChart from './components/charts/MainMethodStackedChart';
import ConferenceJournalBarChart from './components/charts/ConferenceJournalBarChart';
import YearWiseCoreTasksChart from './components/charts/YearWiseCoreTasksChart';
import useResizeObserver from './hooks/useResizeObserver';
import { buildBaseSurveyStats, toChartsStats } from './lib/surveyStats';

const TAXONOMY_COLORS = {
  coreTasks: '#6366f1',
  supportTasks: '#3b82f6',
  mainMethod: '#0ea5e9',
  revision: '#06b6d4',
  domain: '#14b8a6',
  license: '#facc15'
};

/**
 * Technique Trends Chart Component
 * 
 * Creates a multi-line chart showing the evolution of specific technique tags over time
 * using D3.js for data visualization.
 */
const TechniqueTrendsChart = ({ data }) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const dimensions = useResizeObserver(containerRef);

  useEffect(() => {
    if (!data || data.length === 0 || !dimensions) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const selectedTags = ['ontology-driven', 'rule-based', 'embeddings', 'transformer', 'CRF'];
    const legendRowHeight = 18;
    const legendHeight = selectedTags.length * legendRowHeight;
    const legendTopGap = 10;
    const margin = { top: 24 + legendHeight + legendTopGap, right: 20, left: 40, bottom: 44 };
    const width = Math.max(0, dimensions.width - margin.left - margin.right);
    const height = Math.max(220, Math.min(400, dimensions.height || 400) - margin.top - margin.bottom);

    if (width <= 0) return;

    const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
    const yearExtent = d3.extent(years);
    if (!Number.isFinite(yearExtent[0]) || !Number.isFinite(yearExtent[1])) return;

    const chartSvg = svg
      .append("svg")
      .attr("width", dimensions.width)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const milestones = [
      { year: 2010, label: "STI Pioneers" },
      { year: 2013, label: "Word2Vec" },
      { year: 2017, label: "Transformers" },
      { year: 2019, label: "SemTab" },
      { year: 2022, label: "ChatGPT" }
    ];

    const trendsData = years.map(year => {
      const yearData = data.filter(d => d.year === year);
      const result = { year };
      selectedTags.forEach(tag => {
        result[tag] = yearData.filter(d => d.techniqueTags?.includes(tag)).length;
      });
      return result;
    });

    const x = d3.scaleLinear()
      .domain(yearExtent)
      .range([0, width]);

    const maxValue = d3.max(trendsData, d => Math.max(...selectedTags.map(tag => d[tag])));
    const y = d3.scaleLinear()
      .domain([0, maxValue + 1]) // Add some headroom
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(selectedTags)
      .range([
        TAXONOMY_COLORS.mainMethod,
        TAXONOMY_COLORS.revision,
        TAXONOMY_COLORS.domain,
        TAXONOMY_COLORS.supportTasks,
        TAXONOMY_COLORS.coreTasks
      ]);

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.count))
      .curve(d3.curveMonotoneX);

    const xTickCount = width < 520 ? Math.min(years.length, 6) : Math.min(years.length, 10);
    chartSvg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(xTickCount))
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "11px");

    chartSvg.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "11px");

    milestones.forEach((m, i) => {
      if (m.year >= d3.min(years) && m.year <= d3.max(years)) {
        chartSvg.append("line")
          .attr("x1", x(m.year))
          .attr("x2", x(m.year))
          .attr("y1", 0)
          .attr("y2", height)
          .attr("stroke", "#9ca3af")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "4,4")
          .attr("opacity", 0.5);

        chartSvg.append("text")
          .attr("x", x(m.year) + 5)
          .attr("y", 12 + (i % 2) * 12)
          .text(m.label)
          .style("fill", "#9ca3af")
          .style("font-size", "10px")
          .style("font-style", "italic");
      }
    });

    const dotRadius = width < 520 ? 3 : 4;
    selectedTags.forEach(tag => {
      const lineData = trendsData.map(d => ({ year: d.year, count: d[tag] }));

      chartSvg.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", color(tag))
        .attr("stroke-width", 2)
        .attr("d", line);

      chartSvg.selectAll(`.dot-${tag}`)
        .data(lineData)
        .join("circle")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.count))
        .attr("r", dotRadius)
        .attr("fill", color(tag))
        .append("title")
        .text(d => `${tag} (${d.year}): ${d.count}`);
    });

    const legendItemWidth = Math.max(120, Math.min(170, Math.floor(width * 0.4)));
    const legendOffsetX = Math.max(0, width - legendItemWidth);
    const legendVerticalOffset = 8;
    const legend = chartSvg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 11)
      .attr("text-anchor", "start")
      .selectAll("g")
      .data(selectedTags)
      .join("g")
      .attr("transform", (d, i) => `translate(${legendOffsetX},${-legendHeight - legendTopGap + legendVerticalOffset + i * legendRowHeight})`);

    legend.append("rect")
      .attr("x", 0)
      .attr("y", 1)
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", color);

    legend.append("text")
      .attr("x", 14)
      .attr("y", 6)
      .attr("dy", "0.32em")
      .style("fill", "#9ca3af")
      .text(d => d);

    chartSvg.append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 8)
      .style("text-anchor", "middle")
      .style("fill", "#9ca3af")
      .style("font-size", "12px")
      .text("Year");

    chartSvg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "#9ca3af")
      .style("font-size", "12px")
      .text("Count");

  }, [data, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden">
      <div ref={svgRef} className="w-full h-full flex justify-center items-center" />
    </div>
  );
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
 * Main Charts Component
 * 
 * Renders the complete charts dashboard with interactive visualizations
 * and comprehensive data analytics for the STI survey data.
 */
function Charts({ data = [] }) {
  // Calculate summary statistics using the data
  const summaryStats = useMemo(() => toChartsStats(buildBaseSurveyStats(data)), [data]);

  // State for chart visibility toggles
  const [showMainMethodChart, setShowMainMethodChart] = useState(false);
  const [showTechniqueChart, setShowTechniqueChart] = useState(false);
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
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-7xl flex flex-col items-center">
          <div className="w-full pb-4 mb-8">
            <h1 className="text-3xl md:text-4xl text-neutral-100 font-bold tracking-tight mb-2">Data Analytics & Charts</h1>
            <p className="text-neutral-400 text-base">Interactive visualizations and statistics from the STI survey data</p>
          </div>
        </div>
        
        {/* Charts Content */}
        <div className="w-full">
          <div className="w-full flex justify-center items-center">
            <div className="w-full max-w-7xl">
              {/* Row 1: Main Method Types (Full Width - Flip Box) */}
              <div className="grid grid-cols-1 gap-6 mb-6">
                <div className="relative perspective-1000 h-[500px]">
                  <div 
                    className={`bg-gradient-to-r from-sky-500/10 to-sky-600/10 p-4 transition-transform duration-700 ease-in-out transform-style-preserve-3d h-[500px] ${showMainMethodChart ? 'rotate-y-180' : ''}`}
                    style={{ 
                      transformStyle: 'preserve-3d',
                      transform: showMainMethodChart ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front side - Statistics */}
                    <div className="backface-hidden h-[500px]">
                      <div className="flex items-center justify-between mb-4 w-full">
                        <span className="text-sky-300 font-semibold text-lg flex items-center gap-2">
                          Main Method Types
                          <span className="ml-2 px-2 py-0.5 bg-sky-700/40 text-sky-200 text-xs font-mono align-middle">
                            {Object.keys(summaryStats.mainMethodTypeDistribution).length}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowMainMethodChart(!showMainMethodChart)}
                            className="flex items-center justify-center w-8 h-8 bg-sky-600/30 hover:bg-sky-600/50 transition-colors duration-200 text-sky-300 hover:text-sky-100"
                            title={showMainMethodChart ? 'Show statistics' : 'Show chart'}
                          >
                            <Icon name="360" className="text-lg" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {Object.entries(summaryStats.mainMethodTypeDistribution)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([type, data], index) => (
                          <div key={type} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sky-200 text-sm font-medium">{type}</span>
                              <span className="text-sky-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-gray-700 overflow-hidden">
                              <div 
                                className="h-2 bg-sky-500 transition-all duration-1000 ease-out"
                                style={{ width: `${data.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Back side - Chart */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-sky-600/10 p-4 backface-hidden h-[500px]"
                      style={{ 
                        transform: 'rotateY(180deg)',
                        backfaceVisibility: 'hidden'
                      }}
                    >
                      <div className="flex flex-col h-full w-full">
                        <div className="flex items-center justify-between mb-4 w-full">
                          <span className="text-sky-300 font-semibold text-lg flex items-center gap-2">
                            Main Method Distribution by Year
                            <span className="ml-2 px-2 py-0.5 bg-sky-700/40 text-sky-200 text-xs font-mono align-middle">
                              {Object.keys(summaryStats.mainMethodTypeDistribution).length}
                            </span>
                          </span>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setShowMainMethodChart(!showMainMethodChart)}
                              className="flex items-center justify-center w-8 h-8 bg-sky-600/30 hover:bg-sky-600/50 transition-colors duration-200 text-sky-300 hover:text-sky-100"
                              title={showMainMethodChart ? "Show statistics" : "Show chart"}
                            >
                              <Icon name="360" className="text-lg" />
                            </button>
                            <button
                              onClick={() => {
                                if (chartRef?.current?.children[0]?.children[0]) {
                                  downloadSVG(chartRef.current.children[0].children[0], "main-method-chart.svg");
                                }
                              }}
                              className="flex items-center justify-center w-8 h-8 bg-sky-600/30 hover:bg-sky-600/50 transition-colors duration-200 text-sky-300 hover:text-sky-100"
                              title="Download SVG"
                            >
                              <Icon name="download" className="text-lg" />
                            </button>
                          </div>
                        </div>
                        <div className="flex-grow flex flex-col justify-end pt-2 h-[400px] w-full min-w-0 overflow-hidden" ref={chartRef}>
                          <MainMethodStackedChart data={data} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Domains & Tasks Addressed (Two Columns) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Domains */}
                <div className="bg-gradient-to-r from-teal-500/10 to-teal-600/10 p-4 h-[500px]">
                  <div className="flex items-center justify-between mb-4 w-full">
                    <span className="text-teal-300 font-semibold text-lg flex items-center gap-2">
                      Domains
                      <span className="ml-2 px-2 py-0.5 bg-teal-700/40 text-teal-200 text-xs font-mono align-middle">
                        {Object.keys(summaryStats.domainDistribution).length}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summaryStats.domainDistribution)
                      .sort(([, a], [, b]) => b.count - a.count)
                      .map(([domain, data], index) => (
                      <div key={domain} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-teal-200 text-sm font-medium">{domain}</span>
                          <span className="text-teal-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-700 overflow-hidden">
                          <div 
                            className="h-2 bg-teal-500 transition-all duration-1000 ease-out"
                            style={{ width: `${data.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tasks Addressed */}
                <div className="bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 p-4 h-[500px]">
                  <div className="flex items-center justify-between mb-4 w-full">
                    <span className="text-indigo-300 font-semibold text-lg flex items-center gap-2">
                      Tasks Addressed
                      <span className="ml-2 px-2 py-0.5 bg-indigo-700/40 text-indigo-200 text-xs font-mono align-middle">
                        {Object.keys(summaryStats.taskCounts).length}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summaryStats.taskPercentages).map(([task, percentage], index) => (
                      <div key={task} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-indigo-200 text-sm font-medium">{task.toUpperCase()}</span>
                          <span className="text-indigo-300 text-sm">{summaryStats.taskCounts[task]} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-700 overflow-hidden">
                          <div 
                            className="h-2 bg-indigo-500 transition-all duration-1000 ease-out"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: Steps Coverage & User Revision (Two Columns) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Steps Coverage */}
                <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 p-4 h-[500px]">
                  <div className="flex items-center justify-between mb-4 w-full">
                    <span className="text-blue-300 font-semibold text-lg flex items-center gap-2">
                      Steps Coverage
                      <span className="ml-2 px-2 py-0.5 bg-blue-700/40 text-blue-200 text-xs font-mono align-middle">
                        {Object.keys(summaryStats.stepsCoverage).length}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summaryStats.stepsCoverage)
                      .sort(([, a], [, b]) => b - a)
                      .map(([step, count], index) => (
                      <div key={step} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-blue-200 text-sm font-medium">{step.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                          <span className="text-blue-300 text-sm">{count} ({(count / summaryStats.totalEntries * 100).toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-700 overflow-hidden">
                          <div 
                            className="h-2 bg-blue-500 transition-all duration-1000 ease-out"
                            style={{ width: `${(count / summaryStats.totalEntries * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User Revision */}
                <div className="bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 p-4 h-[500px]">
                  <div className="flex items-center justify-between mb-4 w-full">
                    <span className="text-cyan-300 font-semibold text-lg flex items-center gap-2">
                      User Revision
                      <span className="ml-2 px-2 py-0.5 bg-cyan-700/40 text-cyan-200 text-xs font-mono align-middle">
                        {Object.keys(summaryStats.userRevisionDistribution).length}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(summaryStats.userRevisionDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count], index) => (
                      <div key={type} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-cyan-200 text-sm font-medium">{type}</span>
                          <span className="text-cyan-300 text-sm">{count} ({(count / summaryStats.totalEntries * 100).toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-700 overflow-hidden">
                          <div 
                            className="h-2 bg-cyan-500 transition-all duration-1000 ease-out"
                            style={{ width: `${(count / summaryStats.totalEntries * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3.5: Technique Trends (Full Width - Flip Box) */}
              <div className="grid grid-cols-1 gap-6 mb-6">
                <div className="relative perspective-1000 h-[500px]">
                  <div 
                    className={`bg-gradient-to-r from-sky-500/10 to-sky-600/10 p-4 transition-transform duration-700 ease-in-out transform-style-preserve-3d h-[500px] ${showTechniqueChart ? 'rotate-y-180' : ''}`}
                    style={{ 
                      transformStyle: 'preserve-3d',
                      transform: showTechniqueChart ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front side - Statistics */}
                    <div className="backface-hidden h-[500px]">
                      <div className="flex items-center justify-between mb-4 w-full">
                        <span className="text-sky-300 font-semibold text-lg flex items-center gap-2">
                          Technique Evolution
                          <span className="ml-2 px-2 py-0.5 rounded bg-sky-700/40 text-sky-200 text-xs font-mono align-middle">
                            {Object.keys(summaryStats.techniqueTagDistribution).length}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowTechniqueChart(!showTechniqueChart)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 transition-colors duration-200 text-sky-300 hover:text-sky-100"
                            title={showTechniqueChart ? 'Show statistics' : 'Show chart'}
                          >
                            <Icon name="360" className="text-lg" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {Object.entries(summaryStats.techniqueTagDistribution)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([tag, data], index) => (
                          <div key={tag} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sky-200 text-sm font-medium">{tag}</span>
                              <span className="text-sky-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-2 bg-sky-500 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${data.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Back side - Chart */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-sky-600/10 p-4 backface-hidden h-[500px]"
                      style={{ 
                        transform: 'rotateY(180deg)',
                        backfaceVisibility: 'hidden'
                      }}
                    >
                      <div className="flex flex-col h-full w-full">
                        <div className="flex items-center justify-between mb-4 w-full">
                          <span className="text-sky-300 font-semibold text-lg flex items-center gap-2">
                            Technique Trends over Time
                          </span>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setShowTechniqueChart(!showTechniqueChart)}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 transition-colors duration-200 text-sky-300 hover:text-sky-100"
                              title={showTechniqueChart ? "Show statistics" : "Show chart"}
                            >
                              <Icon name="360" className="text-lg" />
                            </button>
                            <button
                              onClick={() => {
                                const chart = document.querySelector('.technique-chart svg');
                                if (chart) downloadSVG(chart, "technique-trends.svg");
                              }}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 transition-colors duration-200 text-sky-300 hover:text-sky-100"
                              title="Download SVG"
                            >
                              <Icon name="download" className="text-lg" />
                            </button>
                          </div>
                        </div>
                        <div className="flex-grow flex flex-col justify-end pt-2 h-[400px] w-full min-w-0 overflow-hidden technique-chart">
                          <TechniqueTrendsChart data={data} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Licenses (Full Width - Flip Box) */}
              <div className="grid grid-cols-1 gap-6 mb-6">
                <div className="relative perspective-1000 h-[500px]">
                  <div 
                    className={`bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 p-4 transition-transform duration-700 ease-in-out transform-style-preserve-3d h-[500px] ${showLicensesChart ? 'rotate-y-180' : ''}`}
                    style={{ 
                      transformStyle: 'preserve-3d',
                      transform: showLicensesChart ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front side - Statistics */}
                    <div className="backface-hidden h-[500px]">
                      <div className="flex items-center justify-between mb-4 w-full">
                        <span className="text-yellow-300 font-semibold text-lg flex items-center gap-2">
                          Licenses
                          <span className="ml-2 px-2 py-0.5 bg-yellow-700/40 text-yellow-200 text-xs font-mono align-middle">
                            {Object.keys(summaryStats.licenseDistribution).length}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowLicensesChart(!showLicensesChart)}
                            className="flex items-center justify-center w-8 h-8 bg-yellow-600/30 hover:bg-yellow-600/50 transition-colors duration-200 text-yellow-300 hover:text-yellow-100"
                            title={showLicensesChart ? 'Show statistics' : 'Show chart'}
                          >
                            <Icon name="360" className="text-lg" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3 h-[400px] overflow-y-auto pr-1">
                        {Object.entries(summaryStats.licenseDistribution)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([license, data], index) => (
                          <div key={license} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex justify-between items-center mb-1">
                          <span className="text-yellow-200 text-sm font-medium">{license}</span>
                          <span className="text-yellow-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-gray-700 overflow-hidden">
                              <div 
                                className="h-2 bg-yellow-500 transition-all duration-1000 ease-out"
                                style={{ width: `${data.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Back side - Chart */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 p-4 backface-hidden h-[500px]"
                      style={{ 
                        transform: 'rotateY(180deg)',
                        backfaceVisibility: 'hidden'
                      }}
                    >
                      <div className="flex flex-col h-full w-full">
                        <div className="flex items-center justify-between mb-4 w-full">
                          <span className="text-yellow-300 font-semibold text-lg flex items-center gap-2">
                            License Distribution
                            <span className="ml-2 px-2 py-0.5 bg-yellow-700/40 text-yellow-200 text-xs font-mono align-middle">
                              {Object.keys(summaryStats.licenseDistribution).length}
                            </span>
                          </span>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setShowLicensesChart(!showLicensesChart)}
                              className="flex items-center justify-center w-8 h-8 bg-yellow-600/30 hover:bg-yellow-600/50 transition-colors duration-200 text-yellow-300 hover:text-yellow-100"
                              title={showLicensesChart ? 'Show statistics' : 'Show chart'}
                            >
                              <Icon name="360" className="text-lg" />
                            </button>
                            <button
                              onClick={() => {
                                const chartElement = document.querySelector('.licenses-chart svg');
                                if (chartElement) {
                                  downloadSVG(chartElement, "licenses-chart.svg");
                                }
                              }}
                              className="flex items-center justify-center w-8 h-8 bg-yellow-600/30 hover:bg-yellow-600/50 transition-colors duration-200 text-yellow-300 hover:text-yellow-100"
                              title="Download SVG"
                            >
                              <Icon name="download" className="text-lg" />
                            </button>
                          </div>
                        </div>
                        <div className="flex-grow flex flex-col justify-end pt-2 h-[400px] w-full min-w-0 overflow-hidden licenses-chart">
                          <ConferenceJournalBarChart 
                            data={Object.fromEntries(Object.entries(summaryStats.licenseDistribution).map(([k, v]) => [k, v.count]))} 
                            total={summaryStats.totalEntries} 
                            barColor={TAXONOMY_COLORS.license}
                            labelColor="#fef3c7"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 5: Approaches per Conference/Journal (Full Width - Flip Box) */}
              <div className="grid grid-cols-1 gap-6">
                <div className="relative perspective-1000 h-[500px]">
                  <div 
                    className={`bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 p-4 transition-transform duration-700 ease-in-out transform-style-preserve-3d h-[500px] ${showConferenceJournalChart ? 'rotate-y-180' : ''}`}
                    style={{ 
                      transformStyle: 'preserve-3d',
                      transform: showConferenceJournalChart ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front: Text statistics */}
                    <div className="backface-hidden h-[500px]">
                      <div className="flex items-center justify-between mb-4 w-full">
                        <span className="text-cyan-300 font-semibold text-lg flex items-center gap-2">
                          Approaches per Conference/Journal
                          {/* Unique venues count label */}
                          <span className="ml-2 px-2 py-0.5 bg-cyan-700/40 text-cyan-200 text-xs font-mono align-middle">
                            {Object.keys(summaryStats.conferenceJournalDistribution).length}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowConferenceJournalChart(!showConferenceJournalChart)}
                            className="flex items-center justify-center w-8 h-8 bg-cyan-600/30 hover:bg-cyan-600/50 transition-colors duration-200 text-cyan-300 hover:text-cyan-100"
                            title={showConferenceJournalChart ? 'Show statistics' : 'Show chart'}
                          >
                            <Icon name="360" className="text-lg" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3 overflow-y-scroll h-[400px]">
                        {Object.entries(summaryStats.conferenceJournalDistribution)
                          .sort(([, a], [, b]) => b - a)
                          .map(([venue, count], index) => (
                            <div key={venue} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-cyan-200 text-sm font-medium truncate max-w-[180px]" title={venue}>{venue}</span>
                                <span className="text-cyan-300 text-sm">{count} ({(count / summaryStats.totalEntries * 100).toFixed(1)}%)</span>
                              </div>
                              <div className="h-2 w-full bg-neutral-700 overflow-hidden">
                                <div 
                                  className="h-2 bg-cyan-500 transition-all duration-1000 ease-out"
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
                      className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 p-4 backface-hidden h-[500px]"
                      style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
                    >
                      <div className="flex flex-col h-full w-full">
                        <div className="flex items-center justify-between mb-4 w-full">
                          <span className="text-cyan-300 font-semibold text-lg flex items-center gap-2">
                            Approaches per Conference/Journal
                            <span className="ml-2 px-2 py-0.5 bg-cyan-700/40 text-cyan-200 text-xs font-mono align-middle">
                              {Object.keys(summaryStats.conferenceJournalDistribution).length}
                            </span>
                          </span>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setShowConferenceJournalChart(!showConferenceJournalChart)}
                              className="flex items-center justify-center w-8 h-8 bg-cyan-600/30 hover:bg-cyan-600/50 transition-colors duration-200 text-cyan-300 hover:text-cyan-100"
                              title={showConferenceJournalChart ? 'Show statistics' : 'Show chart'}
                            >
                              <Icon name="360" className="text-lg" />
                            </button>
                            <button
                              onClick={() => {
                                const chartElement = document.querySelector('.conference-journal-chart svg');
                                if (chartElement) {
                                  downloadSVG(chartElement, "conference-journal-chart.svg");
                                }
                              }}
                              className="flex items-center justify-center w-8 h-8 bg-cyan-600/30 hover:bg-cyan-600/50 transition-colors duration-200 text-cyan-300 hover:text-cyan-100"
                              title="Download SVG"
                            >
                              <Icon name="download" className="text-lg" />
                            </button>
                          </div>
                        </div>
                        <div className="flex-grow flex flex-col justify-end pt-2 h-[400px] w-full min-w-0 overflow-hidden conference-journal-chart">
                          <ConferenceJournalBarChart 
                            data={summaryStats.conferenceJournalDistribution} 
                            total={summaryStats.totalEntries} 
                            barColor={TAXONOMY_COLORS.revision}
                            labelColor="#bae6fd"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 6: Year-wise Core Tasks (Full Width) */}
              <div className="grid grid-cols-1 gap-6 mb-6 mt-6">
                <div className="bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-indigo-300 font-semibold text-lg">Year-wise Trends of Core Tasks</span>
                  </div>
                  <div className="h-[400px] min-w-0 overflow-hidden">
                    <YearWiseCoreTasksChart data={data} />
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
