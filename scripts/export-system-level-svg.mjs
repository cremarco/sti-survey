import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_LEVEL_CRITERIA, createSystemLevelSvg } from '../src/components/charts/systemLevelSvg.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(process.argv[2] ?? resolve(root, 'public/figures/system-level'));
const data = JSON.parse(await readFile(resolve(root, 'public/data/sti-survey.json'), 'utf8'));
await mkdir(destination, { recursive: true });
for (const [index, [criterion, config]] of Object.entries(SYSTEM_LEVEL_CRITERIA).entries()) {
  const svg = createSystemLevelSvg(data, {
    criterion, width: 821, height: 280, panelLabel: `(${String.fromCharCode(97 + index)})`,
  });
  const filename = resolve(destination, config.filename);
  await writeFile(filename, svg + '\n');
  console.log(`${config.label}: ${data.length} publications -> ${filename}`);
}
