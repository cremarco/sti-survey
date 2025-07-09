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
      header: "Source",
      cell: (info) => (
        <MissingFieldCell 
          value={info.getValue()} 
          isMissing={isRequiredFieldMissing(info.row.original, 'license')} 
        />
      ),
      enableSorting: false,
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

    const licenseDistribution = data.reduce((acc, row) => {
      const license = row['license'] || 'N/A';
      acc[license] = (acc[license] || 0) + 1;
      return acc;
    }, {});

    const taskCounts = { cta: 0, cpa: 0, cea: 0, cnea: 0 };
    data.forEach(row => {
      if (row.tasks?.cta) taskCounts.cta++;
      if (row.tasks?.cpa) taskCounts.cpa++;
      if (row.tasks?.cea) taskCounts.cea++;
      if (row.tasks?.cnea) taskCounts.cnea++;
    });
    
    return {
      totalEntries,
      entriesWithMissingFields,
      totalMissingFields,
      mostMissing,
      mainMethodTypeDistribution,
      domainDistribution,
      yearRange,
      approachesWithCode,
      licenseDistribution,
      taskCounts,
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
        {/* Summary Statistics */}
        <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-gray-200 mb-2">Missing Required Fields Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-gray-300">
              <span className="font-medium">Total entries:</span> {summaryStats.totalEntries}
            </div>
            <div className="text-gray-300">
              <span className="font-medium">Entries with missing fields:</span> {summaryStats.entriesWithMissingFields}
            </div>
            <div className="text-gray-300">
              <span className="font-medium">Total missing fields:</span> {summaryStats.totalMissingFields}
            </div>
            <div className="text-gray-300">
              <span className="font-medium">Most missing:</span> {summaryStats.mostMissing}
            </div>
          </div>
        </div>

        {/* Overall Data Snapshot */}
        <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-gray-200 mb-3">Overall Data Snapshot</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
            <div>
              <span className="font-medium text-gray-300">Year Range:</span>
              <span className="text-gray-400 ml-1">{summaryStats.yearRange.min} - {summaryStats.yearRange.max}</span>
            </div>
            <div>
              <span className="font-medium text-gray-300">Approaches with Code:</span>
              <span className="text-gray-400 ml-1">{summaryStats.approachesWithCode}</span>
            </div>

            <div className="col-span-full sm:col-span-1 md:col-span-2"> {/* Allow more space for distributions */}
              <span className="font-medium text-gray-300">Main Method Types:</span>
              <div className="text-gray-400 mt-1 space-y-0.5 text-xs">
                {Object.entries(summaryStats.mainMethodTypeDistribution).map(([type, count]) => (
                  <div key={type} className="flex justify-between">
                    <span>{type}:</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-full sm:col-span-1 md:col-span-2">
              <span className="font-medium text-gray-300">Domains:</span>
              <div className="text-gray-400 mt-1 space-y-0.5 text-xs">
                {Object.entries(summaryStats.domainDistribution).map(([domain, count]) => (
                  <div key={domain} className="flex justify-between">
                    <span>{domain}:</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-full sm:col-span-1 md:col-span-2">
              <span className="font-medium text-gray-300">Licenses:</span>
              <div className="text-gray-400 mt-1 space-y-0.5 text-xs">
                {Object.entries(summaryStats.licenseDistribution).map(([license, count]) => (
                  <div key={license} className="flex justify-between">
                    <span>{license}:</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-full sm:col-span-2 md:col-span-2">
              <span className="font-medium text-gray-300">Tasks Addressed:</span>
              <div className="grid grid-cols-2 gap-x-4 text-gray-400 mt-1 text-xs">
                <div>CTA: {summaryStats.taskCounts.cta}</div>
                <div>CPA: {summaryStats.taskCounts.cpa}</div>
                <div>CEA: {summaryStats.taskCounts.cea}</div>
                <div>CNEA: {summaryStats.taskCounts.cnea}</div>
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

