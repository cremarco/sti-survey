import React, { useRef, useEffect } from 'react';
import * as d3 from "d3";
import useResizeObserver from '../../hooks/useResizeObserver';

/**
 * Main Method Stacked Chart Component
 * 
 * Creates a stacked bar chart showing the distribution of main method types over years
 * using D3.js for data visualization. Adapts to container width.
 */
const MainMethodStackedChart = ({ data }) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const dimensions = useResizeObserver(containerRef);

  useEffect(() => {
    if (!data || data.length === 0 || !dimensions) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const methodTypes = ['Unsupervised', 'Supervised', 'Hybrid'];
    const legendRowHeight = 18;
    const legendHeight = methodTypes.length * legendRowHeight;
    const margin = { top: 22 + legendHeight, right: 30, left: 40, bottom: 50 };
    const width = dimensions.width - margin.left - margin.right;
    const height = Math.min(400, dimensions.height || 400) - margin.top - margin.bottom;

    const chartSvg = svg
      .append("svg")
      .attr("width", dimensions.width)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Process data for stacked chart
    const years = [...new Set(data.map(d => d.year))].sort();
    const stackedData = years.map(year => {
      const yearData = data.filter(d => d.year === year);
      const result = { year };
      methodTypes.forEach(type => {
        result[type] = yearData.filter(d => d['mainMethod']?.type === type).length;
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
      .range(['#facc15', '#eab308', '#ca8a04']);

    const legendItemWidth = Math.max(120, Math.min(170, Math.floor(width * 0.35)));
    const legendOffsetX = Math.max(0, width - legendItemWidth);
    const legendVerticalOffset = 8;

    const legend = chartSvg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 11)
      .attr("text-anchor", "start")
      .selectAll("g")
      .data(methodTypes)
      .join("g")
      .attr("transform", (d, i) => `translate(${legendOffsetX},${-legendHeight + legendVerticalOffset + i * legendRowHeight})`);

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
      .style("fill", "#d1d5db")
      .text(d => d);

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
      .attr("y", height + margin.bottom - 10)
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

  }, [data, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full flex justify-center items-center">
      <div ref={svgRef} />
    </div>
  );
};

export default MainMethodStackedChart;
