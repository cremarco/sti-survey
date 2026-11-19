import * as d3 from 'd3';
import { pickYearLabels } from '../../lib/yearlyCounts.js';

// Shared by the website's chart and the paper SVG exporter.
export const SYSTEM_LEVEL_CRITERIA = {
  supervision: {
    label: 'SUPERVISION', filename: 'main-method-chart.svg',
    categories: ['Unsupervised', 'Supervised', 'Hybrid'],
    colors: ['#facc15', '#eab308', '#ca8a04'],
    value: row => row.mainMethod?.type,
  },
  domain: {
    label: 'DOMAIN', filename: 'domain-chart.svg',
    categories: ['Independent', 'Dependent'],
    labels: ['Domain-independent', 'Domain-dependent'],
    colors: ['#34d399', '#059669'],
    value: row => row.domain?.domain,
  },
  automation: {
    label: 'AUTOMATION', filename: 'automation-chart.svg',
    categories: ['Fully automated', 'Semi automated'],
    labels: ['Fully automated', 'Semi-automated'],
    colors: ['#4ade80', '#16a34a'],
    value: row => row.revision?.type,
  },
};

const escapeXml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[character]);

export function buildSystemLevelSeries(data, criterion) {
  const config = SYSTEM_LEVEL_CRITERIA[criterion];
  if (!config) throw new Error(`Unknown SYSTEM-LEVEL criterion: ${criterion}`);
  if (!data.length) return [];
  for (const row of data) {
    if (!Number.isInteger(row.year) || !config.categories.includes(config.value(row))) {
      throw new Error(`Missing or invalid ${config.label} coding: ${row.id}`);
    }
  }
  const extent = d3.extent(data, row => row.year);
  return d3.range(extent[0], extent[1] + 1).map(year => {
    const rows = data.filter(row => row.year === year);
    const counts = Object.fromEntries(config.categories.map(category => [
      category, rows.filter(row => config.value(row) === category).length,
    ]));
    return { year, total: rows.length, counts };
  });
}

/** Self-contained SVG, using the website's taxonomy palette and D3 scales. */
export function createSystemLevelSvg(data, {
  criterion = 'supervision', width = 821, height = 280,
  textColor = '#374151', panelLabel = '',
} = {}) {
  const config = SYSTEM_LEVEL_CRITERIA[criterion];
  const series = buildSystemLevelSeries(data, criterion);
  if (!series.length) return '';
  const narrow = width < 520;
  const fontSize = narrow ? 11 : 16;
  const margin = { top: narrow ? 104 : 82, right: 16, bottom: narrow ? 62 : 42, left: narrow ? 46 : 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = d3.scaleBand().domain(series.map(row => row.year)).range([0, plotWidth]).padding(0.12);
  const labelledYears = new Set(pickYearLabels(x.domain(), x.step(), narrow ? 28 : 36));
  const y = d3.scaleLinear().domain([0, 100]).range([plotHeight, 0]);
  const title = `${panelLabel ? `${panelLabel} ` : ''}${config.label}`;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(config.label)}: annual percentages" data-criterion="${criterion}" data-publications="${data.length}">`,
    `<title>${escapeXml(title)}: annual distribution of ${data.length} reviewed publications</title>`,
    `<g font-family="sans-serif" fill="${textColor}">`,
    `<text x="${margin.left}" y="23" font-size="${narrow ? 14 : 19}" font-weight="600">${escapeXml(title)}</text>`,
  ];
  let legendX = margin.left;
  config.categories.forEach((category, index) => {
    const label = config.labels?.[index] ?? category;
    const legendY = narrow ? 44 + index * 17 : 47;
    const position = narrow ? margin.left : legendX;
    parts.push(`<rect x="${position}" y="${legendY - 11}" width="11" height="11" fill="${config.colors[index]}"/>`);
    parts.push(`<text x="${position + 17}" y="${legendY}" font-size="${fontSize}">${escapeXml(label)}</text>`);
    legendX += (label.length * 0.58 + 4) * fontSize;
  });
  parts.push(`<g transform="translate(${margin.left},${margin.top})">`);
  for (const tick of [0, 50, 100]) {
    parts.push(`<line x1="0" x2="${plotWidth}" y1="${y(tick)}" y2="${y(tick)}" stroke="${textColor}" stroke-opacity="0.18"/>`);
    parts.push(`<text x="-7" y="${y(tick)}" dy="0.32em" text-anchor="end" font-size="${fontSize}">${tick}%</text>`);
  }
  for (const row of series) {
    let cumulative = 0;
    const center = x(row.year) + x.bandwidth() / 2;
    config.categories.forEach((category, index) => {
      const count = row.counts[category];
      const percentage = row.total ? 100 * count / row.total : 0;
      if (count) {
        parts.push(`<rect x="${x(row.year)}" y="${y(cumulative + percentage)}" width="${x.bandwidth()}" height="${y(cumulative) - y(cumulative + percentage)}" fill="${config.colors[index]}" stroke="white" stroke-width="0.5" data-year="${row.year}" data-category="${escapeXml(category)}" data-count="${count}" data-percentage="${percentage}"><title>${escapeXml(category)} (${row.year}): ${count}/${row.total} (${percentage.toFixed(1)}%)</title></rect>`);
      }
      cumulative += percentage;
    });
    parts.push(`<text x="${center}" y="-7" text-anchor="middle" font-size="${fontSize}" data-year="${row.year}" data-total="${row.total}">${row.total}</text>`);
    if (labelledYears.has(row.year)) {
      const labelPosition = narrow
        ? `transform="translate(${center},${plotHeight + 15}) rotate(-60)" text-anchor="end"`
        : `x="${center}" y="${plotHeight + 20}" text-anchor="middle"`;
      parts.push(`<text data-year-label="${row.year}" ${labelPosition} font-size="${narrow ? 10 : 14}">${row.year}</text>`);
    }
  }
  parts.push(`<line x1="0" x2="${plotWidth}" y1="${plotHeight}" y2="${plotHeight}" stroke="${textColor}"/>`);
  parts.push('</g>');
  parts.push(`<text x="${margin.left + plotWidth / 2}" y="${height - 3}" text-anchor="middle" font-size="${fontSize}">Publication year</text>`);
  parts.push('</g></svg>');
  return parts.join('');
}
