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
import { useState, useMemo, useCallback } from "react";
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
import Icon from "./Icon";
import schema from '../public/data/sti-survey.schema.json';
import { REQUIRED_FIELD_PATHS, isRequiredFieldMissing } from "./lib/surveyValidation";

// Column helper for type-safe column definitions
const columnHelper = createColumnHelper();

// Unified color scheme for consistent styling
const UNIFIED_COLORS = {
  // Primary text color for ID, dates, authors, journal/conf, domain details, method details
  primaryText: '#e5e7eb', // neutral-200
  secondaryText: '#9ca3af', // neutral-400
  accentText: '#6b7280', // neutral-500
  
  // Badge colors using schema colors with consistent opacity
  badgeOpacity: '20', // 12% opacity in hex
  
  // Status colors
  success: '#10b981', // emerald-500
  error: '#ef4444', // red-500
  warning: '#f59e0b', // amber-500
  info: '#3b82f6', // blue-500
};

// Utility functions (outside component)

const TAXONOMY_GROUP_LABELS = {
  systemLevel: 'System level',
  resourcheImplementation: 'Implementation',
  dataInterface: 'Data interface',
};

// Colors aligned with the rendered Taxonomy labels (src/Taxonomy.jsx radial palette)
const TAXONOMY_HEADER_COLORS = {
  coreTasks: '#ef4444',
  supportTasks: '#f97316',
  applicationPurpose: '#f59e0b',
  mainMethod: '#eab308',
  systemLevel: '#84cc16',
  revision: '#22c55e',
  domain: '#10b981',
  codeAvailability: '#14b8a6',
  resourcheImplementation: '#06b6d4',
  license: '#0ea5e9',
  userInterfaceTool: '#3b82f6',
  inputs: '#6366f1',
  dataInterface: '#8b5cf6',
  output: '#8b5cf6',
};

const getAttributeColor = (sectionKey) => {
  return (
    TAXONOMY_HEADER_COLORS[sectionKey] ||
    schema._uiMeta?.[sectionKey]?.color ||
    UNIFIED_COLORS.primaryText
  );
};

const SCHEMA_PROPERTIES = schema.properties || {};

const getSchemaProperty = (path) => {
  if (!path) return null;

  const segments = path.split('.');
  let current = { properties: SCHEMA_PROPERTIES };

  for (const segment of segments) {
    current = current?.properties?.[segment];
    if (!current) return null;
  }

  return current;
};

const getSchemaLabel = (path, fallback) => getSchemaProperty(path)?.label || fallback;

const formatTaxonomyChildLabel = (value) => {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (value.toLowerCase() === 'kg') return 'KG';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const getTaxonomyChildLabel = (sectionKey, childValue, fallback) => {
  const children = schema._uiTaxonomyChildren?.[sectionKey];
  if (!Array.isArray(children)) return fallback;

  const found = children.find(
    (candidate) => String(candidate).toLowerCase() === String(childValue).toLowerCase()
  );

  return found ? formatTaxonomyChildLabel(found) : fallback;
};

// Function to count approaches with data preparation
const countDataPreparationApproaches = (data) => {
  return data.filter(row => {
    const dataPrep = row.supportTasks?.dataPreparation?.description;
    return dataPrep && dataPrep.trim() !== "";
  }).length;
};

// Generic function to count approaches for any support task
const countSupportTaskApproaches = (data, taskPath) => {
  return data.filter(row => {
    let value;
    if (taskPath.includes('.')) {
      // For nested properties like entityLinking.description or coreTasks.cta
      const parts = taskPath.split('.');
      let current = row;
      for (const part of parts) {
        if (!current) break;
        current = current[part];
      }
      value = current;
    } else {
      // For direct properties
      value = row.supportTasks?.[taskPath];
    }
    
    // Handle boolean values (for core tasks) and string values (for support tasks)
    if (typeof value === 'boolean') {
      return value === true;
    } else if (typeof value === 'string') {
      return value && value.trim() !== "";
    }
    return false;
  }).length;
};
// Unified badge color function
const getUnifiedBadgeColor = (baseColor, isMuted = false) => {
  return {
    backgroundColor: `${baseColor}${isMuted ? '14' : UNIFIED_COLORS.badgeOpacity}`,
    color: baseColor
  };
};

// Legacy functions for backward compatibility


const getUserRevisionBadgeColor = (type) => {
  const lower = type?.toLowerCase();
  const baseColor = getAttributeColor('revision');
  return getUnifiedBadgeColor(baseColor, lower === 'none');
};
const formatDate = (dateString) => {
  if (!dateString || dateString.trim() === "") return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// Color utility functions (kept for potential future use)


// Unified cell rendering components
const UnifiedTextCell = ({
  value,
  isMissing,
  align = 'left',
  size = 'text-xs',
}) => {
  const alignClass = align === 'center' ? 'flex justify-center' : '';
  const effectiveTextColor = isMissing ? UNIFIED_COLORS.error : UNIFIED_COLORS.primaryText;
  
  return (
    <div className={alignClass}>
      <span 
        className={`${size} ${isMissing ? 'bg-red-500/20 text-red-200 px-2 py-1' : ''}`}
        style={{ color: isMissing ? undefined : effectiveTextColor }}
      >
        {value || (isMissing ? "MISSING" : "")}
      </span>
    </div>
  );
};

const UnifiedDateCell = ({ value, isMissing, align = 'center' }) => {
  const formattedDate = formatDate(value);
  const alignClass = align === 'center' ? 'flex justify-center' : '';
  
  if (isMissing) {
    return (
      <div className={alignClass}>
        <span className="bg-red-500/20 text-red-200 px-2 py-1">MISSING</span>
      </div>
    );
  }
  
  if (formattedDate) {
    return (
      <div className={alignClass}>
        <div className="flex flex-col items-center">
          <span className="text-xs font-medium" style={{ color: UNIFIED_COLORS.primaryText }}>
            {formattedDate}
          </span>
          {value !== formattedDate && (
            <span className="text-[10px]" style={{ color: UNIFIED_COLORS.accentText }} title={`Original: ${value}`}>
              {value}
            </span>
          )}
        </div>
      </div>
    );
  } else {
    return (
      <div className={alignClass}>
        <span className="text-xs italic" style={{ color: UNIFIED_COLORS.accentText }}>-</span>
      </div>
    );
  }
};

const UnifiedAuthorsCell = ({ authors, isMissing, align = 'left' }) => {
  const alignClass = align === 'center' ? 'flex justify-center' : '';
  
  if (isMissing) {
    return (
      <div className={alignClass}>
        <span className="bg-red-500/20 text-red-200 px-2 py-1">MISSING</span>
      </div>
    );
  }
  
  if (!authors || authors.length === 0) {
    return (
      <div className={alignClass}>
        <span className="text-[10px]" style={{ color: UNIFIED_COLORS.accentText }}>No authors listed</span>
      </div>
    );
  }
  
  return (
    <div className={alignClass}>
      <span className="text-[10px]" style={{ color: UNIFIED_COLORS.secondaryText }}>
        {authors.join(", ")}
      </span>
    </div>
  );
};

const UnifiedVenueCell = ({ venue, isMissing, align = 'center' }) => {
  const alignClass = align === 'center' ? 'flex justify-center' : '';
  
  if (isMissing || !venue) {
    return (
      <div className={alignClass}>
        <span className="bg-red-500/20 text-red-200 px-2 py-1">MISSING</span>
      </div>
    );
  }
  
  return (
    <div className={alignClass}>
      <div className="flex flex-col gap-1">
        <span 
          className={isMissing ? "bg-red-500/20 text-red-200 px-2 py-1 rounded" : ""}
          style={{ color: isMissing ? undefined : UNIFIED_COLORS.primaryText }}
        >
          {venue.acronym || "MISSING"}
        </span>
        {venue.type && (
          <span className="text-[10px] italic" style={{ color: UNIFIED_COLORS.secondaryText }}>
            {venue.type}
          </span>
        )}
      </div>
    </div>
  );
};

// Legacy component for backward compatibility
const MissingFieldCell = ({ value, isMissing, align = 'left' }) => {
  return <UnifiedTextCell value={value} isMissing={isMissing} align={align} />;
};
const TaskCell = ({ value, isMissing, align = 'left' }) => {
  const alignClass = align === 'center' ? 'flex justify-center' : '';
  
  if (isMissing) {
    return (
      <div className={alignClass}>
        <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>
      </div>
    );
  }
  const iconClass = value ? "text-green-500 text-lg" : "text-red-500 text-lg";
  return (
    <div className={alignClass}>
      <Icon name={value ? 'done' : 'clear'} className={iconClass} />
    </div>
  );
};
const StepCell = ({ value, align = 'left' }) => {
  const hasContent = Boolean(value?.trim());
  const iconClass = hasContent ? "text-green-500 text-lg" : "text-red-500 text-lg";
  const alignClass = align === 'center' ? 'flex justify-center' : '';
  
  return (
    <div className={alignClass}>
      <Icon name={hasContent ? 'done' : 'clear'} className={iconClass} />
    </div>
  );
};
const UnifiedMainMethodCell = ({ mainMethod, row, align = 'center' }) => {
  let { type, tech } = mainMethod || {};
  const baseColor = getAttributeColor('mainMethod');
  const badgeClass = 'inline-flex items-center justify-center px-2 py-1 text-[10px] font-medium';
  
  // Normalize type labels
  if (type?.toLowerCase() === 'unsup' || type?.toLowerCase() === 'unsupervised') {
    type = 'Unsupervised';
  } else if (type?.toLowerCase() === 'sup' || type?.toLowerCase() === 'supervised') {
    type = 'Supervised';
  }
  
  const isTypeMissing = isRequiredFieldMissing(row, "mainMethod.type");
  const isTechMissing = isRequiredFieldMissing(row, "mainMethod.technique");
  const alignClass = align === 'center' ? 'flex justify-center' : '';
  
  if (!type && !tech) return "";
  
  const badgeStyle = {
    backgroundColor: baseColor + UNIFIED_COLORS.badgeOpacity,
    color: baseColor
  };
  
  return (
    <div className={alignClass}>
      <div className="flex flex-col items-center gap-1">
        {(type || isTypeMissing) && (
          <span className={badgeClass} style={badgeStyle}>
            {type || "MISSING"}
          </span>
        )}
        {(tech || isTechMissing) && (
          <span 
            className={tech ? "text-[10px] text-center" : "bg-red-500/20 text-red-200 px-2 py-1 text-[10px] text-center"}
            style={{ color: tech ? UNIFIED_COLORS.secondaryText : undefined }}
          >
            {tech || "MISSING"}
          </span>
        )}
      </div>
    </div>
  );
};

const UnifiedDomainCell = ({ domain, row, align = 'center' }) => {
  const domainValue = domain?.domain || "";
  const typeValue = domain?.type || "";
  const baseColor = getAttributeColor('domain');
  const badgeClass = 'inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium';
  
  if (!domainValue && !typeValue) return "";
  
  const isDomainMissing = isRequiredFieldMissing(row, "domain.domain");
  const alignClass = align === 'center' ? 'flex justify-center' : '';
  
  const badgeStyle = {
    backgroundColor: baseColor + UNIFIED_COLORS.badgeOpacity,
    color: baseColor
  };
  
  return (
    <div className={alignClass}>
      <div className="flex flex-col items-center gap-1">
        {(domainValue || isDomainMissing) && (
          <span className={badgeClass} style={badgeStyle}>
            {domainValue || "MISSING"}
          </span>
        )}
        {typeValue && (
          <span className="text-[10px] text-center" style={{ color: UNIFIED_COLORS.secondaryText }}>
            {typeValue}
          </span>
        )}
      </div>
    </div>
  );
};

const ValidationCell = ({ value, isMissing }) => {
  if (isMissing) {
    return <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>;
  }
  
  if (!value || typeof value !== 'object') {
    return <span className="text-neutral-400">No validation data</span>;
  }
  
  const { goldStandard, metrics } = value;
  
  return (
    <div className="text-xs space-y-1">
      {goldStandard && (
        <div className="text-neutral-300">
          <span className="font-medium">GS:</span> {goldStandard}
        </div>
      )}
      {metrics && Array.isArray(metrics) && metrics.length > 0 && (
        <div className="text-neutral-400">
          <span className="font-medium">Metrics:</span> {metrics.join(', ')}
        </div>
      )}
    </div>
  );
};
const RowNumberCell = ({ index }) => {
  return (
    <span>{index + 1}</span>
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
          className="relative bg-neutral-900 hover:bg-neutral-800 text-neutral-300 px-4 py-3 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 group flex items-center justify-center"
          title={isOpen ? "Hide navigation" : "Show navigation"}
        >
          {isOpen ? (
            <Icon name="close" className="text-xl transition-transform duration-300 group-hover:rotate-12 relative z-10" />
          ) : (
            <Icon name="menu" className="text-xl transition-transform duration-300 group-hover:rotate-12 relative z-10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-neutral-700/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </button>
      </div>
      {isOpen && (
        <div className="fixed top-0 left-0 right-0 z-20">
          <Navigation defaultOpen={true} />
        </div>
      )}
    </>
  );
};

// Unified license badge color function
const getLicenseBadgeColor = (license) => {
  const baseColor = getAttributeColor('license');
  const normalized = license?.trim().toLowerCase();
  const isNone = !normalized || normalized === 'not specified' || normalized === 'ns';
  return getUnifiedBadgeColor(baseColor, isNone);
};

function SurveyTable({ data = [] }) {
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
  }, []);
  const headerTaxonomy = useMemo(() => {
    const meta = schema._uiMeta || {};
    const taxonomy = {};
    for (const key in meta) {
      if (meta[key].taxonomy) taxonomy[key] = meta[key].taxonomy;
    }
    return taxonomy;
  }, []);

  const rootTaxonomyHeaders = useMemo(() => {
    const uiMeta = schema._uiMeta || {};
    const uiGroups = schema._uiGroups || {};
    const groupedKeys = new Set(Object.values(uiGroups).flat());

    const rootOrder = [
      ...Object.keys(uiMeta).filter((key) => !groupedKeys.has(key)),
      ...Object.keys(uiGroups),
    ];

    const headers = {};
    rootOrder.forEach((key, index) => {
      if (uiGroups[key]) {
        headers[key] = `${index + 1} ${TAXONOMY_GROUP_LABELS[key] || key}`;
        return;
      }
      headers[key] = `${index + 1} ${getSchemaLabel(key, key)}`;
    });

    return headers;
  }, []);

  const getSectionHeaderColor = useCallback((sectionKey) => {
    return TAXONOMY_HEADER_COLORS[sectionKey] || headerColors[sectionKey] || UNIFIED_COLORS.primaryText;
  }, [headerColors]);

  const getRootHeaderText = useCallback((rootKey, fallback) => {
    return rootTaxonomyHeaders[rootKey] || fallback;
  }, [rootTaxonomyHeaders]);

  const getGroupHeaderColor = useCallback((groupKey) => {
    return getSectionHeaderColor(groupKey);
  }, [getSectionHeaderColor]);

  const getTaxonomyHeaderText = useCallback((sectionKey, schemaPath, fallbackLabel) => {
    const label = getSchemaLabel(schemaPath, fallbackLabel);
    const taxonomyId = headerTaxonomy[sectionKey];
    return taxonomyId ? `${taxonomyId} - ${label}` : label;
  }, [headerTaxonomy]);

  const getCountBadgeStyle = useCallback((sectionKey) => {
    const color = getSectionHeaderColor(sectionKey);
    return {
      backgroundColor: `${color}${UNIFIED_COLORS.badgeOpacity}`,
      color,
    };
  }, [getSectionHeaderColor]);

  // Column definitions
  const columns = useMemo(() => [
    columnHelper.display({
      id: "rowNumber",
      header: "#",
      cell: (info) => <RowNumberCell index={info.row.index} />, // Always first
      enableSorting: false,
      meta: { align: 'center' }
    }),
    columnHelper.accessor("id", {
      header: () => <span>{getSchemaLabel('id', 'ID')}</span>,
      cell: (info) => (
        <span 
          className="text-[10px] font-mono" 
          style={{ color: UNIFIED_COLORS.primaryText }}
        >
          {info.getValue()}
        </span>
      ),
      enableSorting: false,
      meta: { align: 'center' }
    }),
    columnHelper.accessor("added", {
      header: () => <span>{getSchemaLabel('added', 'Added')}</span>,
      cell: (info) => <UnifiedDateCell value={info.getValue()} isMissing={false} align="center" />,
      enableSorting: true,
      meta: { align: 'center' }
    }),
    columnHelper.accessor("year", {
      header: () => <span>{getSchemaLabel('year', 'Year')}</span>,
      cell: (info) => info.getValue(),
      enableSorting: true,
      meta: { align: 'center' }
    }),
    columnHelper.accessor("firstAuthor", {
      header: () => <span>{getSchemaLabel('firstAuthor', 'First Author')}</span>,
      cell: (info) => <UnifiedTextCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'firstAuthor')} align="center" />,
      enableSorting: false,
      meta: { align: 'center' }
    }),
    columnHelper.accessor("authors", {
      header: () => <span>{getSchemaLabel('authors', 'Authors')}</span>,
      cell: (info) => <UnifiedAuthorsCell authors={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'authors')} align="left" />,
      enableSorting: false,
    }),
    columnHelper.accessor("title", {
      header: () => <span>{getSchemaLabel('title', 'Title')}</span>,
      cell: (info) => {
        const titleText = info.getValue();
        const isMissing = isRequiredFieldMissing(info.row.original, 'title');
        return (
          <div className="flex items-center gap-2">
            <MissingFieldCell value={titleText} isMissing={isMissing} />
          </div>
        );
      },
      enableSorting: false,
    }),
    columnHelper.accessor(row => row.venue, {
      id: "venue",
      header: () => <span>{getSchemaLabel('venue', 'Conference/Journal')}</span>,
      cell: (info) => <UnifiedVenueCell venue={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'venue.acronym')} align="center" />,
      enableColumnFilter: true,
      enableFacetedUniqueValues: true,
      enableSorting: false,
      filterFn: (row, columnId, filterValue) => {
        if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
        const venue = row.getValue(columnId);
        return filterValue.includes(venue?.acronym);
      },
      meta: { align: 'center' }
    }),
    columnHelper.accessor("nameOfApproach", {
      header: () => <span>{getSchemaLabel('nameOfApproach', 'Name of Approach')}</span>,
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    columnHelper.accessor("techniqueTags", {
      header: () => <span>{getSchemaLabel('techniqueTags', 'Technique Tags')}</span>,
      cell: (info) => {
        const tags = info.getValue();
        if (!tags || tags.length === 0) {
          const alignClass = info.column.columnDef.meta?.align === 'center' ? 'flex justify-center' : '';
          return (
            <div className={alignClass}>
              <span className="text-neutral-500 text-[10px]">-</span>
            </div>
          );
        }
        const alignClass = info.column.columnDef.meta?.align === 'center' ? 'flex justify-center' : '';
        
        return (
          <div className={alignClass}>
            <div className="flex flex-wrap justify-center gap-1">
              {tags.map((tag, index) => (
                <span key={index} className="inline-flex items-center justify-center px-2 py-1 text-[10px] font-medium text-center" style={{ backgroundColor: 'rgba(100, 116, 139, 0.12)', color: 'rgb(229, 231, 235)' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        );
      },
      enableSorting: false,
      meta: { align: 'center' }
    }),
    // Core Tasks group
    {
      id: "coreTasks",
      header: () => (
        <span style={{ color: getSectionHeaderColor('coreTasks') }}>
          {getRootHeaderText('coreTasks', getTaxonomyHeaderText('coreTasks', 'coreTasks', 'Core Tasks'))}
        </span>
      ),
      columns: [
        columnHelper.accessor(row => row.coreTasks?.cta, {
          id: "cta",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'coreTasks.cta') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('coreTasks') }}>
                  {getSchemaLabel('coreTasks.cta', 'CTA')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('coreTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <TaskCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'coreTasks.cta')} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.coreTasks?.cpa, {
          id: "cpa",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'coreTasks.cpa') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('coreTasks') }}>
                  {getSchemaLabel('coreTasks.cpa', 'CPA')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('coreTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <TaskCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'coreTasks.cpa')} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.coreTasks?.cea, {
          id: "cea",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'coreTasks.cea') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('coreTasks') }}>
                  {getSchemaLabel('coreTasks.cea', 'CEA')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('coreTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <TaskCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'coreTasks.cea')} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.coreTasks?.cnea, {
          id: "cnea",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'coreTasks.cnea') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('coreTasks') }}>
                  {getSchemaLabel('coreTasks.cnea', 'CNEA')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('coreTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <TaskCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'coreTasks.cnea')} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
      ],
    },
    // Support Tasks group
    {
      id: "supportTasks",
      header: () => (
        <span style={{ color: getSectionHeaderColor('supportTasks') }}>
          {getRootHeaderText('supportTasks', getTaxonomyHeaderText('supportTasks', 'supportTasks', 'Support Tasks'))}
        </span>
      ),
      columns: [
        columnHelper.accessor(row => row.supportTasks?.dataPreparation?.description || "", {
          id: "dataPreparation",
          header: () => {
            const dataPrepCount = data.length > 0 ? countDataPreparationApproaches(data) : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('supportTasks') }}>
                  {getSchemaLabel('supportTasks.dataPreparation', 'Data Preparation')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('supportTasks')}>
                  {dataPrepCount}
                </span>
              </div>
            );
          },
          cell: (info) => <StepCell value={info.getValue()} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.columnClassification || "", {
          id: "columnClassification",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'columnClassification') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('supportTasks') }}>
                  {getSchemaLabel('supportTasks.columnClassification', 'Column Classification')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('supportTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <StepCell value={info.getValue()} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.subjectDetection || "", {
          id: "subjectDetection",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'subjectDetection') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('supportTasks') }}>
                  {getSchemaLabel('supportTasks.subjectDetection', 'Subject Detection')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('supportTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <StepCell value={info.getValue()} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.datatypeAnnotation || "", {
          id: "datatypeAnnotation",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'datatypeAnnotation') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('supportTasks') }}>
                  {getSchemaLabel('supportTasks.datatypeAnnotation', 'Datatype Annotation')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('supportTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <StepCell value={info.getValue()} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.entityLinking?.description || "", {
          id: "entityLinking",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'entityLinking.description') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('supportTasks') }}>
                  {getSchemaLabel('supportTasks.entityLinking', 'Entity Linking')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('supportTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <StepCell value={info.getValue()} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.typeAnnotation || "", {
          id: "typeAnnotation",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'typeAnnotation') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('supportTasks') }}>
                  {getSchemaLabel('supportTasks.typeAnnotation', 'Type Annotation')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('supportTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <StepCell value={info.getValue()} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.predicateAnnotation || "", {
          id: "predicateAnnotation",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'predicateAnnotation') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('supportTasks') }}>
                  {getSchemaLabel('supportTasks.predicateAnnotation', 'Predicate Annotation')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('supportTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <StepCell value={info.getValue()} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.supportTasks?.nilAnnotation || "", {
          id: "nilAnnotation",
          header: () => {
            const count = data.length > 0 ? countSupportTaskApproaches(data, 'nilAnnotation') : 0;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: getSectionHeaderColor('supportTasks') }}>
                  {getSchemaLabel('supportTasks.nilAnnotation', 'Nil Annotation')}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium" style={getCountBadgeStyle('supportTasks')}>
                  {count}
                </span>
              </div>
            );
          },
          cell: (info) => <StepCell value={info.getValue()} align={info.column.columnDef.meta?.align} />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
      ],
    },
    columnHelper.accessor(row => row.applicationPurpose, {
      id: "applicationPurpose",
      header: () => (
        <span style={{ color: getSectionHeaderColor('applicationPurpose') }}>
          {getRootHeaderText('applicationPurpose', '3 Application/Purpose')}
        </span>
      ),
      cell: (info) => (
        <MissingFieldCell
          value={info.getValue()}
          isMissing={isRequiredFieldMissing(info.row.original, 'applicationPurpose')}
        />
      ),
      enableSorting: false,
    }),
    {
      id: "systemLevel",
      header: () => (
        <span style={{ color: getGroupHeaderColor('systemLevel') }}>
          {getRootHeaderText('systemLevel', '4 System level')}
        </span>
      ),
      columns: [
        columnHelper.accessor(row => {
          const type = row.mainMethod?.type || "";
          const tech = row.mainMethod?.technique || "";
          return { type, tech };
        }, {
          id: "mainMethod",
          header: () => (
            <span style={{ color: getSectionHeaderColor('mainMethod') }}>
              {getSchemaLabel('mainMethod', 'Methodological')}
            </span>
          ),
          cell: (info) => <UnifiedMainMethodCell mainMethod={info.getValue()} row={info.row.original} align="center" />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
        // Type (Revision) column - before Domain
        columnHelper.accessor(row => row.revision?.type || "", {
          id: "revision",
          header: () => (
            <span style={{ color: getSectionHeaderColor('revision') }}>
              {getSchemaLabel('revision', 'Automation')}
            </span>
          ),
          cell: (info) => {
            const value = info.getValue();
            const isMissing = isRequiredFieldMissing(info.row.original, 'revision.type');
            const description = info.row.original.revision?.description;
            const badgeStyle = getUserRevisionBadgeColor(value);
            const badgeClass = 'inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium';
            const alignClass = info.column.columnDef.meta?.align === 'center' ? 'flex justify-center' : '';
            
            if (isMissing) {
              return (
                <div className={alignClass}>
                  <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>
                </div>
              );
            }
            if (description && description.trim() !== "") {
              return (
                <div className={alignClass}>
                  <div className="relative group inline-flex items-center">
                    <span className={badgeClass} style={badgeStyle}>
                      {value}
                      <Icon name="info_outline" className="ml-1 align-middle leading-none text-[16px]" />
                    </span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-800 shadow-lg text-xs text-neutral-300 whitespace-pre-line opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none min-w-[120px] max-w-xs">
                      {description}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div className={alignClass}>
                <span className={badgeClass} style={badgeStyle}>{value}</span>
              </div>
            );
          },
          enableSorting: false,
          meta: { align: 'center' }
        }),
        // Domain column - after Type
        columnHelper.accessor(row => row.domain, {
          id: "domain",
          header: () => (
            <span style={{ color: getSectionHeaderColor('domain') }}>
              {getSchemaLabel('domain', 'Domain')}
            </span>
          ),
          cell: (info) => <UnifiedDomainCell domain={info.getValue()} row={info.row.original} align="center" />,
          enableSorting: false,
          meta: { align: 'center' }
        }),
      ],
    },
    {
      id: "implementation",
      header: () => (
        <span style={{ color: getGroupHeaderColor('resourcheImplementation') }}>
          {getRootHeaderText('resourcheImplementation', '5 Implementation')}
        </span>
      ),
      columns: [
        columnHelper.accessor(row => row.codeAvailability || "", {
          id: "codeAvailability",
          header: () => (
            <span style={{ color: getSectionHeaderColor('codeAvailability') }}>
              {getSchemaLabel('codeAvailability', 'Code Availability')}
            </span>
          ),
          cell: (info) => {
            const value = info.getValue();
            const alignClass = info.column.columnDef.meta?.align === 'center' ? 'flex justify-center' : '';
            const headerColor = getSectionHeaderColor('codeAvailability');
            const emptyBadgeStyle = getUnifiedBadgeColor(headerColor, true);
            
            if (!value || value.trim() === "") {
              return (
                <div className={alignClass}>
                  <span
                    className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium"
                    style={emptyBadgeStyle}
                  >
                    No
                  </span>
                </div>
              );
            }
            return (
              <div className={alignClass}>
                <span className="inline-flex items-center justify-center px-2 py-1 text-[10px] font-medium" style={{ backgroundColor: headerColor + '20', color: headerColor }}>
                  <a href={value} target="_blank" rel="noopener noreferrer"
                     className="flex items-center justify-center h-full w-full"
                     title="Open code link">
                    <Icon name="launch" className="align-middle leading-none text-[16px]" style={{ color: headerColor }} />
                  </a>
                </span>
              </div>
            );
          },
          enableSorting: false,
          meta: { align: 'center' },
        }),
        columnHelper.accessor(row => row.license || "", {
          id: "license",
          header: () => (
            <span style={{ color: getSectionHeaderColor('license') }}>
              {getSchemaLabel('license', 'License')}
            </span>
          ),
          cell: (info) => {
            const value = info.getValue();
            const badgeStyle = getLicenseBadgeColor(value);
            const badgeClass = 'inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium';
            const alignClass = info.column.columnDef.meta?.align === 'center' ? 'flex justify-center' : '';
            
            return (
              <div className={alignClass}>
                <span className={badgeClass} style={badgeStyle}>{value || 'Not specified'}</span>
              </div>
            );
          },
          enableSorting: false,
          meta: { align: 'center' }
        }),
        columnHelper.accessor(row => row.userInterfaceTool, {
          id: "userInterfaceTool",
          header: () => (
            <span style={{ color: getSectionHeaderColor('userInterfaceTool') }}>
              {getSchemaLabel('userInterfaceTool', 'User Interface/Tool')}
            </span>
          ),
          cell: (info) => (
            <MissingFieldCell
              value={info.getValue()}
              isMissing={isRequiredFieldMissing(info.row.original, 'userInterfaceTool')}
            />
          ),
          enableSorting: false,
        }),
      ],
    },
    {
      id: "dataInterface",
      header: () => (
        <span style={{ color: getGroupHeaderColor('dataInterface') }}>
          {getRootHeaderText('dataInterface', '6 Data interface')}
        </span>
      ),
      columns: [
        // Inputs group
        {
          id: "inputs",
          header: () => (
            <span style={{ color: getSectionHeaderColor('inputs') }}>
              {getSchemaLabel('inputs', 'Inputs')}
            </span>
          ),
          columns: [
            {
              id: "inputsTableGroup",
              header: () => (
                <span style={{ color: getSectionHeaderColor('inputs') }}>
                  {getTaxonomyChildLabel('inputs', 'table', 'Table')}
                </span>
              ),
              columns: [
                columnHelper.accessor(row => row.inputs?.typeOfTable || "", {
                  id: "typeOfTable",
                  header: () => (
                    <span style={{ color: getSectionHeaderColor('inputs') }}>
                      {getSchemaLabel('inputs.typeOfTable', 'Type of Table')}
                    </span>
                  ),
                  cell: (info) => (
                    <MissingFieldCell
                      value={info.getValue()}
                      isMissing={isRequiredFieldMissing(info.row.original, 'inputs.typeOfTable')}
                      align={info.column.columnDef.meta?.align}
                    />
                  ),
                  enableSorting: false,
                  meta: { align: 'center' }
                }),
                columnHelper.accessor(row => row.inputs?.tableSources || [], {
                  id: "tableSources",
                  header: () => (
                    <span style={{ color: getSectionHeaderColor('inputs') }}>
                      {getSchemaLabel('inputs.tableSources', 'Table Sources')}
                    </span>
                  ),
                  cell: (info) => {
                    const sources = info.getValue();
                    const headerColor = getSectionHeaderColor('inputs');
                    if (!sources || sources.length === 0) {
                      const alignClass = info.column.columnDef.meta?.align === 'center' ? 'flex justify-center' : '';
                      return (
                        <div className={alignClass}>
                          <span className="text-neutral-500 text-[10px]">-</span>
                        </div>
                      );
                    }
                    const alignClass = info.column.columnDef.meta?.align === 'center' ? 'flex justify-center' : '';
                    
                    return (
                      <div className={alignClass}>
                        <div className="flex flex-wrap justify-center gap-1">
                          {sources.map((source, index) => (
                            <span key={index} className="inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-medium" style={{ backgroundColor: headerColor + '20', color: headerColor }}>
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  },
                  enableSorting: false,
                  meta: { align: 'center' }
                }),
              ],
            },
            {
              id: "inputsKgGroup",
              header: () => (
                <span style={{ color: getSectionHeaderColor('inputs') }}>
                  {getTaxonomyChildLabel('inputs', 'kg', 'KG')}
                </span>
              ),
              columns: [
                columnHelper.accessor(row => row.kg?.tripleStore || "", {
                  id: "tripleStore",
                  header: () => (
                    <span style={{ color: getSectionHeaderColor('inputs') }}>
                      {getSchemaLabel('kg.tripleStore', 'Triple Store')}
                    </span>
                  ),
                  cell: (info) => (
                    <MissingFieldCell
                      value={info.getValue()}
                      isMissing={isRequiredFieldMissing(info.row.original, 'kg.tripleStore')}
                      align={info.column.columnDef.meta?.align}
                    />
                  ),
                  enableSorting: false,
                  meta: { align: 'center' }
                }),
                columnHelper.accessor(row => row.kg?.index || "", {
                  id: "kgIndex",
                  header: () => (
                    <span style={{ color: getSectionHeaderColor('inputs') }}>
                      {getSchemaLabel('kg.index', 'Index')}
                    </span>
                  ),
                  cell: (info) => info.getValue(),
                  enableSorting: false,
                }),
              ],
            },
          ],
        },
        columnHelper.accessor(row => row.output || "", {
          id: "output",
          header: () => (
            <span style={{ color: getSectionHeaderColor('output') }}>
              {getSchemaLabel('output', 'Output')}
            </span>
          ),
          cell: (info) => (
            <MissingFieldCell
              value={info.getValue()}
              isMissing={isRequiredFieldMissing(info.row.original, 'output')}
              align={info.column.columnDef.meta?.align}
            />
          ),
          enableSorting: false,
          meta: { align: 'center' }
        }),
      ],
    },
    columnHelper.accessor(row => row.validation || "", {
      id: "validation",
      header: () => <span>{getSchemaLabel('validation', 'Validation')}</span>,
      cell: (info) => <ValidationCell value={info.getValue()} isMissing={isRequiredFieldMissing(info.row.original, 'validation')} />,
      enableSorting: false,
    }),
    columnHelper.accessor(row => row.doi, {
      id: "doi",
      header: () => <span>{getSchemaLabel('doi', 'DOI')}</span>,
      cell: (info) => {
        const doiValue = info.getValue();
        const isMissing = isRequiredFieldMissing(info.row.original, 'doi');
        
        if (isMissing) {
          return <span className="bg-red-500/20 text-red-200 px-2 py-1 rounded">MISSING</span>;
        }
        
        if (!doiValue || doiValue.trim() === "") {
          return <span className="text-neutral-500 text-[10px]">-</span>;
        }
        
        // Ensure DOI has proper protocol
        const doiUrl = doiValue.startsWith('http') ? doiValue : `https://doi.org/${doiValue}`;
        
        return (
          <a 
            href={doiUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline text-[10px] break-all"
            title="Open DOI link"
          >
            {doiValue}
          </a>
        );
      },
      enableSorting: false,
    }),
    // Citations column
    columnHelper.accessor(row => Array.isArray(row.citations?.references) ? row.citations.references.length : 0, {
      id: "referencesCount",
      header: () => <span>{getSchemaLabel('citations', 'Citations')}</span>,
      cell: (info) => {
        const referencesCount = info.getValue();
        const alignClass = info.column.columnDef.meta?.align === 'center' ? 'flex justify-center' : '';

        return (
          <div className={alignClass}>
            <span className="text-[10px] text-neutral-400">
              {referencesCount}
            </span>
          </div>
        );
      },
      enableSorting: true,
      meta: { align: 'center' }
    }),
  ], [data, getCountBadgeStyle, getGroupHeaderColor, getRootHeaderText, getSectionHeaderColor, getTaxonomyHeaderText]);

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

  return (
    <div className="bg-neutral-900 h-screen overflow-auto relative">
      <CollapsibleNavigation />
      <table className="w-full table-auto text-xs">
        <thead className="bg-neutral-800 sticky top-0 z-10">
          {(() => {
            const headerGroups = table.getHeaderGroups();
            const maxHeaderDepth = headerGroups.length;

            return headerGroups.map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isLeafHeader = header.subHeaders.length === 0;
                  const computedRowSpan = header.isPlaceholder
                    ? 1
                    : isLeafHeader
                      ? Math.max(1, maxHeaderDepth - header.depth)
                      : 1;

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      rowSpan={computedRowSpan}
                      className={`px-4 py-1 text-center text-xs font-semibold leading-tight text-neutral-300 ${
                        isLeafHeader && computedRowSpan > 1 ? 'align-top' : ''
                      }`}
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
                  );
                })}
              </tr>
            ));
          })()}
        </thead>
        <tbody className="bg-neutral-900">
          {table.getRowModel().rows.map((row, index) => {
            const missingFields = REQUIRED_FIELD_PATHS.filter(field => isRequiredFieldMissing(row.original, field));
            const hasMissingFields = missingFields.length > 0;
            return (
              <tr
                key={row.id}
                className={`hover:bg-neutral-700 transition-colors duration-150 ${index % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-800'} ${hasMissingFields ? 'border-l-4 border-l-red-500' : ''} relative group`}
                title={`Approach ID: ${row.original.id}`}
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
