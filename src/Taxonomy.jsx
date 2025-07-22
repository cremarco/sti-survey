/**
 * Taxonomy Component
 * 
 * This component creates an interactive radial tree visualization showing
 * the hierarchical classification of STI approaches and methods.
 * 
 * Features:
 * - D3.js radial tree visualization
 * - Interactive node highlighting
 * - SVG download functionality
 * - Responsive design with Tailwind CSS
 * - Hierarchical data visualization
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import Navigation from './Navigation';

/**
 * Color palette for different taxonomy categories
 * Uses Tailwind CSS color scheme for consistency
 */
// Updated color palette for new taxonomy structure (see taxonomy.json)
const CATEGORY_COLORS = {
  "Core task": "#6366f1",            // indigo-500
  "Supported task": "#0ea5e9",       // sky-500
  "Method": "#a21caf",               // fuchsia-700
  "Revision": "#f59e42",             // amber-500
  "Domain": "#ef4444",               // red-500
  "Application/Purpose": "#fbbf24",  // yellow-400
  "Validation": "#f43f5e",           // rose-500
  "Code availability": "#10b981",    // emerald-500
  "User Interface/Tool": "#22d3ee",  // cyan-400
  "Input": "#14b8a6",                // teal-500
  "Output format": "#facc15"         // yellow-500
};

/**
 * Gets the color for a branch based on its top-level taxonomy category
 * @param {Object} node - D3 node object
 * @returns {string} Color hex value
 */
function getBranchColor(node) {
  let current = node;
  // Traverse up to the top-level (depth 1) node
  while (current.depth > 1) current = current.parent;
  // Use the color for the top-level category, or gray if not found
  return CATEGORY_COLORS[current.data.name] || '#a3a3a3'; // gray-400
}

/**
 * Calculates the transform for label positioning
 * Handles rotation and positioning for both leaf and internal nodes
 * @param {Object} d - D3 node data
 * @returns {string} Transform string for SVG
 */
function labelTransform(d) {
  const angle = d.x * 180 / Math.PI - 90;
  const r = d.y;
  // For leaf nodes, rotate group by 180° if on the left, so text is always upright
  if (!d.children) {
    return `rotate(${angle}) translate(${r},0)${angle >= 180 ? ' rotate(180)' : ''}`;
  }
  // For internal nodes, rotate text radially
  return `rotate(${angle}) translate(${r},0)`;
}

/**
 * Main Taxonomy component
 */
function Taxonomy() {
  const chartRef = useRef();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [svgNode, setSvgNode] = useState(null);
  const [labelStroke, setLabelStroke] = useState('black'); // Track label stroke color

  // Load taxonomy data on component mount
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/taxonomy.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Error loading taxonomy data');
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  // Render radial tree when data is loaded
  useEffect(() => {
    if (!data || !chartRef.current) return;
    chartRef.current.innerHTML = '';
    drawRadialTidyTree(data, chartRef.current, labelStroke);
  }, [data, labelStroke]);

  /**
   * Draws the radial tidy tree visualization using D3.js
   * @param {Object} data - Taxonomy data structure
   * @param {HTMLElement} container - DOM container for the chart
   * @param {string} labelStroke - Stroke color for label text
   */
  function drawRadialTidyTree(data, container, labelStroke) {
    const width = 1200; // Increased from 900 to 1200 for more space
    const radius = width / 2 - 80; // Reduced margin to better utilize space
    const root = d3.hierarchy(data);
    
    // Configure tree layout
    const tree = d3.tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1.5 : 2.5));
    tree(root);

    // Create SVG container
    const svg = d3.create('svg')
      .attr('viewBox', [-width / 2, -width / 2, width, width])
      .attr('width', '100%')
      .attr('height', width)
      .attr('style', 'font: 10px sans-serif; background: none;');

    // Add links between nodes
    svg.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#a3a3a3') // gray-400
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', d3.linkRadial()
        .angle(d => d.x)
        .radius(d => d.y)
      );

    // All nodes: same color and radius
    svg.append('g')
      .selectAll('circle')
      .data(root.descendants())
      .join('circle')
      .attr('transform', d => `rotate(${(d.x * 180 / Math.PI - 90)}) translate(${d.y},0)`)
      .attr('r', 2.5)
      .attr('fill', '#999');

    // Labels (match D3 example)
    svg.append('g')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-width', 3)
      .selectAll('text')
      .data(root.descendants())
      .join('text')
      .attr('transform', d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0) rotate(${d.x >= Math.PI ? 180 : 0})`)
      .attr('dy', '0.31em')
      .attr('x', d => (d.x < Math.PI === !d.children ? 6 : -6))
      .attr('text-anchor', d => (d.x < Math.PI === !d.children ? 'start' : 'end'))
      .attr('paint-order', 'stroke')
      .attr('stroke', labelStroke)
      .attr('fill', d => d.depth === 0 ? '#18181b' : getBranchColor(d))
      .attr('font-size', 10)
      .attr('font-weight', 'bold')
      .text(d => d.data.name);

    // Remove the background rectangle code entirely

    // Append SVG to container
    container.appendChild(svg.node());
    setSvgNode(svg.node());
  }

  /**
   * Handles SVG download functionality
   */
  const handleDownloadSVG = () => {
    if (!svgNode) return;
    
    // Set label stroke to white, re-render, then download, then revert to black
    setLabelStroke('white');
    setTimeout(() => {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(chartRef.current.querySelector('svg'));
      
      // Add XML declaration for compatibility
      if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'taxonomy.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      // Revert label stroke to black
      setLabelStroke('black');
    }, 50);
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-6 text-lg">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <Navigation />
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-1">
        <div className="w-full max-w-7xl flex flex-col items-center">
          <div className="w-full pb-4 mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl text-neutral-100 font-bold tracking-tight mb-2">STI Approaches Taxonomy</h1>
              <p className="text-neutral-400 text-base">Hierarchical classification of STI approaches and methods</p>
            </div>
            <button
              onClick={handleDownloadSVG}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-100 border border-indigo-500/30 hover:border-indigo-500/50 transition-all duration-200 shadow-lg"
              disabled={!svgNode}
              title="Download SVG"
            >
              <span className="material-icons-round text-lg">download</span>
            </button>
          </div>
        </div>
        <div className="w-full">
          <div className="w-full flex justify-center items-center">
            <div ref={chartRef} className="w-full flex justify-center items-center" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Taxonomy; 