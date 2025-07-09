import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the schema and data files
const schemaPath = path.join(__dirname, 'data', 'sti-survey.schema.json');
const dataPath = path.join(__dirname, 'data', 'sti-survey.json');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Function to check if a value is empty
function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).length === 0;
    }
    return false;
}

// Function to check required fields recursively
function checkRequiredFields(obj, schema, path = '') {
    const missing = [];
    
    // Check top-level required fields
    if (schema.required) {
        for (const field of schema.required) {
            const fieldPath = path ? `${path}.${field}` : field;
            if (!(field in obj) || isEmpty(obj[field])) {
                missing.push({
                    field: fieldPath,
                    value: obj[field],
                    level: 'top-level'
                });
            }
        }
    }
    
    // Check nested required fields
    if (schema.properties) {
        for (const [key, value] of Object.entries(obj)) {
            const fieldPath = path ? `${path}.${key}` : key;
            const fieldSchema = schema.properties[key];
            
            if (fieldSchema && fieldSchema.required && typeof value === 'object' && value !== null) {
                for (const requiredField of fieldSchema.required) {
                    const nestedPath = `${fieldPath}.${requiredField}`;
                    if (!(requiredField in value) || isEmpty(value[requiredField])) {
                        missing.push({
                            field: nestedPath,
                            value: value[requiredField],
                            level: 'nested'
                        });
                    }
                }
            }
        }
    }
    
    return missing;
}

console.log('ANALISI CAMPI REQUIRED - STI Survey Dataset\n');
console.log('=' .repeat(60));

// Get all required fields from schema
const topLevelRequired = schema.required || [];
console.log('Campi required di primo livello:');
topLevelRequired.forEach(field => console.log(`  - ${field}`));

// Check nested required fields
console.log('\nCampi required annidati:');
if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
        if (prop.required) {
            console.log(`  - ${key}: ${prop.required.join(', ')}`);
        }
    }
}

console.log('\n' + '=' .repeat(60));
console.log('ANALISI DEI DATI');
console.log('=' .repeat(60));

let totalEntries = data.length;
let entriesWithMissingRequired = 0;
let totalMissingRequired = 0;
const missingFieldsCount = {};

for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    const missing = checkRequiredFields(entry, schema);
    
    if (missing.length > 0) {
        entriesWithMissingRequired++;
        totalMissingRequired += missing.length;
        
        console.log(`\nEntry ${i + 1} (${entry.author}, ${entry.year}):`);
        console.log(`  Title: ${entry.title?.text || 'N/A'}`);
        console.log(`  Campi required mancanti: ${missing.length}`);
        
        missing.forEach(m => {
            console.log(`    - ${m.field}: ${m.level} (value: ${JSON.stringify(m.value)})`);
            
            // Count occurrences
            if (!missingFieldsCount[m.field]) {
                missingFieldsCount[m.field] = 0;
            }
            missingFieldsCount[m.field]++;
        });
    }
}

// Summary statistics
console.log('\n' + '=' .repeat(60));
console.log('RIEPILOGO CAMPI REQUIRED MANCANTI');
console.log('=' .repeat(60));
console.log(`Totale entries: ${totalEntries}`);
console.log(`Entries con campi required mancanti: ${entriesWithMissingRequired} (${((entriesWithMissingRequired/totalEntries)*100).toFixed(1)}%)`);
console.log(`Totale campi required mancanti: ${totalMissingRequired}`);
console.log(`Media campi required mancanti per entry: ${(totalMissingRequired/entriesWithMissingRequired).toFixed(1)}`);

// Most common missing required fields
console.log('\nCampi required più frequentemente mancanti:');
const sortedFields = Object.entries(missingFieldsCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 15);

sortedFields.forEach(([field, count]) => {
    const percentage = ((count / totalEntries) * 100).toFixed(1);
    console.log(`  ${field}: ${count} volte (${percentage}%)`);
});

// Check for critical missing fields (those that appear in >50% of entries)
console.log('\nCampi required CRITICI (mancanti in >50% delle entries):');
const criticalFields = sortedFields.filter(([, count]) => (count / totalEntries) > 0.5);
if (criticalFields.length > 0) {
    criticalFields.forEach(([field, count]) => {
        const percentage = ((count / totalEntries) * 100).toFixed(1);
        console.log(`  ⚠️  ${field}: ${count} volte (${percentage}%) - DA SISTEMARE URGENTEMENTE`);
    });
} else {
    console.log('  Nessun campo required critico trovato.');
}

// Check for entries with many missing required fields
console.log('\nEntries con più campi required mancanti (≥5):');
let criticalEntries = 0;
for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    const missing = checkRequiredFields(entry, schema);
    
    if (missing.length >= 5) {
        criticalEntries++;
        console.log(`  Entry ${i + 1}: ${entry.author}, ${entry.year} - ${missing.length} campi required mancanti`);
        console.log(`    Titolo: ${entry.title?.text || 'N/A'}`);
    }
}

console.log(`\nTotale entries critiche (≥5 campi required mancanti): ${criticalEntries}`);

// Priority list for fixing
console.log('\n' + '=' .repeat(60));
console.log('PRIORITÀ DI SISTEMAZIONE');
console.log('=' .repeat(60));
console.log('Ordine di priorità per sistemare i campi required:');
console.log('1. Campi required di primo livello mancanti');
console.log('2. Campi required annidati mancanti');
console.log('3. Campi che appaiono in >50% delle entries');
console.log('4. Entries con ≥5 campi required mancanti'); 