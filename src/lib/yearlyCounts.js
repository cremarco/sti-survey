export function buildYearlyCounts(data, keys, getKeys) {
  const byYear = new Map();
  const emptyCounts = () => Object.fromEntries(keys.map((key) => [key, 0]));

  for (const row of data) {
    if (!Number.isInteger(row.year)) continue;
    if (!byYear.has(row.year)) byYear.set(row.year, { year: row.year, total: 0, counts: emptyCounts() });
    const year = byYear.get(row.year);
    const present = new Set(getKeys(row));
    year.total += 1;
    for (const key of keys) {
      if (present.has(key)) year.counts[key] += 1;
    }
  }

  if (byYear.size === 0) return [];
  const years = [...byYear.keys()];
  const entries = [];
  // Keep the publication timeline continuous, including years with no papers.
  for (let year = Math.min(...years); year <= Math.max(...years); year += 1) {
    entries.push(byYear.get(year) ?? { year, total: 0, counts: emptyCounts() });
  }
  return entries;
}

export function pickYearLabels(years, spacing, minimumGap) {
  if (years.length < 2) return years;
  const stride = Math.max(1, Math.ceil(minimumGap / Math.max(1, spacing)));
  const labels = years.filter((_, i) => i % stride === 0);
  const finalYear = years[years.length - 1];
  if (labels.length > 1 && labels[labels.length - 1] !== finalYear) {
    labels[labels.length - 1] = finalYear;
  }
  return labels;
}
