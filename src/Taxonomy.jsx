import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import Navigation from './Navigation';

// Tailwind palette HEX (v3)
const CATEGORY_COLORS = {
  "Task": "#6366f1",                // indigo-500
  "Method": "#a21caf",              // fuchsia-700
  "Revision": "#f59e42",            // amber-500
  "Domain": "#ef4444",              // red-500
  "Application/Resource": "#fbbf24",// yellow-400
  "Validation": "#f43f5e",          // rose-500
  "Code availability": "#10b981",   // emerald-500
  "User Interface/Tool": "#0ea5e9", // sky-500
  "Input": "#22d3ee",               // cyan-400
  "Output format": "#fde047"         // yellow-300
};

function getBranchColor(node) {
  let current = node;
  while (current.depth > 1) current = current.parent;
  return CATEGORY_COLORS[current.data.name] || '#a3a3a3'; // gray-400
}

// Funzione per la rotazione delle etichette come nell'esempio D3
function labelTransform(d) {
  const angle = d.x * 180 / Math.PI - 90;
  const r = d.y;
  // Per i leaf node, posiziona sempre all'esterno e orizzontale
  if (!d.children) {
    return `rotate(${angle}) translate(${r + 8},0) rotate(${-angle})`;
  }
  // Per i nodi interni, posiziona radialmente
  return `rotate(${angle}) translate(${r},0)`;
}

function Taxonomy() {
  const chartRef = useRef();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/taxonomy.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Error loading taxonomy data');
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!data || !chartRef.current) return;
    chartRef.current.innerHTML = '';
    drawRadialTidyTree(data, chartRef.current);
  }, [data]);

  function drawRadialTidyTree(data, container) {
    const width = 900;
    const radius = width / 2 - 40;
    const root = d3.hierarchy(data);
    const tree = d3.tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1.5 : 2.5));
    tree(root);

    const svg = d3.create('svg')
      .attr('viewBox', [-width / 2, -width / 2, width, width])
      .attr('width', '100%')
      .attr('height', width)
      .attr('style', 'font: 14px sans-serif; background: none;');

    // Links
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

    // Nodes
    svg.append('g')
      .selectAll('circle')
      .data(root.descendants())
      .join('circle')
      .attr('transform', d => `rotate(${(d.x * 180 / Math.PI - 90)}) translate(${d.y},0)`)
      .attr('r', d => d.depth === 0 ? 8 : 5)
      .attr('fill', d => d.depth === 0 ? '#fff' : getBranchColor(d))
      .attr('stroke', d => d.depth === 0 ? '#6366f1' : getBranchColor(d))
      .attr('stroke-width', d => d.depth === 0 ? 3 : 2);

    // Labels
    svg.append('g')
      .selectAll('text')
      .data(root.descendants())
      .join('text')
      .attr('transform', labelTransform)
      .attr('dy', '0.32em')
      .attr('x', d => !d.children ? 0 : (d.x < Math.PI === !d.children ? 10 : -10))
      .attr('text-anchor', d => !d.children ? 'middle' : (d.x < Math.PI === !d.children ? 'start' : 'end'))
      .attr('fill', d => d.depth === 0 ? '#18181b' : getBranchColor(d))
      .attr('font-weight', d => d.depth === 0 ? 'bold' : 'normal')
      .attr('font-size', d => d.depth === 0 ? 20 : d.depth === 1 ? 16 : 13)
      .text(d => d.data.name);

    container.appendChild(svg.node());
  }

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
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-6xl flex flex-col items-center">
          <h2 className="text-3xl font-bold text-gray-100 mb-6">STI Approaches Taxonomy</h2>
          <div ref={chartRef} className="w-full flex justify-center items-center" />
        </div>
      </div>
    </div>
  );
}

export default Taxonomy; 