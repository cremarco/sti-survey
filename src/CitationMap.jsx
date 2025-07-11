import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

function CitationMap() {
  const chartRef = useRef();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/data@3.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Errore nel caricamento dei dati');
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data || !chartRef.current) return;
    // Pulizia
    chartRef.current.innerHTML = '';

    // --- D3 Chord Chart ---
    const width = 1180;
    const height = width + 150;
    const innerRadius = Math.min(width, height) * 0.5 - 200;
    const outerRadius = innerRadius + 10;
    const chordPadAngle = 8 / innerRadius;

    function fade(opacity) {
      return function (d, i) {
        const indexes = [];
        edges
          .filter(function (d) {
            if (d.source.index === i.index || d.target.index === i.index) indexes.push(d.source.index, d.target.index);
            return d.source.index !== i.index && d.target.index !== i.index;
          })
          .attr('fill-opacity', opacity);
        path
          .filter(function (d) {
            return indexes.indexOf(d.index) === -1;
          })
          .attr('fill-opacity', opacity);
      };
    }

    const fd = (str) => {
      const parsed = Date.parse(str);
      const date = new Date(parsed);
      return date.getFullYear();
    };

    // Compute a dense matrix from the weighted links in data.
    const names = d3.sort(
      d3.union(
        data.map((d) => `${d.source} ${fd(d.source_date)}`).filter((name) => name !== ' NaN'),
        data.map((d) => `${d.target} ${fd(d.target_date)}`)
      )
    );
    const index = new Map(names.map((name, i) => [name, i]));

    const dict = new Map();
    data.forEach((datum) => {
      if (datum.type === 'evolve') {
        dict.set(index.get(`${datum.target} ${fd(datum.target_date)}`), `${datum.source} ${fd(datum.source_date)}`);
      }
    });

    const matrix = Array.from(index, () => new Array(names.length).fill(0));
    for (const { source, target, source_date, target_date, value } of data) {
      if (source === '') continue;
      matrix[index.get(`${source} ${fd(source_date)}`)][index.get(`${target} ${fd(target_date)}`)] += value;
    }

    const chord = d3.chordDirected()
      .padAngle(chordPadAngle)
      .sortSubgroups(d3.descending)
      .sortChords(d3.descending);

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const selectingArea = d3.arc()
      .startAngle((d) => d.startAngle - chordPadAngle / 2)
      .endAngle((d) => d.endAngle + chordPadAngle / 2)
      .innerRadius(innerRadius)
      .outerRadius(outerRadius + 200);
    const ribbon = d3.ribbon().radius(innerRadius + 1).padAngle(0);
    const colors = d3.quantize(d3.interpolateRainbow, names.length);

    const svg = d3
      .create('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [-width / 2, -height / 2, width, height])
      .attr('style', 'width: 100%; height: auto; font: 10px sans-serif;');

    const chords = chord(matrix);

    const group = svg
      .append('g')
      .selectAll()
      .data(chords.groups)
      .join('g')
      .attr('class', (d) => `group-${d.index}`);

    const path = group
      .append('path')
      .attr('fill', (d) => colors[d.index])
      .attr('d', arc);

    const label = group
      .append('text')
      .each((d) => (d.angle = (d.startAngle + d.endAngle) / 2))
      .attr('dy', '0.35em')
      .attr('transform', (d) => `
        rotate(${(d.angle * 180) / Math.PI - 90})
        translate(${outerRadius + 5})
        ${d.angle > Math.PI ? 'rotate(180)' : ''}
      `)
      .attr('text-anchor', (d) => (d.angle > Math.PI ? 'end' : null))
      .attr('fill', '#e5e7eb') // Tailwind text-gray-200
      .each(function(d) {
        const g = d3.select(this);
        g.append('tspan')
          .attr('font-weight', 'bold')
          .text(names[d.index]);
        if (dict.get(d.index)) {
          g.append('tspan')
            .attr('dx', 4)
            .attr('font-weight', 'normal')
            .text(` ≪ ${dict.get(d.index)}`);
        }
      });

    const area = group
      .append('path')
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .attr('d', selectingArea)
      .on('mouseover', fade(0))
      .on('mouseout', fade(1));

    group
      .append('title')
      .text(
        (d) => `${names[d.index]}
${d3.sum(chords, (c) => (c.source.index === d.index) * c.source.value)} Cited →
${d3.sum(chords, (c) => (c.target.index === d.index) * c.source.value)} Citing ←`
      );

    const edges = svg
      .append('g')
      .selectAll()
      .data(chords)
      .join('path')
      .attr('mix-blend-mode', 'darken')
      .attr('class', 'edges')
      .attr('d', ribbon)
      .attr('fill', (d) => colors[d.source.index]);

    edges
      .append('title')
      .text((d) => `${names[d.source.index]} → ${names[d.target.index]} ${d.source.value}`);

    chartRef.current.appendChild(svg.node());
    // --- END D3 Chord Chart ---
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-300 text-lg">Caricamento dati...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-6 text-lg">Errore: {error}</span>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center py-8">
      <h1 className="text-3xl text-gray-200 font-bold mb-6">Citation Map</h1>
      <div ref={chartRef} className="w-full flex justify-center items-center" style={{ minHeight: 700 }} />
    </div>
  );
}

export default CitationMap; 