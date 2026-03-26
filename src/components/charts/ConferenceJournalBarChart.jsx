import React, { useRef, useEffect } from 'react';
import * as d3 from "d3";
import useResizeObserver from '../../hooks/useResizeObserver';

/**
 * Conference Journal Bar Chart Component
 * 
 * Creates a horizontal bar chart showing the distribution of approaches by conference/journal
 * using D3.js for data visualization. Adapts to container width.
 */
function getMonochromeShade(baseColor, index, total) {
  const base = d3.hsl(baseColor);
  const ratio = total <= 1 ? 1 : 1 - index / (total - 1);
  const lightness = 0.34 + ratio * 0.34;
  const saturation = 0.56 + ratio * 0.36;
  return d3.hsl(base.h, saturation, lightness).formatHex();
}

const ConferenceJournalBarChart = ({
  data,
  total,
  barColor = "#06b6d4",
  labelColor = "#bae6fd",
  showLegend = false,
  useCategoryColors = false
}) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const dimensions = useResizeObserver(containerRef);

  useEffect(() => {
    if (!data || Object.keys(data).length === 0 || !dimensions) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Sort data by count and filter venues with count >= 2
    const entries = Object.entries(data);
    const venuesWithAtLeast2 = entries.filter(([, count]) => count >= 2);
    const venuesWith1 = entries.filter(([, count]) => count === 1);
    const sortedData = venuesWithAtLeast2.sort(([, a], [, b]) => b - a);

    // Add 'other' column if there are venues with count 1
    if (venuesWith1.length > 0) {
      sortedData.push([
        `other (${venuesWith1.length})`,
        1 // The bar value is 1, since each of those venues has value 1
      ]);
    }

    const legendRowHeight = 16;
    const maxLegendItems = 8;
    const legendEntries = showLegend
      ? sortedData.slice(0, maxLegendItems).map(([label]) => ({ label }))
      : [];
    if (showLegend && sortedData.length > maxLegendItems) {
      legendEntries.push({ label: `+${sortedData.length - maxLegendItems} more`, isOverflow: true });
    }

    const legendHeight = showLegend ? legendEntries.length * legendRowHeight + 8 : 0;
    const margin = { top: 20 + legendHeight, right: 30, left: 40, bottom: 60 };
    const width = dimensions.width - margin.left - margin.right;
    const height = Math.max(180, Math.min(400, dimensions.height || 400) - margin.top - margin.bottom);

    const chartSvg = svg
      .append("svg")
      .attr("width", dimensions.width)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(sortedData.map(d => d[0]))
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(sortedData, d => d[1])])
      .range([height, 0]);

    const barColorScale = d3
      .scaleOrdinal()
      .domain(sortedData.map(([label]) => label))
      .range(
        sortedData.map((_, index) =>
          useCategoryColors ? getMonochromeShade(barColor, index, sortedData.length) : barColor
        )
      );

    // Add bars
    chartSvg.selectAll("rect")
      .data(sortedData)
      .join("rect")
      .attr("x", d => x(d[0]))
      .attr("y", d => y(d[1]))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d[1]))
      .attr("fill", d => barColorScale(d[0]));

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

    if (showLegend && legendEntries.length > 0) {
      const legendItemWidth = Math.max(130, Math.min(220, Math.floor(width * 0.48)));
      const legendOffsetX = Math.max(0, width - legendItemWidth);
      const legendStartY = -legendHeight + 8;

      const legend = chartSvg
        .append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 11)
        .attr("text-anchor", "start")
        .selectAll("g")
        .data(legendEntries)
        .join("g")
        .attr("transform", (d, i) => `translate(${legendOffsetX},${legendStartY + i * legendRowHeight})`);

      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", 1)
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", (d) => (d.isOverflow ? "#6b7280" : barColorScale(d.label)));

      legend
        .append("text")
        .attr("x", 14)
        .attr("y", 6)
        .attr("dy", "0.32em")
        .style("fill", "#d1d5db")
        .text((d) => d.label);
    }

  }, [data, total, barColor, labelColor, dimensions, showLegend, useCategoryColors]);

  return (
    <div ref={containerRef} className="w-full h-full flex justify-center items-center">
      <div ref={svgRef} />
    </div>
  );
};

export default ConferenceJournalBarChart;
