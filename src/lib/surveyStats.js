import { REQUIRED_FIELD_PATHS, isRequiredFieldMissing } from './surveyValidation';

const SELECTED_TECHNIQUE_TAGS = ['ontology-driven', 'rule-based', 'embeddings', 'transformer', 'CRF'];

const EMPTY_STEPS_COVERAGE = {
  'data-preparation': 0,
  'subject-detection': 0,
  'column-analysis': 0,
  'type-annotation': 0,
  'predicate-annotation': 0,
  'datatype-annotation': 0,
  'entity-linking': 0,
  'nil-annotation': 0,
};

const createBaseAccumulator = (totalEntries) => ({
  totalEntries,
  entriesWithMissingFields: 0,
  totalMissingFields: 0,
  fieldCounts: {},
  mainMethodTypeDistribution: {},
  domainDistribution: {},
  years: [],
  approachesWithCode: 0,
  licenseDistribution: {},
  techniqueTagCounts: {},
  taskCounts: { cta: 0, cpa: 0, cea: 0, cnea: 0 },
  userRevisionDistribution: {},
  stepsCoverage: { ...EMPTY_STEPS_COVERAGE },
  conferenceJournalDistribution: {},
});

const getMostMissing = (fieldCounts) => {
  const mostMissingEntry = Object.entries(fieldCounts).sort(([, a], [, b]) => b - a)[0];
  return mostMissingEntry ? `${mostMissingEntry[0]} (${mostMissingEntry[1]})` : 'None';
};

const getYearRange = (years) => ({
  min: years.length > 0 ? Math.min(...years) : 'N/A',
  max: years.length > 0 ? Math.max(...years) : 'N/A',
});

const withPercentages = (distribution, totalEntries) =>
  Object.fromEntries(
    Object.entries(distribution).map(([key, value]) => [
      key,
      {
        count: value,
        percentage: totalEntries > 0 ? (value / totalEntries) * 100 : 0,
      },
    ])
  );

export const buildBaseSurveyStats = (data) => {
  const safeData = Array.isArray(data) ? data : [];
  const stats = createBaseAccumulator(safeData.length);

  safeData.forEach((row) => {
    const missingFields = REQUIRED_FIELD_PATHS.filter((field) => isRequiredFieldMissing(row, field));
    if (missingFields.length > 0) {
      stats.entriesWithMissingFields += 1;
      stats.totalMissingFields += missingFields.length;
      missingFields.forEach((field) => {
        stats.fieldCounts[field] = (stats.fieldCounts[field] || 0) + 1;
      });
    }

    const methodType = row.mainMethod?.type || 'N/A';
    stats.mainMethodTypeDistribution[methodType] = (stats.mainMethodTypeDistribution[methodType] || 0) + 1;

    const domain = row.domain?.domain || 'N/A';
    stats.domainDistribution[domain] = (stats.domainDistribution[domain] || 0) + 1;

    if (typeof row.year === 'number') {
      stats.years.push(row.year);
    }

    const hasCode =
      (typeof row.codeAvailability === 'string' && row.codeAvailability.trim() !== '') ||
      (typeof row.code === 'string' && row.code.trim() !== '');
    if (hasCode) {
      stats.approachesWithCode += 1;
    }

    const license = row.license || 'N/A';
    stats.licenseDistribution[license] = (stats.licenseDistribution[license] || 0) + 1;

    if (Array.isArray(row.techniqueTags)) {
      row.techniqueTags.forEach((tag) => {
        if (SELECTED_TECHNIQUE_TAGS.includes(tag)) {
          stats.techniqueTagCounts[tag] = (stats.techniqueTagCounts[tag] || 0) + 1;
        }
      });
    }

    if (row.coreTasks?.cta) stats.taskCounts.cta += 1;
    if (row.coreTasks?.cpa) stats.taskCounts.cpa += 1;
    if (row.coreTasks?.cea) stats.taskCounts.cea += 1;
    if (row.coreTasks?.cnea) stats.taskCounts.cnea += 1;

    const userRevisionType = row.revision?.type || 'N/A';
    stats.userRevisionDistribution[userRevisionType] =
      (stats.userRevisionDistribution[userRevisionType] || 0) + 1;

    if (row.supportTasks?.dataPreparation?.description) stats.stepsCoverage['data-preparation'] += 1;
    if (row.supportTasks?.subjectDetection) stats.stepsCoverage['subject-detection'] += 1;
    if (row.supportTasks?.columnClassification) stats.stepsCoverage['column-analysis'] += 1;
    if (row.supportTasks?.typeAnnotation) stats.stepsCoverage['type-annotation'] += 1;
    if (row.supportTasks?.predicateAnnotation) stats.stepsCoverage['predicate-annotation'] += 1;
    if (row.supportTasks?.datatypeAnnotation) stats.stepsCoverage['datatype-annotation'] += 1;
    if (row.supportTasks?.entityLinking?.description) stats.stepsCoverage['entity-linking'] += 1;
    if (row.supportTasks?.nilAnnotation) stats.stepsCoverage['nil-annotation'] += 1;

    const venue = row.venue?.acronym || 'N/A';
    stats.conferenceJournalDistribution[venue] = (stats.conferenceJournalDistribution[venue] || 0) + 1;
  });

  return stats;
};

export const toHomeStats = (baseStats) => {
  const totalEntries = baseStats.totalEntries || 0;
  return {
    totalEntries,
    entriesWithMissingFields: baseStats.entriesWithMissingFields || 0,
    totalMissingFields: baseStats.totalMissingFields || 0,
    mostMissing: getMostMissing(baseStats.fieldCounts || {}),
    mainMethodTypeDistribution: baseStats.mainMethodTypeDistribution || {},
    domainDistribution: baseStats.domainDistribution || {},
    yearRange: getYearRange(baseStats.years || []),
    approachesWithCode: baseStats.approachesWithCode || 0,
    approachesWithCodePercentage:
      totalEntries > 0 ? ((baseStats.approachesWithCode || 0) / totalEntries) * 100 : 0,
    licenseDistribution: baseStats.licenseDistribution || {},
    taskCounts: baseStats.taskCounts || { cta: 0, cpa: 0, cea: 0, cnea: 0 },
  };
};

export const toChartsStats = (baseStats) => {
  const totalEntries = baseStats.totalEntries || 0;

  return {
    totalEntries,
    entriesWithMissingFields: baseStats.entriesWithMissingFields || 0,
    totalMissingFields: baseStats.totalMissingFields || 0,
    mostMissing: getMostMissing(baseStats.fieldCounts || {}),
    mainMethodTypeDistribution: withPercentages(baseStats.mainMethodTypeDistribution || {}, totalEntries),
    domainDistribution: withPercentages(baseStats.domainDistribution || {}, totalEntries),
    yearRange: getYearRange(baseStats.years || []),
    approachesWithCode: baseStats.approachesWithCode || 0,
    approachesWithCodePercentage:
      totalEntries > 0 ? ((baseStats.approachesWithCode || 0) / totalEntries) * 100 : 0,
    licenseDistribution: withPercentages(baseStats.licenseDistribution || {}, totalEntries),
    techniqueTagDistribution: withPercentages(baseStats.techniqueTagCounts || {}, totalEntries),
    taskCounts: baseStats.taskCounts || { cta: 0, cpa: 0, cea: 0, cnea: 0 },
    taskPercentages: {
      cta: totalEntries > 0 ? ((baseStats.taskCounts?.cta || 0) / totalEntries) * 100 : 0,
      cpa: totalEntries > 0 ? ((baseStats.taskCounts?.cpa || 0) / totalEntries) * 100 : 0,
      cea: totalEntries > 0 ? ((baseStats.taskCounts?.cea || 0) / totalEntries) * 100 : 0,
      cnea: totalEntries > 0 ? ((baseStats.taskCounts?.cnea || 0) / totalEntries) * 100 : 0,
    },
    userRevisionDistribution: baseStats.userRevisionDistribution || {},
    stepsCoverage: baseStats.stepsCoverage || { ...EMPTY_STEPS_COVERAGE },
    conferenceJournalDistribution: baseStats.conferenceJournalDistribution || {},
  };
};
