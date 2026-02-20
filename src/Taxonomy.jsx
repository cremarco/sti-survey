/**
 * Taxonomy Component
 *
 * Interactive radial tree visualization for STI approaches taxonomy.
 * Colors are preserved while layout and rendering logic are optimized.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import Icon from './Icon';
import Navigation from './Navigation';

const GROUP_LABELS = {
  systemLevel: 'System level',
  resourcheImplementation: 'Implementation',
  dataInterface: 'Data interface'
};

const CORE_TASK_KEYS = ['coreTasks.cta', 'coreTasks.cpa', 'coreTasks.cea', 'coreTasks.cnea'];
const BASE_EDGE_COLOR = '#a3a3a3';
const MIN_CHART_SIZE = 760;
const MAX_CHART_SIZE = 1500;
const CHART_SCALE_FACTOR = 1.12;

const TAILWIND_LABEL_ORDER = [
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#22c55e', // green-500
  '#10b981', // emerald-500
  '#14b8a6', // teal-500
  '#06b6d4', // cyan-500
  '#0ea5e9', // sky-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#a855f7', // purple-500
  '#d946ef', // fuchsia-500
  '#ec4899', // pink-500
  '#f43f5e' // rose-500
];

function getTopLevelLabel(meta, prop, fallback) {
  void meta;
  return prop?.label || fallback;
}

function getChildLabel(subProp, key) {
  return subProp?.label || key;
}

function capitalizeFirstLetter(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  const firstLetterIndex = value.search(/[A-Za-zÀ-ÖØ-öø-ÿ]/);
  if (firstLetterIndex === -1) return value;
  return (
    value.slice(0, firstLetterIndex) +
    value.charAt(firstLetterIndex).toUpperCase() +
    value.slice(firstLetterIndex + 1)
  );
}

function getBranchColor(node, colorMap) {
  let current = node;
  while (current) {
    if (colorMap[current.data.name]) return colorMap[current.data.name];
    current = current.parent;
  }
  return BASE_EDGE_COLOR;
}

function buildOrderedLabelColorMap(root) {
  const labels = root
    .descendants()
    .filter((node) => node.depth > 0)
    .sort((a, b) => a.x - b.x);
  const map = new Map();
  const total = labels.length;
  const interpolator = d3.interpolateRgbBasis(TAILWIND_LABEL_ORDER);

  labels.forEach((node, index) => {
    const t = total <= 1 ? 0 : index / (total - 1);
    map.set(node, interpolator(t));
  });

  return map;
}

function projectToCartesian(node) {
  return [
    Math.cos(node.x - Math.PI / 2) * node.y,
    Math.sin(node.x - Math.PI / 2) * node.y
  ];
}

function drawCurvedConnection(group, sourceNode, targetNode) {
  if (!sourceNode || !targetNode) return;
  const [sx, sy] = projectToCartesian(sourceNode);
  const [tx, ty] = projectToCartesian(targetNode);
  const cx = ((sx + tx) / 2) * 0.68;
  const cy = ((sy + ty) / 2) * 0.68;
  const pathData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;

  group.append('path').attr('d', pathData);
}

function buildTopLevelNode(name, meta, schemaProps, uiTaxonomyChildren) {
  const prop = schemaProps[name];
  let subChildren = [];

  if (Array.isArray(uiTaxonomyChildren[name])) {
    subChildren = uiTaxonomyChildren[name].map((value) => ({
      name: value,
      key: `${name}.${value}`
    }));
  } else if (prop?.properties?.type?.enum) {
    subChildren = prop.properties.type.enum.map((value) => ({
      name: value,
      key: `${name}.type.${value}`
    }));
  } else if (prop?.properties) {
    Object.entries(prop.properties).forEach(([subKey, subProp]) => {
      if (subProp?.enum) {
        subChildren = subProp.enum.map((value) => ({
          name: value,
          key: `${name}.${subKey}.${value}`
        }));
      }
    });
  }

  if (subChildren.length === 0 && prop?.properties) {
    subChildren = Object.entries(prop.properties).map(([subKey, subProp]) => ({
      name: getChildLabel(subProp, subKey),
      key: `${name}.${subKey}`
    }));
  }

  return {
    name: getTopLevelLabel(meta, prop, name),
    key: name,
    taxonomy: meta?.taxonomy,
    children: subChildren.length > 0 ? subChildren : undefined
  };
}

function buildTaxonomyFromSchema(json) {
  const uiMeta = json._uiMeta || {};
  const uiGroups = json._uiGroups || {};
  const uiTaxonomyChildren = json._uiTaxonomyChildren || {};
  const schemaProps = json.properties || {};

  const map = {};
  Object.entries(uiMeta).forEach(([name, meta]) => {
    const prop = schemaProps[name];
    const label = getTopLevelLabel(meta, prop, name);
    if (meta?.color) map[label] = meta.color;
  });

  const topLevelNodes = Object.entries(uiMeta).map(([name, meta]) =>
    buildTopLevelNode(name, meta, schemaProps, uiTaxonomyChildren)
  );
  const groupedKeys = new Set(Object.values(uiGroups).flat());

  const groupedChildren = Object.entries(uiGroups)
    .map(([groupKey, keys]) => {
      const groupChildren = keys
        .map((key) => topLevelNodes.find((node) => node.key === key))
        .filter(Boolean);

      if (groupChildren.length === 0) return null;

      return {
        name: GROUP_LABELS[groupKey] || groupKey,
        key: groupKey,
        children: groupChildren
      };
    })
    .filter(Boolean);

  const ungroupedChildren = topLevelNodes.filter((node) => !groupedKeys.has(node.key));
  const rootChildren = [...ungroupedChildren, ...groupedChildren].map((node, index) => ({
    ...node,
    name: `${index + 1} ${node.name}`
  }));

  return {
    treeData: {
      name: 'Taxonomy',
      key: 'taxonomy-root',
      children: rootChildren
    },
    branchColorMap: map
  };
}

function getLayoutConfig(root, width) {
  const leafCount = root.leaves().length;
  const denseGraph = leafCount > 38;
  const outerPadding = Math.max(160, Math.min(230, Math.round(width * 0.15)));
  const radius = width / 2 - outerPadding;

  return {
    radius,
    siblingSeparation: denseGraph ? 2.9 : 2.6,
    branchSeparation: denseGraph ? 5.8 : 5.2,
    groupSeparation: denseGraph ? 9.6 : 8.6,
    leafFontSize: width < 1200 ? 9 : 10,
    midFontSize: width < 1200 ? 11 : 12,
    topFontSize: width < 1200 ? 12 : 13,
    labelOffset: width < 1200 ? 10 : 11
  };
}

function Taxonomy() {
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [svgNode, setSvgNode] = useState(null);
  const [labelStroke, setLabelStroke] = useState('black');
  const [isDownloading, setIsDownloading] = useState(false);
  const [colorMap, setColorMap] = useState({});
  const [chartSize, setChartSize] = useState(1400);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/sti-survey.schema.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Error loading schema data');
        return res.json();
      })
      .then((json) => {
        const { treeData, branchColorMap } = buildTaxonomyFromSchema(json);
        setColorMap(branchColorMap);
        setData(treeData);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return undefined;

    const updateSize = () => {
      const nextSize = Math.max(
        MIN_CHART_SIZE,
        Math.min(MAX_CHART_SIZE, Math.round(container.clientWidth * CHART_SCALE_FACTOR))
      );
      setChartSize((prev) => (prev === nextSize ? prev : nextSize));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const drawRadialTidyTree = useCallback(
    (treeData, container, size, strokeForLabel, branchColorMap = {}) => {
      const width = size;
      const root = d3.hierarchy(treeData);
      const {
        radius,
        siblingSeparation,
        branchSeparation,
        groupSeparation,
        leafFontSize,
        midFontSize,
        topFontSize,
        labelOffset
      } = getLayoutConfig(root, width);

      const topKey = (node) => {
        let current = node;
        while (current.depth > 1) current = current.parent;
        return current.data.key;
      };

      d3
        .cluster()
        .size([2 * Math.PI, radius])
        .separation((a, b) => {
          if (a.parent === b.parent) return siblingSeparation;
          if (topKey(a) === topKey(b)) return branchSeparation;
          return groupSeparation;
        })(root);

      // Force concentric depth rings: same depth => same distance from center.
      const maxDepth = d3.max(root.descendants(), (node) => node.depth) || 1;
      root.each((node) => {
        node.y = (node.depth / maxDepth) * radius;
      });

      const linkGenerator = d3.linkRadial().angle((d) => d.x).radius((d) => d.y);
      const labelColorMap = buildOrderedLabelColorMap(root);

      const svg = d3
        .create('svg')
        .attr('viewBox', [-width / 2, -width / 2, width, width])
        .attr('width', '100%')
        .attr('height', width)
        .attr('style', 'font: 12px ui-sans-serif, system-ui, sans-serif; background: none;');

      svg
        .append('g')
        .attr('fill', 'none')
        .attr('stroke-width', 1.35)
        .selectAll('path')
        .data(root.links())
        .join('path')
        .attr('d', linkGenerator)
        .attr('stroke', BASE_EDGE_COLOR)
        .attr('stroke-opacity', 0.72);

      svg
        .append('g')
        .selectAll('circle')
        .data(root.descendants())
        .join('circle')
        .attr('transform', (d) => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`)
        .attr('r', 2.6)
        .attr('fill', BASE_EDGE_COLOR)
        .attr('opacity', 0.95);

      svg
        .append('g')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-width', 2.8)
        .selectAll('text')
        .data(root.descendants())
        .join('text')
        .attr('transform', (d) =>
          `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0) rotate(${d.x >= Math.PI ? 180 : 0})`
        )
        .attr('dy', '0.31em')
        .attr('x', (d) => (d.x < Math.PI === !d.children ? labelOffset : -labelOffset))
        .attr('text-anchor', (d) => (d.x < Math.PI === !d.children ? 'start' : 'end'))
        .attr('paint-order', 'stroke')
        .attr('stroke', strokeForLabel)
        .attr('fill', (d) => {
          if (d.depth === 0) return isDownloading ? '#000000' : '#ffffff';
          return labelColorMap.get(d) || getBranchColor(d, branchColorMap);
        })
        .attr('font-size', (d) => {
          if (d.depth <= 1) return topFontSize;
          if (d.depth === 2) return midFontSize;
          return leafFontSize;
        })
        .attr('font-weight', 'bold')
        .text((d) => capitalizeFirstLetter(d.data.name));

      container.appendChild(svg.node());
      setSvgNode(svg.node());

      const nodeByKey = new Map(root.descendants().map((node) => [node.data.key, node]));
      const coreTaskNodes = CORE_TASK_KEYS.map((key) => nodeByKey.get(key)).filter(Boolean);
      const ctaNode = nodeByKey.get('coreTasks.cta');
      const cpaNode = nodeByKey.get('coreTasks.cpa');
      const ceaNode = nodeByKey.get('coreTasks.cea');
      const cneaNode = nodeByKey.get('coreTasks.cnea');

      const customLinksGroup = d3
        .select(svg.node())
        .append('g')
        .attr('fill', 'none')
        .attr('stroke', BASE_EDGE_COLOR)
        .attr('stroke-width', 1.25)
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-opacity', 0.82);

      const pairList = [
        ...coreTaskNodes.map((targetNode) => [nodeByKey.get('supportTasks.dataPreparation'), targetNode]),
        ...coreTaskNodes.map((targetNode) => [nodeByKey.get('supportTasks.columnClassification'), targetNode]),
        [nodeByKey.get('supportTasks.subjectDetection'), cpaNode],
        [nodeByKey.get('supportTasks.datatypeAnnotation'), cpaNode],
        [nodeByKey.get('supportTasks.entityLinking'), ctaNode],
        [nodeByKey.get('supportTasks.entityLinking'), ceaNode],
        [nodeByKey.get('supportTasks.typeAnnotation'), ctaNode],
        [nodeByKey.get('supportTasks.predicateAnnotation'), cpaNode],
        [nodeByKey.get('supportTasks.nilAnnotation'), cneaNode]
      ];

      pairList.forEach(([sourceNode, targetNode]) => {
        drawCurvedConnection(customLinksGroup, sourceNode, targetNode);
      });
    },
    [isDownloading]
  );

  useEffect(() => {
    if (!data || !chartRef.current) return;
    chartRef.current.innerHTML = '';
    drawRadialTidyTree(data, chartRef.current, chartSize, labelStroke, colorMap);
  }, [data, chartSize, labelStroke, colorMap, drawRadialTidyTree]);

  const handleDownloadSVG = useCallback(() => {
    if (!svgNode) return;
    setIsDownloading(true);
    setLabelStroke('white');
  }, [svgNode]);

  useEffect(() => {
    if (!isDownloading || !svgNode) return undefined;

    const timer = setTimeout(() => {
      const serializer = new XMLSerializer();
      const svgElement = chartRef.current?.querySelector('svg');
      if (!svgElement) return;

      let source = serializer.serializeToString(svgElement);
      if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
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
      setLabelStroke('black');
      setIsDownloading(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [isDownloading, svgNode]);

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-400 bg-red-900/20 border border-red-800 p-6 text-lg">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      <Navigation />
      <div className="flex-1 flex flex-col items-center justify-center py-10 md:py-12 px-1">
        <div className="w-full max-w-7xl flex flex-col items-center">
          <div className="w-full pb-4 mb-6 md:mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl text-neutral-100 font-bold tracking-tight mb-2">STI Approaches Taxonomy</h1>
              <p className="text-neutral-400 text-base">Hierarchical classification of STI approaches and methods</p>
            </div>
            <button
              onClick={handleDownloadSVG}
              className="flex items-center justify-center w-10 h-10 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-100 border border-indigo-500/30 hover:border-indigo-500/50 transition-all duration-200 shadow-lg"
              disabled={!svgNode}
              title="Download SVG"
            >
              <Icon name="download" className="text-lg" />
            </button>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <div ref={chartContainerRef} className="w-full min-w-[760px] flex justify-center items-center">
            <div ref={chartRef} className="w-full flex justify-center items-center" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Taxonomy;
