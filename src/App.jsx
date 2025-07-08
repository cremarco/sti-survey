import { useState, useEffect, useRef } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
} from "@tanstack/react-table";

// Define the data type
const columnHelper = createColumnHelper();

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columnFilters, setColumnFilters] = useState([]);
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

  // Definizione colonne DENTRO il componente per accedere allo stato
  const columns = [
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
    columnHelper.accessor("title.text", {
      header: "Title",
      cell: (info) => info.getValue(),
      enableSorting: false,
    }),
    columnHelper.accessor(row => row["conference-journal"], {
      id: "conference-journal",
      header: "Conference/Journal",
      cell: (info) => info.getValue(),
      enableColumnFilter: false,
      enableFacetedUniqueValues: false,
      // filterFn rimosso
      enableSorting: false,
    }),
  ];

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
    },
    onColumnFiltersChange: setColumnFilters,
  });

  // Chiudi il filtro facet se clicchi fuori
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        // setShowFacetFilter(false); // This line is removed
      }
    }
    // if (showFacetFilter) { // This line is removed
    document.addEventListener('mousedown', handleClickOutside);
    // } else { // This line is removed
    //   document.removeEventListener('mousedown', handleClickOutside); // This line is removed
    // } // This line is removed
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []); // This line is changed

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
      {/* Rimuovo FacetFilterDropdown e tutto il relativo stato */}
      <div className="p-4">
        {/* Rimuovo il filtro facet sempre visibile sopra la tabella */}
      </div>
      <div className="overflow-auto h-screen">
        <table className="w-full table-auto">
          <thead className="bg-gray-800 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th 
                    key={header.id}
                    className="px-6 py-4 text-left text-sm font-semibold text-gray-300 border-b border-gray-700"
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
      </div>
    </div>
  );
}

export default App;
