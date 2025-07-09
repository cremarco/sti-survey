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

// Define the data type
const columnHelper = createColumnHelper();

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [showFacetFilter, setShowFacetFilter] = useState(false);
  const filterRef = useRef();

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

  // Colonne stabili con useMemo
  const columns = useMemo(() => [
    columnHelper.display({
      id: "rowNumber",
      header: "#",
      cell: (info) => info.row.index + 1,
      enableSorting: false,
    }),
    columnHelper.accessor("year", {
      header: "Year",
      cell: (info) => info.getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor("author", {
      header: "First Author",
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    columnHelper.accessor("name-of-approach", {
      header: "Name of Approach",
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    columnHelper.accessor(row => {
      const type = row["main-method"]?.type || "";
      const tech = row["main-method"]?.technique || "";
      if (type && tech) return `${type}, ${tech}`;
      return type || tech || "";
    }, {
      id: "main-method",
      header: "Main Method",
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    columnHelper.accessor(row => row["domain"]?.domain || "", {
      id: "domain-domain",
      header: "Domain",
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    columnHelper.accessor(row => row["domain"]?.type || "", {
      id: "domain-type",
      header: "Domain Type",
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    columnHelper.accessor("title.text", {
      header: "Title",
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    columnHelper.accessor(row => row["conference-journal"], {
      id: "conference-journal",
      header: "Conference/Journal",
      cell: (info) => info.getValue(),
      enableColumnFilter: true,
      enableFacetedUniqueValues: true,
      enableSorting: false,
      filterFn: (row, columnId, filterValue) => {
        if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
        return filterValue.includes(row.getValue(columnId));
      },
    }),
    // Grouped Task columns
    {
      header: "Task",
      columns: [
        columnHelper.accessor(row => row.tasks?.cta, {
          id: "cta",
          header: "CTA",
          cell: (info) => info.getValue() ? "✔️" : "",
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.tasks?.cpa, {
          id: "cpa",
          header: "CPA",
          cell: (info) => info.getValue() ? "✔️" : "",
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.tasks?.cea, {
          id: "cea",
          header: "CEA",
          cell: (info) => info.getValue() ? "✔️" : "",
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.tasks?.cnea, {
          id: "cnea",
          header: "CNEA",
          cell: (info) => info.getValue() ? "✔️" : "",
          enableSorting: false,
        }),
      ],
    },
    // Grouped Steps columns
    {
      header: "Steps",
      columns: [
        columnHelper.accessor(row => row.steps?.["data-preparation"]?.description || "", {
          id: "data-preparation",
          header: "Data Preparation",
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.steps?.["subject-detection"] || "", {
          id: "subject-detection",
          header: "Subject Detection",
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.steps?.["column-analysis"] || "", {
          id: "column-analysis",
          header: "Column Analysis",
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.steps?.["type-annotation"] || "", {
          id: "type-annotation",
          header: "Type Annotation",
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.steps?.["predicate-annotation"] || "", {
          id: "predicate-annotation",
          header: "Predicate Annotation",
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.steps?.["datatype-annotation"] || "", {
          id: "datatype-annotation",
          header: "Datatype Annotation",
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.steps?.["entity-linking"]?.description || "", {
          id: "entity-linking",
          header: "Entity Linking",
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
        columnHelper.accessor(row => row.steps?.["nil-annotation"] || "", {
          id: "nil-annotation",
          header: "NIL Annotation",
          cell: (info) => info.getValue(),
          enableSorting: false,
        }),
      ],
    },
  ], []);

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

  // Chiudi il filtro facet se clicchi fuori
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFacetFilter(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-300 text-lg">Loading data...</div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-900" style={{ position: 'relative' }}>
      <div className="p-4">
        {/* Facet filter per Conference/Journal */}
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
      <div className="overflow-auto h-screen">
        <table className="w-full table-auto">
          <thead className="bg-gray-800 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th 
                    key={header.id}
                    colSpan={header.colSpan}
                    className="px-6 py-4 text-center text-sm font-semibold text-gray-300 border-b border-gray-700"
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
            {table.getRowModel().rows.map((row) => (
              <tr 
                key={row.id}
                className="hover:bg-gray-800 border-b border-gray-700 transition-colors duration-150"
              >
                {row.getVisibleCells().map((cell) => (
                  <td 
                    key={cell.id}
                    className="px-6 py-4 text-sm text-gray-300"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination Controls */}
      </div>
    </div>
  );
}

export default App;
