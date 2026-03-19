import { getApplicationPurposeText } from './surveyDataAccess';

export const REQUIRED_FIELD_PATHS = [
  'id',
  'authors',
  'firstAuthor',
  'year',
  'title',
  'venue.acronym',
  'mainMethod.type',
  'mainMethod.technique',
  'domain.domain',
  'coreTasks.cta',
  'coreTasks.cpa',
  'coreTasks.cea',
  'coreTasks.cnea',
  'revision.type',
  'license',
  'inputs.typeOfTable',
  'kg.tripleStore',
  'output',
  'checkedByAuthor',
  'doi',
];

const REQUIRED_FIELDS_SET = new Set(REQUIRED_FIELD_PATHS);

export const isEmptyValue = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((item) => isEmptyValue(item));
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 || keys.every((key) => isEmptyValue(value[key]));
  }
  return false;
};

export const getNestedValue = (obj, path) => {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }

  return current;
};

export const isRequiredFieldMissing = (row, fieldPath) => {
  if (!REQUIRED_FIELDS_SET.has(fieldPath)) return false;
  if (fieldPath === 'applicationPurpose') {
    return getApplicationPurposeText(row) === '';
  }
  return isEmptyValue(getNestedValue(row, fieldPath));
};
