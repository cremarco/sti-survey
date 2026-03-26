import React, { useRef, useEffect } from 'react';
import * as d3 from "d3";
import useResizeObserver from '../../hooks/useResizeObserver';

const CORE_TASK_COLORS = ['#ffe4e6', '#fb7185', '#ef4444', '#991b1b'];
const CORE_TASK_DASH_PATTERNS = ['0', '12,4', '8,3', '4,3'];

const YearWiseCoreTasksChart = ({ data }) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const dimensions = useResizeObserver(containerRef);

  useEffect(() => {
    if (!data || data.length === 0 || !dimensions) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const tasks = ['cta', 'cpa', 'cea', 'cnea'];
    const legendRowHeight = 18;
    const legendHeight = tasks.length * legendRowHeight;
    const margin = { top: 22 + legendHeight, right: 30, left: 40, bottom: 50 };
    const width = Math.max(0, dimensions.width - margin.left - margin.right);
    const height = Math.max(220, Math.min(400, dimensions.height || 400) - margin.top - margin.bottom);

    if (width <= 0) return;

    const chartSvg = svg
      .append("svg")
      .attr("width", dimensions.width)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Process data: for each year, count CTA, CPA, CEA, CNEA
    const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
    
    // Create an array of objects { year, cta, cpa, ... }
    const chartData = years.map(year => {
        const yearData = data.filter(d => d.year === year);
        const result = { year };
        tasks.forEach(task => {
            result[task] = yearData.filter(d => d.coreTasks?.[task]).length;
        });
        return result;
    });

    const x = d3.scalePoint()
      .domain(years)
      .range([0, width]);

    const maxTaskCount = d3.max(chartData, d => Math.max(d.cta, d.cpa, d.cea, d.cnea)) || 0;
    const y = d3.scaleLinear()
      .domain([0, Math.max(1, maxTaskCount)])
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(tasks)
      .range(CORE_TASK_COLORS);

    // Define lines
    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.count));

    // Add lines for each task
    tasks.forEach((task, taskIndex) => {
        const taskData = chartData.map(d => ({ year: d.year, count: d[task] }));
        
        chartSvg.append("path")
            .datum(taskData)
            .attr("fill", "none")
            .attr("stroke", color(task))
            .attr("stroke-width", 2)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("stroke-dasharray", CORE_TASK_DASH_PATTERNS[taskIndex])
            .attr("d", line);
            
        // Add dots
        chartSvg.selectAll(`dot-${task}`)
            .data(taskData)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.count))
            .attr("r", 4)
            .attr("fill", color(task));
    });

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

    // Add Legend
    const legendItemWidth = Math.max(110, Math.min(150, Math.floor(width * 0.35)));
    const legendOffsetX = Math.max(0, width - legendItemWidth);
    const legendVerticalOffset = 8;

    const legend = chartSvg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 11)
        .attr("text-anchor", "start")
        .selectAll("g")
        .data(tasks)
        .enter().append("g")
        .attr("transform", (d, i) => `translate(${legendOffsetX},${-legendHeight + legendVerticalOffset + i * legendRowHeight})`);

    legend.append("line")
        .attr("x", 0)
        .attr("x2", 12)
        .attr("y1", 6)
        .attr("y2", 6)
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("stroke-dasharray", (d, i) => CORE_TASK_DASH_PATTERNS[i]);

    legend.append("circle")
        .attr("cx", 6)
        .attr("cy", 6)
        .attr("r", 3.2)
        .attr("fill", color);

    legend.append("text")
        .attr("x", 18)
        .attr("y", 6)
        .attr("dy", "0.32em")
        .style("fill", "#d1d5db")
        .text(d => d.toUpperCase());

  }, [data, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full flex justify-center items-center">
      <div ref={svgRef} />
    </div>
  );
};

export default YearWiseCoreTasksChart;
