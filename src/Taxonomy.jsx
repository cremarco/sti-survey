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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Navigation from './Navigation';

// Colors are now loaded from taxonomy.json

// Get the color for a branch based on its top-level taxonomy category
function getBranchColor(node, colorMap) {
  let current = node;
  while (current.depth > 1) current = current.parent;
  return colorMap[current.data.name] || '#a3a3a3';
}

// Calculates the transform for label positioning
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

// Helper to get the top-level label (taxonomy number + label if available)
function getTopLevelLabel(meta, prop, fallback) {
  if (meta.taxonomy && prop && prop.label) {
    return `${meta.taxonomy} ${prop.label}`;
  }
  return (prop && prop.label) ? prop.label : fallback;
}

// Helper to get child label (just the label or property name)
function getChildLabel(subProp, val) {
  return subProp.label || val;
}

// Main Taxonomy component
function Taxonomy() {
  const chartRef = useRef();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [svgNode, setSvgNode] = useState(null);
  const [labelStroke, setLabelStroke] = useState('black');
  const [isDownloading, setIsDownloading] = useState(false); // Track download mode
  const [colorMap, setColorMap] = useState({});

  // Load taxonomy data from sti-survey.schema.json (_uiMeta)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/sti-survey.schema.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Error loading schema data');
        return res.json();
      })
      .then((json) => {
        const uiMeta = json._uiMeta || {};
        const schemaProps = json.properties || {};
        // Build color map using only top-level labels (with taxonomy number)
        const map = {};
        Object.entries(uiMeta).forEach(([name, meta]) => {
          const prop = schemaProps[name];
          const label = getTopLevelLabel(meta, prop, name);
          if (meta.color) map[label] = meta.color;
        });
        setColorMap(map);
        // Build tree with subclasses
        const children = Object.entries(uiMeta).map(([name, meta]) => {
          const prop = schemaProps[name];
          let subChildren = [];
          // If enum, add values as children
          if (prop && prop.properties && prop.properties.type && prop.properties.type.enum) {
            subChildren = prop.properties.type.enum.map(val => ({ name: val }));
          }
          // If enum on a nested property (e.g., domain.domain)
          else if (prop && prop.properties) {
            Object.entries(prop.properties).forEach(([subName, subProp]) => {
              if (subProp.enum) {
                subChildren = subProp.enum.map(val => ({ name: val }));
              }
            });
          }
          // If object with child properties (e.g., coreTasks, supportTasks)
          if (subChildren.length === 0 && prop && prop.properties) {
            subChildren = Object.entries(prop.properties).map(([val, subProp]) => ({
              name: getChildLabel(subProp, val)
            }));
          }
          // Top-level label: taxonomy number + label if available, else fallback
          const label = getTopLevelLabel(meta, prop, name);
          return {
            name: label,
            taxonomy: meta.taxonomy,
            color: meta.color,
            children: subChildren.length > 0 ? subChildren : undefined
          };
        });
        const treeData = {
          name: 'Taxonomy',
          children
        };
        setData(treeData);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Memoized draw function to avoid unnecessary re-creation
  const drawRadialTidyTree = useCallback((data, container, labelStroke, disableAnimation = false, colorMap = {}) => {
    const width = 1000;
    const radius = width / 2 - 80;
    const root = d3.hierarchy(data);
    d3.tree().size([2 * Math.PI, radius]).separation((a, b) => (a.parent === b.parent ? 1.5 : 2.5))(root);

    const svg = d3.create('svg')
      .attr('viewBox', [-width / 2, -width / 2, width, width])
      .attr('width', '100%')
      .attr('height', width)
      .attr('style', 'font: 10px sans-serif; background: none;');

    // Static links (no animation)
    svg.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#a3a3a3')
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', d3.linkRadial().angle(d => d.x).radius(d => d.y));

    // Static nodes (no animation)
    svg.append('g')
      .selectAll('circle')
      .data(root.descendants())
      .join('circle')
      .attr('transform', d => `rotate(${(d.x * 180 / Math.PI - 90)}) translate(${d.y},0)`)
      .attr('r', 2.5)
      .attr('fill', '#999');

    // Static labels (no animation)
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
      .attr('fill', d => {
        if (d.depth === 0) {
          // Root label: black in download mode, white in normal view
          return isDownloading ? '#000' : '#fff';
        }
        return getBranchColor(d, colorMap);
      })
      .attr('font-size', 13)
      .attr('font-weight', 'bold')
      .style('opacity', 1)
      .text(d => d.data.name);

    container.appendChild(svg.node());
    setSvgNode(svg.node());

    // --- Custom dashed curved lines between 'Data Preparation' and core tasks ---
    // Find nodes by label
    const descendants = root.descendants();
    const dataPrepNode = descendants.find(d => d.data.name === 'Data Preparation');
    // Core tasks are children of '1 Core Tasks'
    const coreTasksNode = descendants.find(d => d.data.name === '1 Core Tasks');
    let coreTaskChildren = [];
    if (coreTasksNode && coreTasksNode.children) {
      coreTaskChildren = coreTasksNode.children.filter(d => ['CTA', 'CPA', 'CEA', 'CNEA'].includes(d.data.name));
    }
    // Draw a dashed curved line from Data Preparation to each core task
    if (dataPrepNode && coreTaskChildren.length > 0) {
      const customLinksGroup = d3.select(svg.node()).append('g')
        .attr('fill', 'none')
        .attr('stroke', '#a3a3a3')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');
      coreTaskChildren.forEach((targetNode, i) => {
        // Use a quadratic Bezier curve for a smooth connection
        const sx = Math.cos(dataPrepNode.x - Math.PI / 2) * dataPrepNode.y;
        const sy = Math.sin(dataPrepNode.x - Math.PI / 2) * dataPrepNode.y;
        const tx = Math.cos(targetNode.x - Math.PI / 2) * targetNode.y;
        const ty = Math.sin(targetNode.x - Math.PI / 2) * targetNode.y;
        // Control point: halfway between, pulled toward the center
        const cx = (sx + tx) / 2 * 0.7;
        const cy = (sy + ty) / 2 * 0.7;
        const pathData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
        customLinksGroup.append('path')
          .attr('d', pathData)
          .attr('stroke-dasharray', '6,4')
          .attr('stroke-dashoffset', 0);
      });
    }

    // --- Custom dashed curved lines between 'Column Classification' and core tasks ---
    const columnClassificationNode = descendants.find(d => d.data.name === 'Column Classification');
    if (columnClassificationNode && coreTaskChildren.length > 0) {
      const customLinksGroup2 = d3.select(svg.node()).append('g')
        .attr('fill', 'none')
        .attr('stroke', '#a3a3a3')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');
      coreTaskChildren.forEach((targetNode, i) => {
        // Use a quadratic Bezier curve for a smooth connection
        const sx = Math.cos(columnClassificationNode.x - Math.PI / 2) * columnClassificationNode.y;
        const sy = Math.sin(columnClassificationNode.x - Math.PI / 2) * columnClassificationNode.y;
        const tx = Math.cos(targetNode.x - Math.PI / 2) * targetNode.y;
        const ty = Math.sin(targetNode.x - Math.PI / 2) * targetNode.y;
        // Control point: halfway between, pulled toward the center
        const cx = (sx + tx) / 2 * 0.7;
        const cy = (sy + ty) / 2 * 0.7;
        const pathData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
        customLinksGroup2.append('path')
          .attr('d', pathData)
          .attr('stroke-dasharray', '6,4')
          .attr('stroke-dashoffset', 0);
      });
    }

    // --- Custom dashed curved lines between 'Subject Detection' and CPA ---
    const subjectDetectionNode = descendants.find(d => d.data.name === 'Subject Detection');
    const cpaNode = coreTaskChildren.find(d => d.data.name === 'CPA');
    if (subjectDetectionNode && cpaNode) {
      const customLinksGroup3 = d3.select(svg.node()).append('g')
        .attr('fill', 'none')
        .attr('stroke', '#a3a3a3')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');
      // Use a quadratic Bezier curve for a smooth connection
      const sx = Math.cos(subjectDetectionNode.x - Math.PI / 2) * subjectDetectionNode.y;
      const sy = Math.sin(subjectDetectionNode.x - Math.PI / 2) * subjectDetectionNode.y;
      const tx = Math.cos(cpaNode.x - Math.PI / 2) * cpaNode.y;
      const ty = Math.sin(cpaNode.x - Math.PI / 2) * cpaNode.y;
      // Control point: halfway between, pulled toward the center
      const cx = (sx + tx) / 2 * 0.7;
      const cy = (sy + ty) / 2 * 0.7;
      const pathData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
      customLinksGroup3.append('path')
        .attr('d', pathData)
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-dashoffset', 0);
    }

    // --- Custom dashed curved lines between 'Datatype Annotation' and CPA ---
    const datatypeAnnotationNode = descendants.find(d => d.data.name === 'Datatype Annotation');
    if (datatypeAnnotationNode && cpaNode) {
      const customLinksGroup4 = d3.select(svg.node()).append('g')
        .attr('fill', 'none')
        .attr('stroke', '#a3a3a3')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');
      // Use a quadratic Bezier curve for a smooth connection
      const sx = Math.cos(datatypeAnnotationNode.x - Math.PI / 2) * datatypeAnnotationNode.y;
      const sy = Math.sin(datatypeAnnotationNode.x - Math.PI / 2) * datatypeAnnotationNode.y;
      const tx = Math.cos(cpaNode.x - Math.PI / 2) * cpaNode.y;
      const ty = Math.sin(cpaNode.x - Math.PI / 2) * cpaNode.y;
      // Control point: halfway between, pulled toward the center
      const cx = (sx + tx) / 2 * 0.7;
      const cy = (sy + ty) / 2 * 0.7;
      const pathData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
      customLinksGroup4.append('path')
        .attr('d', pathData)
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-dashoffset', 0);
    }

    // --- Custom dashed curved lines between 'Entity Linking' and CTA/CEA ---
    const entityLinkingNode = descendants.find(d => d.data.name === 'Entity Linking');
    const ctaNode = coreTaskChildren.find(d => d.data.name === 'CTA');
    const ceaNode = coreTaskChildren.find(d => d.data.name === 'CEA');
    if (entityLinkingNode && (ctaNode || ceaNode)) {
      const customLinksGroup5 = d3.select(svg.node()).append('g')
        .attr('fill', 'none')
        .attr('stroke', '#a3a3a3')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');
      [ctaNode, ceaNode].forEach(targetNode => {
        if (!targetNode) return;
        // Use a quadratic Bezier curve for a smooth connection
        const sx = Math.cos(entityLinkingNode.x - Math.PI / 2) * entityLinkingNode.y;
        const sy = Math.sin(entityLinkingNode.x - Math.PI / 2) * entityLinkingNode.y;
        const tx = Math.cos(targetNode.x - Math.PI / 2) * targetNode.y;
        const ty = Math.sin(targetNode.x - Math.PI / 2) * targetNode.y;
        // Control point: halfway between, pulled toward the center
        const cx = (sx + tx) / 2 * 0.7;
        const cy = (sy + ty) / 2 * 0.7;
        const pathData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
        customLinksGroup5.append('path')
          .attr('d', pathData)
          .attr('stroke-dasharray', '6,4')
          .attr('stroke-dashoffset', 0);
      });
    }

    // --- Custom dashed curved line between 'Type Annotation' and CTA ---
    const typeAnnotationNode = descendants.find(d => d.data.name === 'Type Annotation');
    if (typeAnnotationNode && ctaNode) {
      const customLinksGroup6 = d3.select(svg.node()).append('g')
        .attr('fill', 'none')
        .attr('stroke', '#a3a3a3')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');
      // Use a quadratic Bezier curve for a smooth connection
      const sx = Math.cos(typeAnnotationNode.x - Math.PI / 2) * typeAnnotationNode.y;
      const sy = Math.sin(typeAnnotationNode.x - Math.PI / 2) * typeAnnotationNode.y;
      const tx = Math.cos(ctaNode.x - Math.PI / 2) * ctaNode.y;
      const ty = Math.sin(ctaNode.x - Math.PI / 2) * ctaNode.y;
      // Control point: halfway between, pulled toward the center
      const cx = (sx + tx) / 2 * 0.7;
      const cy = (sy + ty) / 2 * 0.7;
      const pathData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
      customLinksGroup6.append('path')
        .attr('d', pathData)
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-dashoffset', 0);
    }
    // --- Custom dashed curved line between 'Predicate Annotation' and CPA ---
    const predicateAnnotationNode = descendants.find(d => d.data.name === 'Predicate Annotation');
    if (predicateAnnotationNode && cpaNode) {
      const customLinksGroup7 = d3.select(svg.node()).append('g')
        .attr('fill', 'none')
        .attr('stroke', '#a3a3a3')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');
      // Use a quadratic Bezier curve for a smooth connection
      const sx = Math.cos(predicateAnnotationNode.x - Math.PI / 2) * predicateAnnotationNode.y;
      const sy = Math.sin(predicateAnnotationNode.x - Math.PI / 2) * predicateAnnotationNode.y;
      const tx = Math.cos(cpaNode.x - Math.PI / 2) * cpaNode.y;
      const ty = Math.sin(cpaNode.x - Math.PI / 2) * cpaNode.y;
      // Control point: halfway between, pulled toward the center
      const cx = (sx + tx) / 2 * 0.7;
      const cy = (sy + ty) / 2 * 0.7;
      const pathData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
      customLinksGroup7.append('path')
        .attr('d', pathData)
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-dashoffset', 0);
    }
    // --- Custom dashed curved line between 'Nil Annotation' and CNEA ---
    const nilAnnotationNode = descendants.find(d => d.data.name === 'Nil Annotation');
    const cneaNode = coreTaskChildren.find(d => d.data.name === 'CNEA');
    if (nilAnnotationNode && cneaNode) {
      const customLinksGroup8 = d3.select(svg.node()).append('g')
        .attr('fill', 'none')
        .attr('stroke', '#a3a3a3')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');
      // Use a quadratic Bezier curve for a smooth connection
      const sx = Math.cos(nilAnnotationNode.x - Math.PI / 2) * nilAnnotationNode.y;
      const sy = Math.sin(nilAnnotationNode.x - Math.PI / 2) * nilAnnotationNode.y;
      const tx = Math.cos(cneaNode.x - Math.PI / 2) * cneaNode.y;
      const ty = Math.sin(cneaNode.x - Math.PI / 2) * cneaNode.y;
      // Control point: halfway between, pulled toward the center
      const cx = (sx + tx) / 2 * 0.7;
      const cy = (sy + ty) / 2 * 0.7;
      const pathData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
      customLinksGroup8.append('path')
        .attr('d', pathData)
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-dashoffset', 0);
    }
  }, [isDownloading]);

  // Render radial tree when data or labelStroke changes
  useEffect(() => {
    if (!data || !chartRef.current) return;
    chartRef.current.innerHTML = '';
    drawRadialTidyTree(data, chartRef.current, labelStroke, isDownloading, colorMap);
  }, [data, labelStroke, drawRadialTidyTree, isDownloading, colorMap]);

  // SVG download handler
  const handleDownloadSVG = useCallback(() => {
    if (!svgNode) return;
    setIsDownloading(true);
    setLabelStroke('white');
  }, [svgNode]);

  // Effect to handle SVG download after re-render
  useEffect(() => {
    if (!isDownloading || !svgNode) return;
    // Wait for the SVG to be updated in the DOM
    setTimeout(() => {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(chartRef.current.querySelector('svg'));
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
      // Restore state after download
      setLabelStroke('black');
      setIsDownloading(false);
    }, 0);
  }, [isDownloading, svgNode]);

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