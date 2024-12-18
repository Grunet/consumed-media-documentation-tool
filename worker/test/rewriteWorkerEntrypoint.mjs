import path from 'node:path';
import fs from 'node:fs/promises';

// This is part of a severe workaround for https://github.com/cloudflare/workers-sdk/issues/5367#issuecomment-2550389245
const workerEntryPointPath = path.join(import.meta.dirname, './../src/index.ts');
const data = await fs.readFile(workerEntryPointPath, { encoding: 'utf8' });

const updatedData = data.replace('export default instrument(handler, config);', 'export default handler;');

await fs.writeFile(workerEntryPointPath, updatedData, 'utf8');
