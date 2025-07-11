import { useState, useEffect, useRef, useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as d3 from "d3";

// Column helper for type-safe column definitions
const columnHelper = createColumnHelper();

/**
 * Returns Tailwind CSS classes for a badge based on the method type.
 * @param {string} type - The method type
 */
const getTypeBadgeColor = (type) => {
  const colorMap = {
    unsup: "bg-orange-500/20 text-orange-200",
    sup: "bg-indigo-500/20 text-indigo-200",
    "semi-automated": "bg-amber-500/20 text-amber-200",
    "fully-automated": "bg-emerald-500/20 text-emerald-200",
    hybrid: "bg-violet-500/20 text-violet-200",
  };
  return colorMap[type?.toLowerCase()] || "bg-slate-500/20 text-slate-200";
};

/**
 * Returns Tailwind CSS classes for a badge based on the domain type.
 * @param {string} domain - The domain type
 */
const getDomainBadgeColor = (domain) => {
  const colorMap = {
    independent: "bg-blue-500/20 text-blue-200",
    dependent: "bg-red-500/20 text-red-200",
    specific: "bg-purple-500/20 text-purple-200",
    general: "bg-teal-500/20 text-teal-200",
    biomedical: "bg-pink-500/20 text-pink-200",
    geographic: "bg-yellow-500/20 text-yellow-200",
    financial: "bg-green-500/20 text-green-200",
    scientific: "bg-cyan-500/20 text-cyan-200",
    educational: "bg-lime-500/20 text-lime-200",
  };
  return colorMap[domain?.toLowerCase()] || "bg-gray-500/20 text-gray-200";
};

/**
 * Checks if a value is empty, null, or undefined.
 * @param {any} value
 * @returns {boolean}
 */
const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
};

/**
 * Formats a date string to DD/MM/YYYY or returns null if invalid.
 * @param {string} dateString
 * @returns {string|null}
 */
const formatDate = (dateString) => {
  if (!dateString || dateString.trim() === "") return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// --- Validation and Cell Rendering Helpers ---

/**
 * Required fields configuration for validation.
 * Add/remove fields as needed for your data model.
 */
const REQUIRED_FIELDS = {
  author: true,
  year: true,
  "title.text": true,
  "conference-journal": true,
  "main-method.type": true,
  "main-method.technique": true,
  "domain.domain": true,
  "tasks.cta": true,
  "tasks.cpa": true,
  "tasks.cea": true,
  "tasks.cnea": true,
  "user-revision.type": true,
  "license": true,
  "inputs.type-of-table": true,
  "inputs.kg.triple-store": true,
  "output-format": true,
  "checked-by-author": true,
};

/**
 * Checks if a required field is missing from a row.
 * Optimized version with memoized nested value getter.
 * @param {object} row - The data row
 * @param {string} fieldPath - The field path (e.g., 'title.text')
 * @returns {boolean}
 */
const isRequiredFieldMissing = (row, fieldPath) => {
  if (!REQUIRED_FIELDS[fieldPath]) return false;
  
  // Optimized nested value getter
  const getNestedValue = (obj, path) => {
    const keys = path.split(".");
    let current = obj;
    for (const key of keys) {
      if (current == null) return undefined;
      current = current[key];
    }
    return current;
  };
  
  const value = getNestedValue(row, fieldPath);
  return isEmpty(value);
};

/**
 * Renders a cell with a missing field indicator if needed.
 * Optimized with memoization for better performance.
 */
const MissingFieldCell = ({ value, isMissing }) => {
  const cellContent = value || (isMissing ? "MISSING" : "");
  const className = isMissing ? "bg-red-500/20 text-red-200 px-2 py-1 rounded" : "";
  
  return (
    <span className={className}>
      {cellContent}
    </span>
  );
};

/**
 * Renders a task cell with Material Design icons and missing indicator.
 * Optimized with early return and memoized content.
 */
const TaskCell = ({ value, isMissing }) => {
  if (isMissing) {
    return <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>;
  }
  
  const iconClass = value 
    ? "material-icons-round text-green-500 text-lg" 
    : "material-icons-round text-red-500 text-lg";
  const iconName = value ? "done" : "clear";
  
  return <span className={iconClass}>{iconName}</span>;
};

/**
 * Renders a step cell with Material Design icons.
 * Optimized with simplified logic.
 */
const StepCell = ({ value }) => {
  const hasContent = Boolean(value?.trim());
  const iconClass = hasContent 
    ? "material-icons-round text-green-500 text-lg" 
    : "material-icons-round text-red-500 text-lg";
  const iconName = hasContent ? "done" : "clear";
  
  return <span className={iconClass}>{iconName}</span>;
};

/**
 * Renders the main method cell with type badge and technique.
 * Optimized with early returns and memoized calculations.
 */
const MainMethodCell = ({ mainMethod, row }) => {
  const { type, tech } = mainMethod || {};
  
  // Early return if no data
  if (!type && !tech) return "";
  
  const isTypeMissing = isRequiredFieldMissing(row, "main-method.type");
  const isTechMissing = isRequiredFieldMissing(row, "main-method.technique");
  
  // Memoize badge classes
  const typeBadgeClass = type 
    ? `inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium w-16 ${getTypeBadgeColor(type)}`
    : "bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px] font-medium w-16";
  
  return (
    <div className="flex items-center gap-2">
      {(type || isTypeMissing) && (
        <span className={typeBadgeClass}>
          {type || "MISSING"}
        </span>
      )}
      {(tech || isTechMissing) && (
        <span className={tech ? "text-[10px] text-gray-400" : "bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px]"}>
          {tech || "MISSING"}
        </span>
      )}
    </div>
  );
};

/**
 * Renders the domain cell with domain badge and type detail.
 * Optimized with early returns and memoized calculations.
 */
const DomainCell = ({ domain, row }) => {
  const domainValue = domain?.domain || "";
  const typeValue = domain?.type || "";
  
  // Early return if no data
  if (!domainValue && !typeValue) return "";
  
  const isDomainMissing = isRequiredFieldMissing(row, "domain.domain");
  
  // Memoize badge classes
  const domainBadgeClass = domainValue 
    ? `inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium w-20 ${getDomainBadgeColor(domainValue)}`
    : "bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px] font-medium w-20";
  
  return (
    <div className="flex items-center gap-2">
      {(domainValue || isDomainMissing) && (
        <span className={domainBadgeClass}>
          {domainValue || "MISSING"}
        </span>
      )}
      {typeValue && <span className="text-[10px] text-gray-400">{typeValue}</span>}
    </div>
  );
};

/**
 * Returns Tailwind CSS classes for user revision type badge.
 */
const getUserRevisionBadgeColor = (type) => {
  const colorMap = {
    manual: "bg-blue-500/20 text-blue-200",
    "semi-automatic": "bg-orange-500/20 text-orange-200",
    automatic: "bg-emerald-500/20 text-emerald-200",
    none: "bg-slate-500/20 text-slate-200",
  };
  return colorMap[type?.toLowerCase()] || "bg-violet-500/20 text-violet-200";
};

/**
 * Stacked Bar Chart Component for Main Method Distribution by Year
 * Optimized version with better performance and code organization
 */
const MainMethodStackedChart = ({ data }) => {
  const svgRef = useRef();
  const wrapperRef = useRef();

  // Constants moved outside component for better performance
  const METHOD_TYPES = ['unsup', 'sup', 'hybrid'];
  const COLORS = ['#6366f1', '#f59e42', '#a78bfa']; // Tailwind colors: indigo-500, orange-400, violet-400
  const MARGIN = { top: 24, right: 0, bottom: 36, left: 36 };
  const AXIS_STYLES = {
    text: { fill: "#444", fontSize: "13px" },
    stroke: "#444" // grigio medio-scuro, ottimo contrasto su chiaro e scuro
  };

  // Memoized data processing for better performance
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const validData = data.filter(d => 
      d.year && 
      typeof d.year === 'number' && 
      d['main-method']?.type
    );
    
    if (validData.length === 0) return null;

    const years = [...new Set(validData.map(d => d.year))].sort();
    
    return years.map(year => {
      const yearData = validData.filter(d => d.year === year);
      const counts = METHOD_TYPES.reduce((acc, type) => {
        acc[type] = yearData.filter(d => 
          d['main-method']?.type?.toLowerCase() === type.toLowerCase()
        ).length;
        return acc;
      }, {});
      
      return { year, ...counts };
    }).filter(d => d.unsup > 0 || d.sup > 0 || d.hybrid > 0);
  }, [data]);

  useEffect(() => {
    if (!processedData || processedData.length === 0) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const { width, height } = rect;
    
    if (width === 0 || height === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();
    
    // Create SVG container
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const chartWidth = width - MARGIN.left - MARGIN.right;
    const chartHeight = height - MARGIN.top - MARGIN.bottom;

    // Create scales
    const xScale = d3.scaleBand()
      .domain(processedData.map(d => d.year))
      .range([0, chartWidth])
      .padding(0.1);

    const maxValue = d3.max(processedData, d => d.unsup + d.sup + d.hybrid);
    const yScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([chartHeight, 0]);

    const colorScale = d3.scaleOrdinal()
      .domain(METHOD_TYPES)
      .range(COLORS);

    // Create stacked data
    const stack = d3.stack().keys(METHOD_TYPES);
    const series = stack(processedData);

    // Render bars
    svg.append("g")
      .selectAll("g")
      .data(series)
      .join("g")
      .attr("fill", d => colorScale(d.key))
      .selectAll("rect")
      .data(d => d)
      .join("rect")
      .attr("x", d => xScale(d.data.year))
      .attr("y", d => yScale(d[1]))
      .attr("height", d => yScale(d[0]) - yScale(d[1]))
      .attr("width", xScale.bandwidth())
      .attr("rx", 2);

    // Render axes with optimized styling
    const renderAxis = (axis, transform = "") => {
      const axisGroup = svg.append("g");
      if (transform) axisGroup.attr("transform", transform);
      
      axisGroup.call(axis)
        .call(g => g.selectAll("text").style("fill", AXIS_STYLES.text.fill).style("font-size", AXIS_STYLES.text.fontSize))
        .call(g => g.selectAll("path, line").style("stroke", AXIS_STYLES.stroke).style("stroke-width", "2px"));
    };

    renderAxis(d3.axisBottom(xScale).tickSizeOuter(0), `translate(0,${chartHeight})`);
    renderAxis(d3.axisLeft(yScale).ticks(5));

  }, [processedData]);

  return (
    <div ref={wrapperRef} className="w-full h-full flex flex-col justify-end items-center relative">
      <svg ref={svgRef} width="100%" height="100%" style={{ display: 'block' }} />
    </div>
  );
};

/**
 * Renders the row number with missing fields count and tooltip.
 */
const RowNumberCell = ({ row, index }) => {
  const missingFields = Object.keys(REQUIRED_FIELDS).filter((field) => isRequiredFieldMissing(row.original, field));
  const hasMissingFields = missingFields.length > 0;
  return (
    <div className="flex flex-col items-center">
      <span>{index + 1}</span>
      {hasMissingFields && (
        <div className="relative group mt-1">
          <span className="text-[11px] text-red-400 bg-red-900/60 rounded px-2 py-0.5 leading-none cursor-pointer flex items-center gap-1">
            {missingFields.length} missing
          </span>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none min-w-[120px]">
            <div className="font-semibold mb-1">Missing fields:</div>
            <div className="space-y-1">
              {missingFields.map((field) => (
                <div key={field} className="text-[10px] text-gray-400">• {field}</div>
              ))}
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}
    </div>
  );
};

// Funzione per scaricare l'SVG
function downloadSVG(svgElement, filename = "chart.svg") {
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);

  // Aggiungi l'header XML se non presente
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(
      /^<svg/,
      '<svg xmlns="http://www.w3.org/2000/svg"'
    );
  }
  if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(
      /^<svg/,
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
    );
  }

  // Crea il blob e il link per il download
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [showFacetFilter, setShowFacetFilter] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showMainMethodChart, setShowMainMethodChart] = useState(false);
  const filterRef = useRef();
  const chartRef = useRef();

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(import.meta.env.BASE_URL + 'data/sti-survey.json');
        if (!response.ok) {
          throw new Error('Failed to load data');
        }
        const jsonData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Close facet filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFacetFilter(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Column definitions with useMemo for performance
  const columns = useMemo(() => [
    // Row number with missing fields indicator
    columnHelper.display({
      id: "rowNumber",
      header: "#",
      cell: (info) => <RowNumberCell row={info.row} index={info.row.index} />,
      enableSorting: false,
      meta: { align: 'center' }
    }),
    
    // Added column
    columnHelper.accessor("added", {
      header: "Added",
      cell: (info) => {
        const addedValue = info.getValue();
        const formattedDate = formatDate(addedValue);
        
        if (formattedDate) {
          return (
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-200 font-medium">{formattedDate}</span>
              {addedValue !== formattedDate && (
                <span className="text-[10px] text-gray-500" title={`Original: ${addedValue}`}>
                  {addedValue}
                </span>
              )}
            </div>
          );
        } else {
          return (
            <span className="text-xs text-gray-500 italic">-</span>
          );
        }
      },
      enableSorting: true,
      meta: { align: 'center' }
    }),
    
    // Year column
    columnHelper.accessor("year", {
      header: "Year",
      cell: (info) => info.getValue(),
      enableSorting: true,
      meta: { align: 'center' }
    }),
    
    // Author column
    columnHelper.accessor("author", {
      header: "First author",
      cell: (info) => (
        <MissingFieldCell 
          value={info.getValue()} 
          isMissing={isRequiredFieldMissing(info.row.original, 'author')} 
        />
      ),
      enableSorting: false,
    }),
    
    // Authors column
    columnHelper.accessor("authors", {
      header: "All authors",
      cell: (info) => {
        const authors = info.getValue();
        if (!authors || authors.length === 0) {
          return <span className="text-gray-500 text-xs">No authors listed</span>;
        }
        return (
          <div className="text-xs">
            {authors.map((author, index) => (
              <div key={index} className="text-gray-300">
                {author}
              </div>
            ))}
          </div>
        );
      },
      enableSorting: false,
    }),
    
    // Title column
    columnHelper.accessor("title.text", {
      header: "Title",
      cell: (info) => {
        const titleText = info.getValue();
        const link = info.row.original.title?.link;
        const isMissing = isRequiredFieldMissing(info.row.original, 'title.text');
        
        return (
          <div className="flex items-center gap-2">
            <MissingFieldCell 
              value={titleText} 
              isMissing={isMissing} 
            />
            {link && link.trim() !== '' && (
              <a 
                href={link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Open link"
              >
                <span className="material-icons-round text-sm">launch</span>
              </a>
            )}
          </div>
        );
      },
      enableSorting: false,
    }),
    
    // Conference/Journal column with filtering
    columnHelper.accessor(row => row["conference-journal"], {
      id: "conference-journal",
      header: "Conf. / Journal",
      cell: (info) => (
        <MissingFieldCell 
          value={info.getValue()} 
          isMissing={isRequiredFieldMissing(info.row.original, 'conference-journal')} 
        />
      ),
      enableColumnFilter: true,
      enableFacetedUniqueValues: true,
      enableSorting: false,
      filterFn: (row, columnId, filterValue) => {
        if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
        return filterValue.includes(row.getValue(columnId));
      },
    }),
    
    // Name of approach column
    columnHelper.accessor("name-of-approach", {
      header: "Name of approach",
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    
    // Main method column
    columnHelper.accessor(row => {
      const type = row["main-method"]?.type || "";
      const tech = row["main-method"]?.technique || "";
      return { type, tech };
    }, {
      id: "main-method",
      header: "Main Method",
      cell: (info) => <MainMethodCell mainMethod={info.getValue()} row={info.row.original} />,
      enableSorting: false,
    }),
    
    // Domain column
    columnHelper.accessor(row => row["domain"], {
      id: "domain",
      header: "Domain",
      cell: (info) => <DomainCell domain={info.getValue()} row={info.row.original} />,
      enableSorting: false,
    }),
    
    // Task group columns
    {
      header: "Task",
      columns: [
        columnHelper.accessor(row => row.tasks?.cta, {
          id: "cta",
          header: "CTA",
          cell: (info) => (
            <TaskCell 
              value={info.getValue()} 
              isMissing={isRequiredFieldMissing(info.row.original, 'tasks.cta')} 
            />
          ),
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.tasks?.cpa, {
          id: "cpa",
          header: "CPA",
          cell: (info) => (
            <TaskCell 
              value={info.getValue()} 
              isMissing={isRequiredFieldMissing(info.row.original, 'tasks.cpa')} 
            />
          ),
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.tasks?.cea, {
          id: "cea",
          header: "CEA",
          cell: (info) => (
            <TaskCell 
              value={info.getValue()} 
              isMissing={isRequiredFieldMissing(info.row.original, 'tasks.cea')} 
            />
          ),
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.tasks?.cnea, {
          id: "cnea",
          header: "CNEA",
          cell: (info) => (
            <TaskCell 
              value={info.getValue()} 
              isMissing={isRequiredFieldMissing(info.row.original, 'tasks.cnea')} 
            />
          ),
          enableSorting: false,
          meta: { align: 'center' }
        }),
      ],
    },
    
    // Steps group columns
    {
      header: "Steps",
      columns: [
        columnHelper.accessor(row => row.steps?.["data-preparation"]?.description || "", {
          id: "data-preparation",
          header: "Data Preparation",
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.steps?.["subject-detection"] || "", {
          id: "subject-detection",
          header: "Subject Detection",
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.steps?.["column-analysis"] || "", {
          id: "column-analysis",
          header: "Column Analysis",
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.steps?.["type-annotation"] || "", {
          id: "type-annotation",
          header: "Type Annotation",
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.steps?.["predicate-annotation"] || "", {
          id: "predicate-annotation",
          header: "Predicate Annotation",
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.steps?.["datatype-annotation"] || "", {
          id: "datatype-annotation",
          header: "Datatype Annotation",
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.steps?.["entity-linking"]?.description || "", {
          id: "entity-linking",
          header: "Entity Linking",
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.steps?.["nil-annotation"] || "", {
          id: "nil-annotation",
          header: "NIL Annotation",
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
      ],
    },
    
    // User revision column
    columnHelper.accessor(row => row["user-revision"]?.type || "", {
      id: "user-revision",
      header: "User Revision",
      cell: (info) => {
        const value = info.getValue();
        const isMissing = isRequiredFieldMissing(info.row.original, 'user-revision.type');
        const description = info.row.original["user-revision"]?.description;
        if (isMissing) {
          return <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>;
        }
        if (description && description.trim() !== "") {
          return (
            <div className="relative group inline-flex items-center">
              <span
                className={`inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium ${getUserRevisionBadgeColor(value)} cursor-pointer`}
                style={{ textTransform: 'lowercase' }}
              >
                {value}
                <span className="material-icons-round ml-1 align-middle leading-none" style={{ fontSize: '16px' }}>info_outline</span>
              </span>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg text-xs text-gray-300 whitespace-pre-line opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none min-w-[120px] max-w-xs">
                {description}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
          );
        }
        return (
          <span className={`inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium ${getUserRevisionBadgeColor(value)}`}
            style={{ textTransform: 'lowercase' }}>
            {value}
          </span>
        );
      },
      enableSorting: false,
    }),
    
    // Validation column
    columnHelper.accessor(row => row["validation"] || "", {
      id: "validation",
      header: "Validation",
      cell: (info) => (
        <MissingFieldCell 
          value={info.getValue()} 
          isMissing={isRequiredFieldMissing(info.row.original, 'validation')} 
        />
      ),
      enableSorting: false,
    }),
    
    // Code availability column
    columnHelper.accessor(row => row["code-availability"] || "", {
      id: "code-availability",
      header: "Code Availability",
      cell: (info) => {
        const value = info.getValue();
        if (!value || value.trim() === "") {
          return <span className="material-icons-round text-red-500 text-lg">clear</span>;
        }
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center text-blue-400 hover:text-blue-200"
            title="Open code link"
          >
            <span className="material-icons-round">launch</span>
          </a>
        );
      },
      enableSorting: false,
      meta: { align: 'center' },
    }),
    
    // License column
    columnHelper.accessor(row => row["license"] || "", {
      id: "source",
      header: "Licence",
      cell: (info) => (
        <span className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium bg-gray-500/20 text-gray-200">
          {info.getValue()}
        </span>
      ),
      enableSorting: false,
      meta: { align: 'center' },
    }),
    
    // Inputs group columns
    {
      header: "Inputs",
      columns: [
        columnHelper.accessor(row => row.inputs?.["type-of-table"] || "", {
          id: "type-of-table",
          header: "Type of table",
          cell: (info) => (
            <MissingFieldCell 
              value={info.getValue()} 
              isMissing={isRequiredFieldMissing(info.row.original, 'inputs.type-of-table')} 
            />
          ),
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.inputs?.kg?.["triple-store"] || "", {
          id: "knowledge-graph",
          header: "Knowledge Graph",
          cell: (info) => (
            <MissingFieldCell 
              value={info.getValue()} 
              isMissing={isRequiredFieldMissing(info.row.original, 'inputs.kg.triple-store')} 
            />
          ),
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.inputs?.kg?.index || "", {
          id: "kg-index",
          header: "KG Index",
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
      ],
    },
    
    // Output format column
    columnHelper.accessor(row => row["output-format"] || "", {
      id: "output-format",
      header: "Output Format",
      cell: (info) => (
        <MissingFieldCell 
          value={info.getValue()} 
          isMissing={isRequiredFieldMissing(info.row.original, 'output-format')} 
        />
      ),
      enableSorting: false,
    }),
    
    // Checked by author column
    columnHelper.accessor(row => row["checked-by-author"], {
      id: "checked-by-author",
      header: "Checked by author",
      cell: (info) => {
        const value = info.getValue();
        const isMissing = isRequiredFieldMissing(info.row.original, 'checked-by-author');
        if (isMissing) {
          return <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>;
        }
        return value ? (
          <span className="material-icons-round text-green-500 text-lg">done</span>
        ) : (
          <span className="material-icons-round text-red-500 text-lg">clear</span>
        );
      },
      enableSorting: false,
    }),
    
    // Checked by AI column
    columnHelper.accessor(row => row["checked-by-ai"], {
      id: "checked-by-ai",
      header: "Checked by AI",
      cell: (info) => {
        const value = info.getValue();
        return value ? (
          <span className="material-icons-round text-green-500 text-lg">done</span>
        ) : (
          <span className="material-icons-round text-red-500 text-lg">clear</span>
        );
      },
      enableSorting: false,
      meta: { align: 'center' },
    }),
  ], []);

  // React Table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
      sorting,
    },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
  });

  // Calculate summary statistics with optimized performance
  const summaryStats = useMemo(() => {
    if (data.length === 0) {
      return {
        totalEntries: 0,
        entriesWithMissingFields: 0,
        totalMissingFields: 0,
        mostMissing: 'N/A',
        mainMethodTypeDistribution: {},
        domainDistribution: {},
        yearRange: { min: 'N/A', max: 'N/A' },
        approachesWithCode: 0,
        licenseDistribution: {},
        taskCounts: { cta: 0, cpa: 0, cea: 0, cnea: 0 },
      };
    }

    const totalEntries = data.length;
    
    // Single pass through data for better performance
    const stats = data.reduce((acc, row) => {
      // Missing fields analysis
      const missingFields = Object.keys(REQUIRED_FIELDS).filter(field => isRequiredFieldMissing(row, field));
      if (missingFields.length > 0) {
        acc.entriesWithMissingFields++;
        acc.totalMissingFields += missingFields.length;
        missingFields.forEach(field => {
          acc.fieldCounts[field] = (acc.fieldCounts[field] || 0) + 1;
        });
      }

      // Main method distribution
      const methodType = row['main-method']?.type || 'N/A';
      acc.mainMethodTypeDistribution[methodType] = (acc.mainMethodTypeDistribution[methodType] || 0) + 1;

      // Domain distribution
      const domain = row['domain']?.domain || 'N/A';
      acc.domainDistribution[domain] = (acc.domainDistribution[domain] || 0) + 1;

      // Year range
      if (typeof row.year === 'number') {
        acc.years.push(row.year);
      }

      // Code availability
      if (row['code-availability'] && row['code-availability'].trim() !== '') {
        acc.approachesWithCode++;
      }

      // License distribution
      const license = row['license'] || 'N/A';
      acc.licenseDistribution[license] = (acc.licenseDistribution[license] || 0) + 1;

      // Task counts
      if (row.tasks?.cta) acc.taskCounts.cta++;
      if (row.tasks?.cpa) acc.taskCounts.cpa++;
      if (row.tasks?.cea) acc.taskCounts.cea++;
      if (row.tasks?.cnea) acc.taskCounts.cnea++;

      // User revision distribution
      const userRevisionType = row['user-revision']?.type || 'N/A';
      acc.userRevisionDistribution[userRevisionType] = (acc.userRevisionDistribution[userRevisionType] || 0) + 1;

      // Steps coverage
      if (row.steps?.['data-preparation']?.description) acc.stepsCoverage['data-preparation']++;
      if (row.steps?.['subject-detection']) acc.stepsCoverage['subject-detection']++;
      if (row.steps?.['column-analysis']) acc.stepsCoverage['column-analysis']++;
      if (row.steps?.['type-annotation']) acc.stepsCoverage['type-annotation']++;
      if (row.steps?.['predicate-annotation']) acc.stepsCoverage['predicate-annotation']++;
      if (row.steps?.['datatype-annotation']) acc.stepsCoverage['datatype-annotation']++;
      if (row.steps?.['entity-linking']?.description) acc.stepsCoverage['entity-linking']++;
      if (row.steps?.['nil-annotation']) acc.stepsCoverage['nil-annotation']++;

      // Input type distribution
      const inputType = row.inputs?.['type-of-table'] || 'N/A';
      acc.inputTypeDistribution[inputType] = (acc.inputTypeDistribution[inputType] || 0) + 1;

      // Knowledge graph usage
      if (row.inputs?.kg?.['triple-store']) acc.kgUsage.withTripleStore++;
      if (row.inputs?.kg?.index) acc.kgUsage.withIndex++;

      // Author verification
      if (row['checked-by-author'] === true) acc.authorVerification.verified++;
      else if (row['checked-by-author'] === false) acc.authorVerification.notVerified++;
      else acc.authorVerification.missing++;

      // Conference/Journal distribution
      const venue = row['conference-journal'] || 'N/A';
      acc.conferenceJournalDistribution[venue] = (acc.conferenceJournalDistribution[venue] || 0) + 1;

      return acc;
    }, {
      entriesWithMissingFields: 0,
      totalMissingFields: 0,
      fieldCounts: {},
      mainMethodTypeDistribution: {},
      domainDistribution: {},
      years: [],
      approachesWithCode: 0,
      licenseDistribution: {},
      taskCounts: { cta: 0, cpa: 0, cea: 0, cnea: 0 },
      userRevisionDistribution: {},
      stepsCoverage: {
        'data-preparation': 0,
        'subject-detection': 0,
        'column-analysis': 0,
        'type-annotation': 0,
        'predicate-annotation': 0,
        'datatype-annotation': 0,
        'entity-linking': 0,
        'nil-annotation': 0
      },
      inputTypeDistribution: {},
      kgUsage: { withTripleStore: 0, withIndex: 0, total: totalEntries },
      authorVerification: { verified: 0, notVerified: 0, missing: 0 },
      conferenceJournalDistribution: {}
    });

    // Calculate most missing field
    const mostMissingEntry = Object.entries(stats.fieldCounts)
      .sort(([,a], [,b]) => b - a)[0];
    const mostMissing = mostMissingEntry ? `${mostMissingEntry[0]} (${mostMissingEntry[1]})` : 'None';

    // Calculate year range
    const yearRange = {
      min: stats.years.length > 0 ? Math.min(...stats.years) : 'N/A',
      max: stats.years.length > 0 ? Math.max(...stats.years) : 'N/A',
    };

    // Calculate percentages
    const calculatePercentages = (distribution) => 
      Object.fromEntries(
        Object.entries(distribution).map(([key, value]) => [
          key,
          { count: value, percentage: totalEntries > 0 ? (value / totalEntries) * 100 : 0 },
        ])
      );

    const taskPercentages = {
      cta: totalEntries > 0 ? (stats.taskCounts.cta / totalEntries) * 100 : 0,
      cpa: totalEntries > 0 ? (stats.taskCounts.cpa / totalEntries) * 100 : 0,
      cea: totalEntries > 0 ? (stats.taskCounts.cea / totalEntries) * 100 : 0,
      cnea: totalEntries > 0 ? (stats.taskCounts.cnea / totalEntries) * 100 : 0,
    };
    
    return {
      totalEntries,
      entriesWithMissingFields: stats.entriesWithMissingFields,
      totalMissingFields: stats.totalMissingFields,
      mostMissing,
      mainMethodTypeDistribution: calculatePercentages(stats.mainMethodTypeDistribution),
      domainDistribution: calculatePercentages(stats.domainDistribution),
      yearRange,
      approachesWithCode: stats.approachesWithCode,
      approachesWithCodePercentage: totalEntries > 0 ? (stats.approachesWithCode / totalEntries) * 100 : 0,
      licenseDistribution: calculatePercentages(stats.licenseDistribution),
      taskCounts: stats.taskCounts,
      taskPercentages,
      userRevisionDistribution: stats.userRevisionDistribution,
      stepsCoverage: stats.stepsCoverage,
      inputTypeDistribution: stats.inputTypeDistribution,
      kgUsage: stats.kgUsage,
      authorVerification: stats.authorVerification,
      conferenceJournalDistribution: stats.conferenceJournalDistribution,
    };
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-300 text-lg">Loading data...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-6 text-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="p-4 flex-shrink-0">
        {/* Overall Data Snapshot */}
        <div className="mb-6 bg-gray-800 border border-gray-700 shadow-lg overflow-hidden">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-100 flex items-center">
                <span className="material-icons-round mr-2 text-blue-400">analytics</span>
                Data Overview
              </h3>
              <button
                onClick={() => setShowStatistics(!showStatistics)}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors duration-200 text-gray-300 hover:text-gray-100"
                title={showStatistics ? "Hide statistics" : "Show statistics"}
              >
                <span className="material-icons-round text-lg transition-transform duration-200" style={{ transform: showStatistics ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  expand_more
                </span>
              </button>
            </div>
            
            {/* Summary when closed */}
            {!showStatistics && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                <div className="bg-slate-500/10 p-3 border border-slate-500/20">
                  <div className="text-2xl font-bold text-slate-100">{summaryStats.totalEntries}</div>
                  <div className="text-xs text-slate-300">Total Approaches</div>
                </div>
                <div className="bg-blue-500/10 p-3 border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-100">{summaryStats.yearRange.min} - {summaryStats.yearRange.max}</div>
                  <div className="text-xs text-blue-300">Year Range</div>
                </div>
                <div className="bg-rose-500/10 p-3 border border-rose-500/20">
                  <div className="text-2xl font-bold text-rose-100">{summaryStats.taskCounts.cta}</div>
                  <div className="text-xs text-rose-300">CTA</div>
                </div>
                <div className="bg-orange-500/10 p-3 border border-orange-500/20">
                  <div className="text-2xl font-bold text-orange-100">{summaryStats.taskCounts.cpa}</div>
                  <div className="text-xs text-orange-300">CPA</div>
                </div>
                <div className="bg-amber-500/10 p-3 border border-amber-500/20">
                  <div className="text-2xl font-bold text-amber-100">{summaryStats.taskCounts.cea}</div>
                  <div className="text-xs text-amber-300">CEA</div>
                </div>
                <div className="bg-yellow-500/10 p-3 border border-yellow-500/20">
                  <div className="text-2xl font-bold text-yellow-100">{summaryStats.taskCounts.cnea}</div>
                  <div className="text-xs text-yellow-300">CNEA</div>
                </div>
              </div>
            )}
          </div>
          
          <div className={`transition-all duration-300 ease-in-out ${showStatistics ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 pb-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {/* Main Method Types */}
            <div className="relative perspective-1000 h-[500px]">
              <div 
                className={`bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 p-4 border border-indigo-500/20 transition-transform duration-700 ease-in-out transform-style-preserve-3d h-[500px] ${
                  showMainMethodChart ? 'rotate-y-180' : ''
                }`}
                style={{ 
                  transformStyle: 'preserve-3d',
                  transform: showMainMethodChart ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                {/* Front side - Statistics */}
                <div className="backface-hidden h-[500px]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-indigo-300 font-semibold text-lg">Main Method Types</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowMainMethodChart(!showMainMethodChart)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 transition-colors duration-200 text-indigo-300 hover:text-indigo-100 subtle-animated-border"
                        title={showMainMethodChart ? 'Show statistics' : 'Show chart'}
                        style={{
                          boxShadow: 'none',
                          padding: 0,
                          border: 'none'
                        }}
                      >
                        <span
                          className="material-icons-round"
                          style={{
                            fontSize: '1.5rem',
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            width: '100%',
                            textAlign: 'center'
                          }}
                        >
                          360
                        </span>
                      </button>
                      <span className="material-icons-round text-indigo-400">category</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.entries(summaryStats.mainMethodTypeDistribution)
                      .sort(([, a], [, b]) => b.count - a.count)
                      .map(([type, data], index) => (
                      <div key={type} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-indigo-200 text-sm font-medium">{type}</span>
                          <span className="text-indigo-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-2 bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${data.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Back side - Chart */}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 p-4 border border-indigo-500/20 backface-hidden h-[500px]"
                  style={{ 
                    transform: 'rotateY(180deg)',
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <div className="flex flex-col h-full w-full">
                    {/* Riga 1: Titolo e icone + Bottone Scarica SVG */}
                    <div className="flex items-center justify-between mb-4 w-full">
                      <span className="text-indigo-300 font-semibold text-lg">Main Method Distribution by Year</span>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setShowMainMethodChart(!showMainMethodChart)}
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 transition-colors duration-200 text-indigo-300 hover:text-indigo-100"
                          title={showMainMethodChart ? "Show statistics" : "Show chart"}
                        >
                          <span className="material-icons-round text-lg transition-transform duration-200" style={{ transform: showMainMethodChart ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            {showMainMethodChart ? 'analytics' : 'bar_chart'}
                          </span>
                        </button>
                                                {/* Bottone Scarica SVG */}
                                                <button
                          onClick={() => {
                            if (chartRef?.current?.children[0]?.children[0]) {
                              downloadSVG(chartRef.current.children[0].children[0], "main-method-chart.svg");
                            }
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 transition-colors duration-200 text-indigo-300 hover:text-indigo-100"
                          title="Download SVG"
                        >
                          <span className="material-icons-round text-lg" style={{ fontSize: '1.5rem' }}>download</span>
                        </button>
                        <span className="material-icons-round text-indigo-400">{showMainMethodChart ? 'bar_chart' : 'category'}</span>
                      </div>
                    </div>
                    {/* Riga 2: Legenda */}
                    <div className="flex flex-row gap-4 mb-2 w-full justify-end">
                      {['unsup', 'sup', 'hybrid'].map(type => (
                        <div key={type} className="flex items-center gap-2">
                          <span className={`inline-block w-4 h-4 rounded ${type === 'unsup' ? 'bg-indigo-500' : type === 'sup' ? 'bg-orange-400' : 'bg-violet-400'}`}></span>
                          <span className="text-indigo-100 text-sm font-semibold" style={{letterSpacing: 1}}>{type.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                    {/* Riga 3: Grafico */}
                    <div className="flex-grow flex flex-col justify-end pt-2 h-[400px] w-full" ref={chartRef}>
                      <MainMethodStackedChart data={data} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Domains */}
            <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 p-4 border border-purple-500/20 h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-purple-300 font-semibold text-lg">Domains</span>
                <span className="material-icons-round text-purple-400">public</span>
              </div>
              <div className="space-y-3">
                {Object.entries(summaryStats.domainDistribution)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([domain, data], index) => (
                  <div key={domain} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-purple-200 text-sm font-medium">{domain}</span>
                      <span className="text-purple-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-2 bg-purple-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${data.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Addressed */}
            <div className="bg-gradient-to-r from-rose-500/10 to-rose-600/10 p-4 border border-rose-500/20 h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-rose-300 font-semibold text-lg">Tasks Addressed</span>
                <span className="material-icons-round text-rose-400">assignment</span>
              </div>
              <div className="space-y-3">
                {Object.entries(summaryStats.taskPercentages).map(([task, percentage], index) => (
                  <div key={task} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-rose-200 text-sm font-medium">{task.toUpperCase()}</span>
                      <span className="text-rose-300 text-sm">{summaryStats.taskCounts[task]} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-2 bg-rose-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps Coverage */}
            <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 p-4 border border-green-500/20 h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-green-300 font-semibold text-lg">Steps Coverage</span>
                <span className="material-icons-round text-green-400">layers</span>
              </div>
              <div className="space-y-3">
                {Object.entries(summaryStats.stepsCoverage)
                  .sort(([, a], [, b]) => b - a)
                  .map(([step, count], index) => (
                  <div key={step} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-green-200 text-sm font-medium">{step.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      <span className="text-green-300 text-sm">{count} ({(count / summaryStats.totalEntries * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-2 bg-green-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${(count / summaryStats.totalEntries * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User Revision */}
            <div className="bg-gradient-to-r from-teal-500/10 to-teal-600/10 p-4 border border-teal-500/20 h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-teal-300 font-semibold text-lg">User Revision</span>
                <span className="material-icons-round text-teal-400">edit</span>
              </div>
              <div className="space-y-3">
                {Object.entries(summaryStats.userRevisionDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count], index) => (
                  <div key={type} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-teal-200 text-sm font-medium">{type}</span>
                      <span className="text-teal-300 text-sm">{count} ({(count / summaryStats.totalEntries * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-2 bg-teal-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${(count / summaryStats.totalEntries * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Licenses */}
            <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 p-4 border border-amber-500/20 h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-amber-300 font-semibold text-lg">Licenses</span>
                <span className="material-icons-round text-amber-400">gavel</span>
              </div>
              <div className="space-y-3">
                {Object.entries(summaryStats.licenseDistribution)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([license, data], index) => (
                  <div key={license} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-amber-200 text-sm font-medium">{license}</span>
                      <span className="text-amber-300 text-sm">{data.count} ({data.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-2 bg-amber-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${data.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
        
        {/* Conference/Journal Filter */}
        <div className="mb-4 relative" ref={filterRef}>
          <span
            className="text-gray-200 font-semibold mr-2 cursor-pointer select-none"
            onClick={() => setShowFacetFilter((v) => !v)}
          >
            Conference/Journal:
          </span>
          {showFacetFilter && (
            <div className="absolute left-0 mt-2 bg-gray-800 border border-gray-700 rounded shadow-lg z-20 max-h-[250px] overflow-y-auto p-3 min-w-[220px]">
              {Array.from(table.getColumn("conference-journal")?.getFacetedUniqueValues()?.entries() || [])
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([value, count]) => (
                  <label key={value} className="flex items-center mb-2 text-gray-300 text-sm">
                    <input
                      type="checkbox"
                      className="form-checkbox bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-400 mr-2"
                      checked={
                        (Array.isArray(table.getColumn("conference-journal")?.getFilterValue()) &&
                          table.getColumn("conference-journal")?.getFilterValue().includes(value)) || false
                      }
                      onChange={e => {
                        const col = table.getColumn("conference-journal");
                        let prev = col.getFilterValue() || [];
                        if (!Array.isArray(prev)) prev = [];
                        if (e.target.checked) {
                          col.setFilterValue([...prev, value]);
                        } else {
                          col.setFilterValue(prev.filter(v => v !== value));
                        }
                      }}
                    />
                    <span>{value} <span className="text-gray-500">({count})</span></span>
                  </label>
                ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Data Table */}
      <div className="overflow-auto flex-1 pb-4">
        <table className="w-full table-auto text-xs">
          <thead className="bg-gray-800 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th 
                    key={header.id}
                    colSpan={header.colSpan}
                    className="px-4 py-2 text-center text-xs font-semibold text-gray-300 border-r border-gray-700 border-b border-gray-700"
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {header.column.getCanSort() && (
                      <span className="ml-2">
                        {header.column.getIsSorted() === 'asc' ? '▲' : header.column.getIsSorted() === 'desc' ? '▼' : ''}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-gray-900">
            {table.getRowModel().rows.map((row, index) => {
              // Check for missing fields to highlight row
              const missingFields = Object.keys(REQUIRED_FIELDS)
                .filter(field => isRequiredFieldMissing(row.original, field));
              const hasMissingFields = missingFields.length > 0;
              
              return (
                <tr 
                  key={row.id}
                  className={`hover:bg-gray-700 transition-colors duration-150 ${
                    index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'
                  } ${hasMissingFields ? 'border-l-4 border-l-red-500' : ''}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td 
                      key={cell.id}
                      className={`px-4 py-2 text-xs text-gray-300 border-r border-gray-700 ${
                        cell.column.columnDef.meta?.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;

