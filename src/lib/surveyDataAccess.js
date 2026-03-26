const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

const normalizeStringArray = (values) =>
  values
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

export const getTechniqueTags = (row) => {
  if (Array.isArray(row?.techniqueTags)) {
    return normalizeStringArray(row.techniqueTags);
  }

  if (Array.isArray(row?.mainMethod?.technique)) {
    return normalizeStringArray(row.mainMethod.technique);
  }

  if (isNonEmptyString(row?.mainMethod?.technique)) {
    return [row.mainMethod.technique.trim()];
  }

  return [];
};

export const getMainMethodTechniqueText = (row) => getTechniqueTags(row).join(', ');

export const getApplicationPurposeText = (row) => {
  const value = row?.applicationPurpose;

  if (isNonEmptyString(value)) {
    return value.trim();
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const objective = isNonEmptyString(value.objective) ? value.objective.trim() : '';
  if (objective) {
    return objective;
  }

  const legacy = isNonEmptyString(value.legacy) ? value.legacy.trim() : '';
  if (legacy) {
    return legacy;
  }

  return isNonEmptyString(value.category) ? value.category.trim() : '';
};
