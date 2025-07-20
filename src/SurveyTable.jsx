/**
 * Survey Table Component
 * 
 * This component handles the main survey data table with all its functionality:
 * - Interactive data table with sorting and filtering
 * - Field validation with missing data indicators
 * - Visual badges for method types, domains, and user revision types
 * - Statistics calculation and display
 * 
 * Features:
 * - Collapsible navigation
 * - Missing field validation and highlighting
 * - Interactive tooltips for missing fields
 * - Sortable columns
 * - Responsive design
 */

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
import Navigation from "./Navigation";

// Column helper for type-safe column definitions
const columnHelper = createColumnHelper();

/**
 * Color mapping configurations for visual badges
 */

// Color mapping for method type badges
const METHOD_TYPE_COLORS = {
  unsup: "bg-orange-500/20 text-orange-200",
  sup: "bg-indigo-500/20 text-indigo-200",
  "semi-automated": "bg-amber-500/20 text-amber-200",
  "fully-automated": "bg-emerald-500/20 text-emerald-200",
  hybrid: "bg-violet-500/20 text-violet-200",
};

// Color mapping for domain type badges
const DOMAIN_COLORS = {
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

// Color mapping for user revision type badges
const USER_REVISION_COLORS = {
  manual: "bg-blue-500/20 text-blue-200",
  "semi-automatic": "bg-orange-500/20 text-orange-200",
  automatic: "bg-emerald-500/20 text-emerald-200",
  none: "bg-slate-500/20 text-slate-200",
};

/**
 * Required fields configuration for validation
 */
const REQUIRED_FIELDS = {
  id: true,
  authors: true,
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
  doi: true,
};

/**
 * Utility functions for data validation and formatting
 */

/**
 * Returns Tailwind CSS classes for a badge based on the method type
 */
const getTypeBadgeColor = (type) => {
  return METHOD_TYPE_COLORS[type?.toLowerCase()] || "bg-slate-500/20 text-slate-200";
};

/**
 * Returns Tailwind CSS classes for a badge based on the domain type
 */
const getDomainBadgeColor = (domain) => {
  return DOMAIN_COLORS[domain?.toLowerCase()] || "bg-neutral-500/20 text-neutral-200";
};

/**
 * Returns Tailwind CSS classes for user revision type badge
 */
const getUserRevisionBadgeColor = (type) => {
  return USER_REVISION_COLORS[type?.toLowerCase()] || "bg-violet-500/20 text-violet-200";
};

/**
 * Checks if a value is empty, null, or undefined
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
 * Formats a date string to DD/MM/YYYY or returns null if invalid
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

/**
 * Gets nested value from object using dot notation path
 */
const getNestedValue = (obj, path) => {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
};

/**
 * Checks if a required field is missing from a row
 */
const isRequiredFieldMissing = (row, fieldPath) => {
  if (!REQUIRED_FIELDS[fieldPath]) return false;
  const value = getNestedValue(row, fieldPath);
  return isEmpty(value);
};

/**
 * Cell rendering components
 */

/**
 * Renders a cell with missing field indicator
 */
const MissingFieldCell = ({ value, isMissing }) => (
  <span className={isMissing ? "bg-red-500/20 text-red-200 px-2 py-1 rounded" : ""}>
    {value || (isMissing ? "MISSING" : "")}
  </span>
);

/**
 * Renders a task cell with Material Design icons
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
 * Renders a step cell with Material Design icons
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
 * Renders the main method cell with type badge and technique
 */
const MainMethodCell = ({ mainMethod, row }) => {
  const { type, tech } = mainMethod || {};
  
  if (!type && !tech) return "";
  
  const isTypeMissing = isRequiredFieldMissing(row, "main-method.type");
  const isTechMissing = isRequiredFieldMissing(row, "main-method.technique");
  
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
        <span className={tech ? "text-[10px] text-neutral-400" : "bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px]"}>
          {tech || "MISSING"}
        </span>
      )}
    </div>
  );
};

/**
 * Renders the domain cell with domain badge and type detail
 */
const DomainCell = ({ domain, row }) => {
  const domainValue = domain?.domain || "";
  const typeValue = domain?.type || "";
  
  if (!domainValue && !typeValue) return "";
  
  const isDomainMissing = isRequiredFieldMissing(row, "domain.domain");
  
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
      {typeValue && <span className="text-[10px] text-neutral-400">{typeValue}</span>}
    </div>
  );
};

/**
 * Renders the row number with missing fields count and tooltip
 */
const RowNumberCell = ({ row, index }) => {
  const missingFields = Object.keys(REQUIRED_FIELDS).filter((field) => isRequiredFieldMissing(row.original, field));
  const hasMissingFields = missingFields.length > 0;
  
  return (
    <div className="flex flex-col items-center">
      <span>{index + 1}</span>
      {hasMissingFields && (
        <div className="relative group mt-1">
          <span className="text-[11px] text-red-400 bg-red-900/60 rounded px-2 py-0.5 leading-none cursor-pointer">
            {missingFields.length} missing
          </span>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg text-xs text-neutral-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none min-w-[120px]">
            <div className="font-semibold mb-1">Missing fields:</div>
            <div className="space-y-1">
              {missingFields.map((field) => (
                <div key={field} className="text-[10px] text-neutral-400">• {field}</div>
              ))}
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Collapsible navigation component with toggle button
 */
const CollapsibleNavigation = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed top-6 left-0 z-30">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-4 py-3 rounded-r-xl shadow-xl transition-all duration-300 border border-neutral-600 border-l-0 hover:shadow-2xl hover:scale-105 group flex items-center justify-center"
          title={isOpen ? "Hide navigation" : "Show navigation"}
        >
          <span className="material-icons-round text-xl transition-transform duration-300 group-hover:rotate-12 relative z-10">
            {isOpen ? "close" : "menu"}
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-neutral-700/20 rounded-r-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </button>
      </div>

      {isOpen && (
        <div className="fixed top-0 left-0 right-0 z-20">
          <Navigation />
        </div>
      )}
    </>
  );
};

/**
 * Main SurveyTable component
 */
function SurveyTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);

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
    // ID column
    columnHelper.accessor("id", {
      header: "ID",
      cell: (info) => (
        <span className="text-[10px] text-neutral-400 font-mono">{info.getValue()}</span>
      ),
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
              <span className="text-xs text-neutral-200 font-medium">{formattedDate}</span>
              {addedValue !== formattedDate && (
                <span className="text-[10px] text-neutral-500" title={`Original: ${addedValue}`}>
                  {addedValue}
                </span>
              )}
            </div>
          );
        } else {
          return (
            <span className="text-xs text-neutral-500 italic">-</span>
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
          return <span className="text-neutral-500 text-[10px]">No authors listed</span>;
        }
        return (
          <span className="text-[10px] text-neutral-400">{authors.join(", ")}</span>
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
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg text-xs text-neutral-300 whitespace-pre-line opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none min-w-[120px] max-w-xs">
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
        <span className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium bg-neutral-500/20 text-neutral-200">
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
    // Citations count column
    columnHelper.accessor(row => Array.isArray(row.citations) ? row.citations.length : 0, {
      id: "citations-count",
      header: "# Citations",
      cell: (info) => (
        <span className="text-[10px] text-neutral-400">{info.getValue()}</span>
      ),
      enableSorting: true,
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-neutral-300 text-lg">Loading data...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-6 text-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 h-screen overflow-auto relative">
      {/* Collapsible Navigation */}
      <CollapsibleNavigation />
      
      {/* Data Table */}
      <table className="w-full table-auto text-xs">
        <thead className="bg-neutral-800 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th 
                  key={header.id}
                  colSpan={header.colSpan}
                  className="px-4 py-2 text-center text-xs font-semibold text-neutral-300 border-r border-b border-neutral-700 border-l border-t"
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
        <tbody className="bg-neutral-900">
          {table.getRowModel().rows.map((row, index) => {
            const missingFields = Object.keys(REQUIRED_FIELDS)
              .filter(field => isRequiredFieldMissing(row.original, field));
            const hasMissingFields = missingFields.length > 0;
            
            return (
              <tr 
                key={row.id}
                className={`hover:bg-neutral-700 transition-colors duration-150 ${
                  index % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-800'
                } ${hasMissingFields ? 'border-l-4 border-l-red-500' : ''}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td 
                    key={cell.id}
                    className={`px-4 py-2 text-xs text-neutral-300 border-r border-neutral-700 ${
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
  );
}

export default SurveyTable; 