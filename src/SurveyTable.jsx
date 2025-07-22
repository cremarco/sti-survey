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

// Grouped imports
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
import schema from '../public/data/sti-survey.schema.json';

// Column helper for type-safe column definitions
const columnHelper = createColumnHelper();

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

// Required fields configuration for validation
const REQUIRED_FIELDS = {
  id: true,
  authors: true,
  firstAuthor: true,
  year: true,
  "title.text": true,
  conferenceJournal: true,
  "mainMethod.type": true,
  "mainMethod.technique": true,
  "domain.domain": true,
  "coreTasks.cta": true,
  "coreTasks.cpa": true,
  "coreTasks.cea": true,
  "coreTasks.cnea": true,
  "revision.type": true,
  license: true,
  "inputs.typeOfTable": true,
  "inputs.kg.tripleStore": true,
  output: true,
  checkedByAuthor: true,
  doi: true,
};

// Utility functions (outside component)
const getTypeBadgeColor = (type) => METHOD_TYPE_COLORS[type?.toLowerCase()] || "bg-slate-500/20 text-slate-200";
const getDomainBadgeColor = (domain) => DOMAIN_COLORS[domain?.toLowerCase()] || "bg-neutral-500/20 text-neutral-200";
const getUserRevisionBadgeColor = (type) => USER_REVISION_COLORS[type?.toLowerCase()] || "bg-violet-500/20 text-violet-200";
const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "object" && !Array.isArray(value)) return Object.keys(value).length === 0;
  return false;
};
const formatDate = (dateString) => {
  if (!dateString || dateString.trim() === "") return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const getNestedValue = (obj, path) => {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
};
const isRequiredFieldMissing = (row, fieldPath) => {
  if (!REQUIRED_FIELDS[fieldPath]) return false;
  const value = getNestedValue(row, fieldPath);
  return isEmpty(value);
};

// Cell rendering components
const MissingFieldCell = ({ value, isMissing }) => (
  <span className={isMissing ? "bg-red-500/20 text-red-200 px-2 py-1 rounded" : ""}>
    {value || (isMissing ? "MISSING" : "")}
  </span>
);
const TaskCell = ({ value, isMissing }) => {
  if (isMissing) return <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>;
  const iconClass = value ? "material-icons-round text-green-500 text-lg" : "material-icons-round text-red-500 text-lg";
  const iconName = value ? "done" : "clear";
  return <span className={iconClass}>{iconName}</span>;
};
const StepCell = ({ value }) => {
  const hasContent = Boolean(value?.trim());
  const iconClass = hasContent ? "material-icons-round text-green-500 text-lg" : "material-icons-round text-red-500 text-lg";
  const iconName = hasContent ? "done" : "clear";
  return <span className={iconClass}>{iconName}</span>;
};
const MainMethodCell = ({ mainMethod, row }) => {
  const { type, tech } = mainMethod || {};
  if (!type && !tech) return "";
  const isTypeMissing = isRequiredFieldMissing(row, "mainMethod.type");
  const isTechMissing = isRequiredFieldMissing(row, "mainMethod.technique");
  const typeBadgeClass = type ? `inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium w-16 ${getTypeBadgeColor(type)}` : "bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px] font-medium w-16";
  return (
    <div className="flex items-center gap-2">
      {(type || isTypeMissing) && (
        <span className={typeBadgeClass}>{type || "MISSING"}</span>
      )}
      {(tech || isTechMissing) && (
        <span className={tech ? "text-[10px] text-neutral-400" : "bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px]"}>{tech || "MISSING"}</span>
      )}
    </div>
  );
};
const DomainCell = ({ domain, row }) => {
  const domainValue = domain?.domain || "";
  const typeValue = domain?.type || "";
  if (!domainValue && !typeValue) return "";
  const isDomainMissing = isRequiredFieldMissing(row, "domain.domain");
  const domainBadgeClass = domainValue ? `inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium w-20 ${getDomainBadgeColor(domainValue)}` : "bg-red-500/20 text-red-200 px-2 py-1 rounded text-[10px] font-medium w-20";
  return (
    <div className="flex items-center gap-2">
      {(domainValue || isDomainMissing) && (
        <span className={domainBadgeClass}>{domainValue || "MISSING"}</span>
      )}
      {typeValue && <span className="text-[10px] text-neutral-400">{typeValue}</span>}
    </div>
  );
};
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
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-800 rounded-lg shadow-lg text-xs text-neutral-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none min-w-[120px]">
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

// Collapsible navigation component
const CollapsibleNavigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <div className="fixed top-6 left-0 z-30">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative bg-neutral-900 hover:bg-neutral-800 text-neutral-300 px-4 py-3 rounded-r-xl shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 group flex items-center justify-center"
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

function SurveyTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);

  // Extract color mapping and taxonomy from schema _uiMeta
  const headerColors = useMemo(() => {
    const meta = schema._uiMeta || {};
    const colors = {};
    for (const key in meta) {
      if (meta[key].color) colors[key] = meta[key].color;
    }
    return colors;
  }, [schema]);
  const headerTaxonomy = useMemo(() => {
    const meta = schema._uiMeta || {};
    const taxonomy = {};
    for (const key in meta) {
      if (meta[key].taxonomy) taxonomy[key] = meta[key].taxonomy;
    }
    return taxonomy;
  }, [schema]);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(import.meta.env.BASE_URL + 'data/sti-survey.json');
        if (!response.ok) throw new Error('Failed to load data');
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

  // Column definitions
  const columns = useMemo(() => [
    columnHelper.display({
      id: "rowNumber",
      header: "#",
      cell: (info) => <RowNumberCell row={info.row} index={info.row.index} />, // Always first
      enableSorting: false,
      meta: { align: 'center' }
    }),
    columnHelper.accessor("id", {
      header: () => <span>ID</span>,
      cell: (info) => <span className="text-[10px] text-neutral-400 font-mono">{info.getValue()}</span>,
      enableSorting: false,
      meta: { align: 'center' }
    }),
    columnHelper.accessor("added", {
      header: () => <span>Added</span>,
      cell: (info) => {
        const addedValue = info.getValue();
        const formattedDate = formatDate(addedValue);
        if (formattedDate) {
          return (
            <div className="flex flex-col items-center">
              <span className="text-xs text-neutral-200 font-medium">{formattedDate}</span>
              {addedValue !== formattedDate && (
                <span className="text-[10px] text-neutral-500" title={`Original: ${addedValue}`}>{addedValue}</span>
              )}
            </div>
          );
        } else {
          return <span className="text-xs text-neutral-500 italic">-</span>;
        }
      },
      enableSorting: true,
      meta: { align: 'center' }
    }),
    columnHelper.accessor("year", {
      header: () => <span>Year</span>,
      cell: (info) => info.getValue(),
      enableSorting: true,
      meta: { align: 'center' }
    }),
    columnHelper.accessor("firstAuthor", {
      header: () => <span>First Author</span>,
      cell: (info) => <MissingFieldCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'firstAuthor')} />,
      enableSorting: false,
    }),
    columnHelper.accessor("authors", {
      header: () => <span>Authors</span>,
      cell: (info) => {
        const authors = info.getValue();
        if (!authors || authors.length === 0) return <span className="text-neutral-500 text-[10px]">No authors listed</span>;
        return <span className="text-[10px] text-neutral-400">{authors.join(", ")}</span>;
      },
      enableSorting: false,
    }),
    columnHelper.accessor("title.text", {
      header: () => <span>Text</span>,
      cell: (info) => {
        const titleText = info.getValue();
        const link = info.row.original.title?.link;
        const isMissing = isRequiredFieldMissing(info.row.original, 'title.text');
        return (
          <div className="flex items-center gap-2">
            <MissingFieldCell value={titleText} isMissing={isMissing} />
            {link && link.trim() !== '' && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors" title="Open link">
                <span className="material-icons-round text-sm">launch</span>
              </a>
            )}
          </div>
        );
      },
      enableSorting: false,
    }),
    columnHelper.accessor("conferenceJournal", {
      header: () => <span>Conference/Journal</span>,
      cell: (info) => <MissingFieldCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'conferenceJournal')} />,
      enableColumnFilter: true,
      enableFacetedUniqueValues: true,
      enableSorting: false,
      filterFn: (row, columnId, filterValue) => {
        if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
        return filterValue.includes(row.getValue(columnId));
      },
    }),
    columnHelper.accessor("nameOfApproach", {
      header: () => <span>Name of Approach</span>,
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    // Core Tasks group
    {
      id: "coreTasks",
      header: () => <span style={{ color: headerColors.coreTasks }}>{headerTaxonomy.coreTasks ? headerTaxonomy.coreTasks + ' - ' : ''}Core Tasks</span>,
      columns: [
        columnHelper.accessor(row => row.coreTasks?.cta, {
          id: "cta",
          header: () => <span>CTA</span>,
          cell: (info) => <TaskCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'coreTasks.cta')} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.coreTasks?.cpa, {
          id: "cpa",
          header: () => <span>CPA</span>,
          cell: (info) => <TaskCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'coreTasks.cpa')} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.coreTasks?.cea, {
          id: "cea",
          header: () => <span>CEA</span>,
          cell: (info) => <TaskCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'coreTasks.cea')} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.coreTasks?.cnea, {
          id: "cnea",
          header: () => <span>CNEA</span>,
          cell: (info) => <TaskCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'coreTasks.cnea')} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
      ],
    },
    // Support Tasks group
    {
      id: "supportTasks",
      header: () => <span style={{ color: headerColors.supportTasks }}>{headerTaxonomy.supportTasks ? headerTaxonomy.supportTasks + ' - ' : ''}Support Tasks</span>,
      columns: [
        columnHelper.accessor(row => row.supportTasks?.dataPreparation?.description || "", {
          id: "dataPreparation",
          header: () => <span>Data Preparation</span>,
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.subjectDetection || "", {
          id: "subjectDetection",
          header: () => <span>Subject Detection</span>,
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.columnClassification || "", {
          id: "columnClassification",
          header: () => <span>Column Classification</span>,
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.typeAnnotation || "", {
          id: "typeAnnotation",
          header: () => <span>Type Annotation</span>,
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.predicateAnnotation || "", {
          id: "predicateAnnotation",
          header: () => <span>Predicate Annotation</span>,
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.datatypeAnnotation || "", {
          id: "datatypeAnnotation",
          header: () => <span>Datatype Annotation</span>,
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.entityLinking?.description || "", {
          id: "entityLinking",
          header: () => <span>Entity Linking</span>,
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.nilAnnotation || "", {
          id: "nilAnnotation",
          header: () => <span>Nil Annotation</span>,
          cell: (info) => <StepCell value={info.getValue()} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
      ],
    },
    columnHelper.accessor(row => {
      const type = row.mainMethod?.type || "";
      const tech = row.mainMethod?.technique || "";
      return { type, tech };
    }, {
      id: "mainMethod",
      header: () => <span style={{ color: headerColors.mainMethod }}>{headerTaxonomy.mainMethod ? headerTaxonomy.mainMethod + ' - ' : ''}Main Method</span>,
      cell: (info) => <MainMethodCell mainMethod={info.getValue()} row={info.row.original} />,
      enableSorting: false,
    }),
    // Type (Revision) column - before Domain
    columnHelper.accessor(row => row.revision?.type || "", {
      id: "revision",
      header: () => <span style={{ color: headerColors.revision }}>{headerTaxonomy.revision ? headerTaxonomy.revision + ' - ' : ''}Type</span>,
      cell: (info) => {
        const value = info.getValue();
        const isMissing = isRequiredFieldMissing(info.row.original, 'revision.type');
        const description = info.row.original.revision?.description;
        if (isMissing) return <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>;
        if (description && description.trim() !== "") {
          return (
            <div className="relative group inline-flex items-center">
              <span className={`inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium ${getUserRevisionBadgeColor(value)} cursor-pointer`} style={{ textTransform: 'lowercase' }}>
                {value}
                <span className="material-icons-round ml-1 align-middle leading-none" style={{ fontSize: '16px' }}>info_outline</span>
              </span>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-800 rounded-lg shadow-lg text-xs text-neutral-300 whitespace-pre-line opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none min-w-[120px] max-w-xs">
                {description}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
          );
        }
        return (
          <span className={`inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium ${getUserRevisionBadgeColor(value)}`} style={{ textTransform: 'lowercase' }}>{value}</span>
        );
      },
      enableSorting: false,
    }),
    // Domain column - after Type
    columnHelper.accessor(row => row.domain, {
      id: "domain",
      header: () => <span style={{ color: headerColors.domain }}>{headerTaxonomy.domain ? headerTaxonomy.domain + ' - ' : ''}Domain</span>,
      cell: (info) => <DomainCell domain={info.getValue()} row={info.row.original} />,
      enableSorting: false,
    }),
    columnHelper.accessor(row => row.validation || "", {
      id: "validation",
      header: () => <span style={{ color: headerColors.validation }}>{headerTaxonomy.validation ? headerTaxonomy.validation + ' - ' : ''}Validation</span>,
      cell: (info) => <MissingFieldCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'validation')} />,
      enableSorting: false,
    }),
    columnHelper.accessor(row => row.codeAvailability || "", {
      id: "codeAvailability",
      header: () => <span style={{ color: headerColors.codeAvailability }}>{headerTaxonomy.codeAvailability ? headerTaxonomy.codeAvailability + ' - ' : ''}Code Availability</span>,
      cell: (info) => {
        const value = info.getValue();
        if (!value || value.trim() === "") return <span className="material-icons-round text-red-500 text-lg">clear</span>;
        return (
          <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center text-blue-400 hover:text-blue-200" title="Open code link">
            <span className="material-icons-round">launch</span>
          </a>
        );
      },
      enableSorting: false,
      meta: { align: 'center' },
    }),
    columnHelper.accessor(row => row.license || "", {
      id: "license",
      header: () => <span style={{ color: headerColors.license }}>{headerTaxonomy.license ? headerTaxonomy.license + ' - ' : ''}License</span>,
      cell: (info) => <span className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium bg-neutral-500/20 text-neutral-200">{info.getValue()}</span>,
      enableSorting: false,
      meta: { align: 'center' },
    }),
    // Inputs group
    {
      id: "inputs",
      header: () => <span style={{ color: headerColors.inputs }}>{headerTaxonomy.inputs ? headerTaxonomy.inputs + ' - ' : ''}Inputs</span>,
      columns: [
        columnHelper.accessor(row => row.inputs?.typeOfTable || "", {
          id: "typeOfTable",
          header: () => <span>Type of Table</span>,
          cell: (info) => <MissingFieldCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'inputs.typeOfTable')} />,
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.inputs?.kg?.tripleStore || "", {
          id: "tripleStore",
          header: () => <span>Triple Store</span>,
          cell: (info) => <MissingFieldCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'inputs.kg.tripleStore')} />,
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.inputs?.kg?.index || "", {
          id: "kgIndex",
          header: () => <span>Index</span>,
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
      ],
    },
    columnHelper.accessor(row => row.output || "", {
      id: "output",
      header: () => <span style={{ color: headerColors.output }}>{headerTaxonomy.output ? headerTaxonomy.output + ' - ' : ''}Output</span>,
      cell: (info) => <MissingFieldCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'output')} />,
      enableSorting: false,
    }),
    columnHelper.accessor(row => row.applicationPurpose, {
      id: "applicationPurpose",
      header: () => <span style={{ color: headerColors.applicationPurpose }}>{headerTaxonomy.applicationPurpose ? headerTaxonomy.applicationPurpose + ' - ' : ''}Application Purpose</span>,
      cell: (info) => <MissingFieldCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'applicationPurpose')} />,
      enableSorting: false,
    }),
    columnHelper.accessor(row => row.userInterfaceTool, {
      id: "userInterfaceTool",
      header: () => <span style={{ color: headerColors.userInterfaceTool }}>{headerTaxonomy.userInterfaceTool ? headerTaxonomy.userInterfaceTool + ' - ' : ''}User Interface Tool</span>,
      cell: (info) => <MissingFieldCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'userInterfaceTool')} />,
      enableSorting: false,
    }),
    columnHelper.accessor(row => row.checkedByAuthor, {
      id: "checkedByAuthor",
      header: "Checked by Author",
      cell: (info) => {
        const value = info.getValue();
        const isMissing = isRequiredFieldMissing(info.row.original, 'checkedByAuthor');
        if (isMissing) return <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>;
        return value ? <span className="material-icons-round text-green-500 text-lg">done</span> : <span className="material-icons-round text-red-500 text-lg">clear</span>;
      },
      enableSorting: false,
    }),
    columnHelper.accessor(row => row.checkedByAi, {
      id: "checkedByAi",
      header: "Checked by AI",
      cell: (info) => {
        const value = info.getValue();
        return value ? <span className="material-icons-round text-green-500 text-lg">done</span> : <span className="material-icons-round text-red-500 text-lg">clear</span>;
      },
      enableSorting: false,
      meta: { align: 'center' },
    }),
    columnHelper.accessor(row => row.doi, {
      id: "doi",
      header: "DOI",
      cell: (info) => <MissingFieldCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'doi')} />,
      enableSorting: false,
    }),
    columnHelper.accessor(row => row.citations, {
      id: "citations",
      header: "Citations",
      cell: (info) => {
        const value = info.getValue();
        if (Array.isArray(value)) return <span className="text-[10px] text-neutral-400">{value.length}</span>;
        return <span className="text-[10px] text-neutral-400">-</span>;
      },
      enableSorting: false,
    }),
    columnHelper.accessor(row => Array.isArray(row.citations) ? row.citations.length : 0, {
      id: "citationsCount",
      header: "Citations",
      cell: (info) => <span className="text-[10px] text-neutral-400">{info.getValue()}</span>,
      enableSorting: true,
      meta: { align: 'center' }
    }),
  ], [headerColors, headerTaxonomy]);

  // React Table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { columnFilters, sorting },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-neutral-300 text-lg">Loading data...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-red-400 bg-red-900/20 rounded-lg p-6 text-lg">Error: {error}</div>
      </div>
    );
  }
  return (
    <div className="bg-neutral-900 h-screen overflow-auto relative">
      <CollapsibleNavigation />
      <table className="w-full table-auto text-xs">
        <thead className="bg-neutral-800 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  className="px-4 py-2 text-center text-xs font-semibold text-neutral-300"
                  onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                  style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
            const missingFields = Object.keys(REQUIRED_FIELDS).filter(field => isRequiredFieldMissing(row.original, field));
            const hasMissingFields = missingFields.length > 0;
            return (
              <tr
                key={row.id}
                className={`hover:bg-neutral-700 transition-colors duration-150 ${index % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-800'} ${hasMissingFields ? 'border-l-4 border-l-red-500' : ''}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-4 py-2 text-xs text-neutral-300 ${cell.column.columnDef.meta?.align === 'center' ? 'text-center' : 'text-left'}`}
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