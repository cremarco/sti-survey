import json
import copy

# Mapping from old field names to new field names according to the schema
FIELD_MAP = {
    'id': 'id',
    'author': 'firstAuthor',
    'authors': 'authors',
    'year': 'year',
    'title': 'title',
    'added': 'added',
    'conference-journal': 'conferenceJournal',
    'name-of-approach': 'nameOfApproach',
    'main-method': 'mainMethod',
    'domain': 'domain',
    'tasks': 'coreTasks',
    'steps': 'supportTasks',
    'user-revision': 'revision',
    'validation': 'validation',
    'code-availability': 'codeAvailability',
    'license': 'license',
    'inputs': 'inputs',
    'output-format': 'output',
    'checked-by-author': 'checkedByAuthor',
    'checked-by-ai': 'checkedByAi',
    'doi': 'doi',
    'citations': 'citations',
    'application-purpose': 'applicationPurpose',
    'user-interface-tool': 'userInterfaceTool',
}

# Helper to convert nested fields from kebab/snake_case to camelCase
NESTED_FIELD_MAP = {
    'mainMethod': {'type': ('type', {'unsup': 'Unsupervised', 'sup': 'Supervised', 'hybrid': 'Hybrid'})},
    'supportTasks': {
        'data-preparation': 'dataPreparation',
        'spell-checker': 'spellChecker',
        'units-of-measurements': 'unitsOfMeasurements',
        'column-analysis': 'columnClassification',
        'subject-detection': 'subjectDetection',
        'datatype-annotation': 'datatypeAnnotation',
        'entity-linking': 'entityLinking',
        'type-annotation': 'typeAnnotation',
        'predicate-annotation': 'predicateAnnotation',
        'nil-annotation': 'nilAnnotation',
    },
    'inputs': {
        'type-of-table': 'typeOfTable',
        'kg': {
            'triple-store': 'tripleStore',
            'index': 'index',
        }
    },
    'domain': {
        'domain': ('domain', {'dependent': 'Dependent', 'independent': 'Independent'})
    },
    'revision': {
        'type': ('type', {'none': 'None', 'semi-automated': 'Semi automated', 'fully-automated': 'Fully automated'})
    }
}

def convert_main_method(main_method):
    if not isinstance(main_method, dict):
        return main_method
    result = {}
    for k, v in main_method.items():
        if k == 'type':
            v_map = {'unsup': 'Unsupervised', 'sup': 'Supervised', 'hybrid': 'Hybrid'}
            result['type'] = v_map.get(str(v).lower(), v)
        else:
            result[k] = v
    return result

def convert_domain(domain):
    if not isinstance(domain, dict):
        return domain
    result = {}
    for k, v in domain.items():
        if k == 'domain':
            v_map = {'dependent': 'Dependent', 'independent': 'Independent'}
            result['domain'] = v_map.get(str(v).lower(), v)
        else:
            result[k] = v
    return result

def convert_revision(revision):
    if not isinstance(revision, dict):
        return revision
    result = {}
    for k, v in revision.items():
        if k == 'type':
            v_map = {
                'none': 'None',
                'semi-automated': 'Semi automated',
                'fully-automated': 'Fully automated',
                'semi automated': 'Semi automated',
                'fully automated': 'Fully automated'
            }
            result['type'] = v_map.get(str(v).lower(), v)
        else:
            result[k] = v
    return result

def convert_support_tasks(steps):
    if not isinstance(steps, dict):
        return steps
    result = {}
    key_map = {
        'data-preparation': 'dataPreparation',
        'column-analysis': 'columnClassification',
        'subject-detection': 'subjectDetection',
        'datatype-annotation': 'datatypeAnnotation',
        'entity-linking': 'entityLinking',
        'type-annotation': 'typeAnnotation',
        'predicate-annotation': 'predicateAnnotation',
        'nil-annotation': 'nilAnnotation',
    }
    for k, v in steps.items():
        new_k = key_map.get(k, k)
        if new_k == 'dataPreparation' and isinstance(v, dict):
            v = {('spellChecker' if k2 == 'spell-checker' else ('unitsOfMeasurements' if k2 == 'units-of-measurements' else k2)): v2 for k2, v2 in v.items()}
        if new_k == 'entityLinking' and isinstance(v, dict):
            v = {('candidateGeneration' if k2 == 'candidate-generation' else ('entityDisambiguation' if k2 == 'entity-disambiguation' else k2)): v2 for k2, v2 in v.items()}
        result[new_k] = v
    return result

def convert_inputs(inputs):
    if not isinstance(inputs, dict):
        return inputs
    result = {}
    for k, v in inputs.items():
        if k == 'type-of-table':
            result['typeOfTable'] = v
        elif k == 'kg' and isinstance(v, dict):
            kg = {}
            for kgk, kgv in v.items():
                if kgk == 'triple-store':
                    kg['tripleStore'] = kgv
                else:
                    kg[kgk] = kgv
            result['kg'] = kg
        else:
            result[k] = v
    return result

def convert_entry(entry):
    new_entry = {}
    for old_key, value in entry.items():
        new_key = FIELD_MAP.get(old_key, old_key)
        if new_key == 'mainMethod':
            new_entry[new_key] = convert_main_method(value)
        elif new_key == 'domain':
            new_entry[new_key] = convert_domain(value)
        elif new_key == 'revision':
            new_entry[new_key] = convert_revision(value)
        elif new_key == 'supportTasks':
            new_entry[new_key] = convert_support_tasks(value)
        elif new_key == 'inputs':
            new_entry[new_key] = convert_inputs(value)
        else:
            new_entry[new_key] = value
    return new_entry

def main():
    # Load the original file
    with open('public/data/sti-survey.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Convert all entries
    converted = [convert_entry(entry) for entry in data]
    # Save the converted file
    with open('public/data/sti-survey-converted.json', 'w', encoding='utf-8') as f:
        json.dump(converted, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main() 