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

// Column helper for type-safe column definitions
const columnHelper = createColumnHelper();

/**
 * Get badge color styling based on method type
 * @param {string} type - The method type
 * @returns {string} Tailwind CSS classes for the badge
 */
const getTypeBadgeColor = (type) => {
  const colorMap = {
    'unsup': 'bg-orange-500/20 text-orange-200',
    'sup': 'bg-indigo-500/20 text-indigo-200',
    'semi-automated': 'bg-amber-500/20 text-amber-200',
    'fully-automated': 'bg-emerald-500/20 text-emerald-200',
    'hybrid': 'bg-violet-500/20 text-violet-200',
  };
  
  return colorMap[type?.toLowerCase()] || 'bg-slate-500/20 text-slate-200';
};

/**
 * Get badge color styling based on domain type
 * @param {string} domain - The domain type
 * @returns {string} Tailwind CSS classes for the badge
 */
const getDomainBadgeColor = (domain) => {
  const colorMap = {
    'independent': 'bg-blue-500/20 text-blue-200',
    'dependent': 'bg-red-500/20 text-red-200',
    'specific': 'bg-purple-500/20 text-purple-200',
    'general': 'bg-teal-500/20 text-teal-200',
    'biomedical': 'bg-pink-500/20 text-pink-200',
    'geographic': 'bg-yellow-500/20 text-yellow-200',
    'financial': 'bg-green-500/20 text-green-200',
    'scientific': 'bg-cyan-500/20 text-cyan-200',
    'educational': 'bg-lime-500/20 text-lime-200',
  };
  
  return colorMap[domain?.toLowerCase()] || 'bg-gray-500/20 text-gray-200';
};

/**
 * Check if a value is empty or null
 * @param {any} value - The value to check
 * @returns {boolean} True if empty
 */
const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
};

/**
 * Required fields configuration for validation
 */
const REQUIRED_FIELDS = {
  'author': true,
  'year': true,
  'title.text': true,
  'conference-journal': true,
  'main-method.type': true,
  'main-method.technique': true,
  'domain.domain': true,
  'tasks.cta': true,
  'tasks.cpa': true,
  'tasks.cea': true,
  'tasks.cnea': true,
  'user-revision.type': true,
  'license': true,
  'inputs.type-of-table': true,
  'inputs.kg.triple-store': true,
  'inputs.kg.index': true,
  'output-format': true,
  'checked-by-author': true
};

/**
 * Check if a required field is missing from a row
 * @param {object} row - The data row
 * @param {string} fieldPath - The field path (e.g., 'title.text')
 * @returns {boolean} True if the field is required and missing
 */
const isRequiredFieldMissing = (row, fieldPath) => {
  if (!REQUIRED_FIELDS[fieldPath]) return false;

  // Get nested value based on field path
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const value = getNestedValue(row, fieldPath);
  return isEmpty(value);
};

/**
 * Render a cell with missing field indicator
 * @param {any} value - The cell value
 * @param {boolean} isMissing - Whether the field is missing
 * @returns {JSX.Element} The rendered cell content
 */
const MissingFieldCell = ({ value, isMissing }) => (
  <span className={isMissing ? 'bg-red-500/20 text-red-200 px-2 py-1 rounded' : ''}>
    {value || (isMissing ? 'MISSING' : '')}
  </span>
);

/**
 * Render a task cell with Material Design icons
 * @param {boolean} value - The task value
 * @param {boolean} isMissing - Whether the field is missing
 * @returns {JSX.Element} The rendered task cell
 */
const TaskCell = ({ value, isMissing }) => {
  if (isMissing) {
    return <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>;
  }
  return value ? (
    <span className="material-icons-round text-green-500 text-lg">done</span>
  ) : (
    <span className="material-icons-round text-red-500 text-lg">clear</span>
  );
};

/**
 * Render a step cell with Material Design icons
 * @param {string} value - The step value
 * @returns {JSX.Element} The rendered step cell
 */
const StepCell = ({ value }) => {
  const hasContent = value && value.trim() !== '';
  return hasContent ? (
    <span className="material-icons-round text-green-500 text-lg">done</span>
  ) : (
    <span className="material-icons-round text-red-500 text-lg">clear</span>
  );
};

/**
 * Render the main method cell with type badge and technique
 * @param {object} mainMethod - The main method object
 * @param {object} row - The row data for validation
 * @returns {JSX.Element} The rendered method cell
 */
const MainMethodCell = ({ mainMethod, row }) => {
  const { type, tech } = mainMethod || {};
  const isTypeMissing = isRequiredFieldMissing(row, 'main-method.type');
  const isTechMissing = isRequiredFieldMissing(row, 'main-method.technique');
  
  if (!type && !tech) return "";
  
  return (
    <div className="flex items-center gap-2">
      {type ? (
        <span className={`inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium w-16 ${getTypeBadgeColor(type)}`}>
          {type}
        </span>
      ) : isTypeMissing ? (
        <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px] font-medium w-16">
          MISSING
        </span>
      ) : null}
      {tech ? (
        <span className="text-[10px] text-gray-400">{tech}</span>
      ) : isTechMissing ? (
        <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px]">
          MISSING
        </span>
      ) : null}
    </div>
  );
};

/**
 * Render the domain cell with domain badge and type detail
 * @param {object} domain - The domain object
 * @param {object} row - The row data for validation
 * @returns {JSX.Element} The rendered domain cell
 */
const DomainCell = ({ domain, row }) => {
  const domainValue = domain?.domain || "";
  const typeValue = domain?.type || "";
  const isDomainMissing = isRequiredFieldMissing(row, 'domain.domain');
  
  if (!domainValue && !typeValue) return "";
  
  return (
    <div className="flex items-center gap-2">
      {domainValue ? (
        <span className={`inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium w-20 ${getDomainBadgeColor(domainValue)}`}>
          {domainValue}
        </span>
      ) : isDomainMissing ? (
        <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px] font-medium w-20">
          MISSING
        </span>
      ) : null}
      {typeValue && (
        <span className="text-[10px] text-gray-400">{typeValue}</span>
      )}
    </div>
  );
};

/**
 * Get badge color styling for user revision type
 * @param {string} type - The user revision type
 * @returns {string} Tailwind CSS classes for the badge
 */
const getUserRevisionBadgeColor = (type) => {
  const colorMap = {
    'manual': 'bg-blue-500/20 text-blue-200',
    'semi-automatic': 'bg-orange-500/20 text-orange-200',
    'automatic': 'bg-emerald-500/20 text-emerald-200',
    'none': 'bg-slate-500/20 text-slate-200',
  };
  return colorMap[type?.toLowerCase()] || 'bg-violet-500/20 text-violet-200';
};

/**
 * Render the row number with missing fields count
 * @param {object} row - The row data
 * @param {number} index - The row index
 * @returns {JSX.Element} The rendered row number cell
 */
const RowNumberCell = ({ row, index }) => {
  const missingFields = Object.keys(REQUIRED_FIELDS)
    .filter(field => isRequiredFieldMissing(row.original, field));

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
              {missingFields.map(field => (
                <div key={field} className="text-[10px] text-gray-400">
                  • {field}
                </div>
              ))}
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [showFacetFilter, setShowFacetFilter] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const filterRef = useRef();

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/data/sti-survey.json');
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
    
    // Title column
    columnHelper.accessor("title.text", {
      header: "Title",
      cell: (info) => (
        <MissingFieldCell 
          value={info.getValue()} 
          isMissing={isRequiredFieldMissing(info.row.original, 'title.text')} 
        />
      ),
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
            <span className="material-icons-outlined">launch</span>
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
          cell: (info) => (
            <MissingFieldCell 
              value={info.getValue()} 
              isMissing={isRequiredFieldMissing(info.row.original, 'inputs.kg.index')} 
            />
          ),
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

  // Calculate summary statistics
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
    const entriesWithMissingFields = data.filter(row => {
      return Object.keys(REQUIRED_FIELDS).some(field => isRequiredFieldMissing(row, field));
    }).length;
    
    const totalMissingFields = data.reduce((total, row) => {
      return total + Object.keys(REQUIRED_FIELDS).filter(field => isRequiredFieldMissing(row, field)).length;
    }, 0);
    
    const fieldCounts = {};
    Object.keys(REQUIRED_FIELDS).forEach(field => {
      fieldCounts[field] = data.filter(row => isRequiredFieldMissing(row, field)).length;
    });
    
    const mostMissingEntry = Object.entries(fieldCounts)
      .sort(([,a], [,b]) => b - a)[0];
    const mostMissing = mostMissingEntry ? `${mostMissingEntry[0]} (${mostMissingEntry[1]})` : 'None';

    // Additional Statistics
    const mainMethodTypeDistribution = data.reduce((acc, row) => {
      const type = row['main-method']?.type || 'N/A';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const domainDistribution = data.reduce((acc, row) => {
      const domain = row['domain']?.domain || 'N/A';
      acc[domain] = (acc[domain] || 0) + 1;
      return acc;
    }, {});

    const years = data.map(row => row.year).filter(year => typeof year === 'number');
    const yearRange = {
      min: years.length > 0 ? Math.min(...years) : 'N/A',
      max: years.length > 0 ? Math.max(...years) : 'N/A',
    };

    const approachesWithCode = data.filter(row => row['code-availability'] && row['code-availability'].trim() !== '').length;
    const approachesWithCodePercentage = totalEntries > 0 ? (approachesWithCode / totalEntries) * 100 : 0;

    const licenseDistribution = data.reduce((acc, row) => {
      const license = row['license'] || 'N/A';
      acc[license] = (acc[license] || 0) + 1;
      return acc;
    }, {});
    const licenseDistributionWithPercentages = Object.fromEntries(
      Object.entries(licenseDistribution).map(([key, value]) => [
        key,
        { count: value, percentage: totalEntries > 0 ? (value / totalEntries) * 100 : 0 },
      ])
    );

    const taskCounts = { cta: 0, cpa: 0, cea: 0, cnea: 0 };
    data.forEach(row => {
      if (row.tasks?.cta) taskCounts.cta++;
      if (row.tasks?.cpa) taskCounts.cpa++;
      if (row.tasks?.cea) taskCounts.cea++;
      if (row.tasks?.cnea) taskCounts.cnea++;
    });
    const taskPercentages = {
      cta: totalEntries > 0 ? (taskCounts.cta / totalEntries) * 100 : 0,
      cpa: totalEntries > 0 ? (taskCounts.cpa / totalEntries) * 100 : 0,
      cea: totalEntries > 0 ? (taskCounts.cea / totalEntries) * 100 : 0,
      cnea: totalEntries > 0 ? (taskCounts.cnea / totalEntries) * 100 : 0,
    };

    // User Revision Statistics
    const userRevisionDistribution = data.reduce((acc, row) => {
      const type = row['user-revision']?.type || 'N/A';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Steps Coverage Statistics
    const stepsCoverage = {
      'data-preparation': 0,
      'subject-detection': 0,
      'column-analysis': 0,
      'type-annotation': 0,
      'predicate-annotation': 0,
      'datatype-annotation': 0,
      'entity-linking': 0,
      'nil-annotation': 0
    };
    
    data.forEach(row => {
      if (row.steps?.['data-preparation']?.description) stepsCoverage['data-preparation']++;
      if (row.steps?.['subject-detection']) stepsCoverage['subject-detection']++;
      if (row.steps?.['column-analysis']) stepsCoverage['column-analysis']++;
      if (row.steps?.['type-annotation']) stepsCoverage['type-annotation']++;
      if (row.steps?.['predicate-annotation']) stepsCoverage['predicate-annotation']++;
      if (row.steps?.['datatype-annotation']) stepsCoverage['datatype-annotation']++;
      if (row.steps?.['entity-linking']?.description) stepsCoverage['entity-linking']++;
      if (row.steps?.['nil-annotation']) stepsCoverage['nil-annotation']++;
    });

    // Input Types Statistics
    const inputTypeDistribution = data.reduce((acc, row) => {
      const type = row.inputs?.['type-of-table'] || 'N/A';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Knowledge Graph Usage
    const kgUsage = {
      withTripleStore: data.filter(row => row.inputs?.kg?.['triple-store']).length,
      withIndex: data.filter(row => row.inputs?.kg?.index).length,
      total: totalEntries
    };

    // Author Verification
    const authorVerification = {
      verified: data.filter(row => row['checked-by-author'] === true).length,
      notVerified: data.filter(row => row['checked-by-author'] === false).length,
      missing: data.filter(row => row['checked-by-author'] === null || row['checked-by-author'] === undefined).length
    };

    // Conference/Journal Distribution
    const conferenceJournalDistribution = data.reduce((acc, row) => {
      const venue = row['conference-journal'] || 'N/A';
      acc[venue] = (acc[venue] || 0) + 1;
      return acc;
    }, {});

    // Calculate percentages for distributions
    const mainMethodTypeDistributionWithPercentages = Object.fromEntries(
      Object.entries(mainMethodTypeDistribution).map(([key, value]) => [
        key,
        { count: value, percentage: totalEntries > 0 ? (value / totalEntries) * 100 : 0 },
      ])
    );

    const domainDistributionWithPercentages = Object.fromEntries(
      Object.entries(domainDistribution).map(([key, value]) => [
        key,
        { count: value, percentage: totalEntries > 0 ? (value / totalEntries) * 100 : 0 },
      ])
    );
    
    return {
      totalEntries,
      entriesWithMissingFields,
      totalMissingFields,
      mostMissing,
      mainMethodTypeDistribution: mainMethodTypeDistributionWithPercentages,
      domainDistribution: domainDistributionWithPercentages,
      yearRange,
      approachesWithCode,
      approachesWithCodePercentage,
      licenseDistribution: licenseDistributionWithPercentages,
      taskCounts,
      taskPercentages,
      userRevisionDistribution,
      stepsCoverage,
      inputTypeDistribution,
      kgUsage,
      authorVerification,
      conferenceJournalDistribution,
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
    <div className="min-h-screen bg-gray-900">
      <div className="p-4">
        {/* Overall Data Snapshot */}
        <div className="mb-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
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
                <div className="bg-slate-500/10 p-3 rounded-lg border border-slate-500/20">
                  <div className="text-2xl font-bold text-slate-100">{summaryStats.totalEntries}</div>
                  <div className="text-xs text-slate-300">Total Approaches</div>
                </div>
                <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-100">{summaryStats.yearRange.min} - {summaryStats.yearRange.max}</div>
                  <div className="text-xs text-blue-300">Year Range</div>
                </div>
                <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                  <div className="text-2xl font-bold text-emerald-100">{summaryStats.approachesWithCode}</div>
                  <div className="text-xs text-emerald-300">Code Available</div>
                </div>
                <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  <div className="text-2xl font-bold text-red-100">{summaryStats.entriesWithMissingFields}</div>
                  <div className="text-xs text-red-300">Missing Data</div>
                </div>
                <div className="bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                  <div className="text-2xl font-bold text-indigo-100">
                    {Object.keys(summaryStats.mainMethodTypeDistribution).length}
                  </div>
                  <div className="text-xs text-indigo-300">Method Types</div>
                </div>
                <div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/20">
                  <div className="text-2xl font-bold text-purple-100">
                    {Object.keys(summaryStats.domainDistribution).length}
                  </div>
                  <div className="text-xs text-purple-300">Domains</div>
                </div>
              </div>
            )}
          </div>
          
          <div className={`transition-all duration-300 ease-in-out ${showStatistics ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 pb-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Total Approaches - Large prominent box */}
            <div className="lg:col-span-3 bg-gradient-to-r from-slate-500/10 to-slate-600/10 p-6 rounded-lg border border-slate-500/20 hover:border-slate-500/40 transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-300 font-semibold text-lg">Total Approaches</span>
                <span className="material-icons-round text-slate-400 text-2xl">science</span>
              </div>
              <div className="text-4xl font-bold text-slate-100 animate-count-up mb-2">
                {summaryStats.totalEntries}
              </div>
              <div className="text-sm text-slate-300">
                surveyed approaches
              </div>
            </div>

            {/* Key Metrics - Medium boxes */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 p-4 rounded-lg border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-300 font-semibold text-sm">Year Range</span>
                  <span className="material-icons-round text-blue-400">schedule</span>
                </div>
                <div className="text-2xl font-bold text-blue-100">
                  {summaryStats.yearRange.min} - {summaryStats.yearRange.max}
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 p-4 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-300 font-semibold text-sm">Code Available</span>
                  <span className="material-icons-round text-emerald-400">code</span>
                </div>
                <div className="text-2xl font-bold text-emerald-100 mb-2">
                  {summaryStats.approachesWithCode}
                </div>
                <div className="text-sm text-emerald-300">
                  {summaryStats.approachesWithCodePercentage.toFixed(1)}% of total
                </div>
                <div className="mt-2 h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-2 bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${summaryStats.approachesWithCodePercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Data Quality - Medium box */}
            <div className="lg:col-span-3 bg-gradient-to-r from-red-500/10 to-red-600/10 p-4 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <span className="text-red-300 font-semibold">Data Quality</span>
                <span className="material-icons-round text-red-400">warning</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-red-200 text-sm">With Missing Fields</span>
                  <span className="text-red-100 font-bold">{summaryStats.entriesWithMissingFields}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-200 text-sm">Total Missing</span>
                  <span className="text-red-100 font-bold">{summaryStats.totalMissingFields}</span>
                </div>
                <div className="pt-2 border-t border-red-500/20">
                  <div className="text-red-200 text-xs">Most Missing Field:</div>
                  <div className="text-red-100 text-sm font-medium">{summaryStats.mostMissing}</div>
                </div>
              </div>
            </div>

            {/* Main Method Types - Large detailed box */}
            <div className="lg:col-span-6 bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 p-4 rounded-lg border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <span className="text-indigo-300 font-semibold text-lg">Main Method Types</span>
                <span className="material-icons-round text-indigo-400">category</span>
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

            {/* Domains - Large detailed box */}
            <div className="lg:col-span-6 bg-gradient-to-r from-purple-500/10 to-purple-600/10 p-4 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:scale-105">
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

            {/* Licenses - Medium box */}
            <div className="lg:col-span-4 bg-gradient-to-r from-amber-500/10 to-amber-600/10 p-4 rounded-lg border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <span className="text-amber-300 font-semibold">Licenses</span>
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

            {/* Tasks - Medium box */}
            <div className="lg:col-span-4 bg-gradient-to-r from-rose-500/10 to-rose-600/10 p-4 rounded-lg border border-rose-500/20 hover:border-rose-500/40 transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <span className="text-rose-300 font-semibold">Tasks Addressed</span>
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

            {/* User Revision - Medium box */}
            <div className="lg:col-span-4 bg-gradient-to-r from-teal-500/10 to-teal-600/10 p-4 rounded-lg border border-teal-500/20 hover:border-teal-500/40 transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <span className="text-teal-300 font-semibold">User Revision</span>
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

            {/* Steps Coverage - Large box */}
            <div className="lg:col-span-6 bg-gradient-to-r from-green-500/10 to-green-600/10 p-4 rounded-lg border border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:scale-105">
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

            {/* Knowledge Graph Usage - Medium box */}
            <div className="lg:col-span-3 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 p-4 rounded-lg border border-yellow-500/20 hover:border-yellow-500/40 transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <span className="text-yellow-300 font-semibold">KG Usage</span>
                <span className="material-icons-round text-yellow-400">account_tree</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-yellow-200 text-sm">With Triple Store</span>
                  <span className="text-yellow-100 font-bold">{summaryStats.kgUsage.withTripleStore}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-yellow-200 text-sm">With Index</span>
                  <span className="text-yellow-100 font-bold">{summaryStats.kgUsage.withIndex}</span>
                </div>
                <div className="pt-2 border-t border-yellow-500/20">
                  <div className="text-yellow-200 text-xs">Triple Store Coverage:</div>
                  <div className="text-yellow-100 text-sm font-medium">{((summaryStats.kgUsage.withTripleStore / summaryStats.kgUsage.total) * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Author Verification - Medium box */}
            <div className="lg:col-span-3 bg-gradient-to-r from-fuchsia-500/10 to-fuchsia-600/10 p-4 rounded-lg border border-fuchsia-500/20 hover:border-fuchsia-500/40 transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <span className="text-fuchsia-300 font-semibold">Author Verification</span>
                <span className="material-icons-round text-fuchsia-400">verified_user</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-fuchsia-200 text-sm">Verified</span>
                  <span className="text-fuchsia-100 font-bold">{summaryStats.authorVerification.verified}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fuchsia-200 text-sm">Not Verified</span>
                  <span className="text-fuchsia-100 font-bold">{summaryStats.authorVerification.notVerified}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fuchsia-200 text-sm">Missing</span>
                  <span className="text-fuchsia-100 font-bold">{summaryStats.authorVerification.missing}</span>
                </div>
                <div className="pt-2 border-t border-fuchsia-500/20">
                  <div className="text-fuchsia-200 text-xs">Verification Rate:</div>
                  <div className="text-fuchsia-100 text-sm font-medium">{((summaryStats.authorVerification.verified / summaryStats.totalEntries) * 100).toFixed(1)}%</div>
                </div>
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
      <div className="overflow-auto h-screen">
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

