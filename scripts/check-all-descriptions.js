const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Find all Excel files in data directory recursively
function findExcelFiles(dir) {
  let results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findExcelFiles(fullPath));
    } else if (item.endsWith('.xlsx') && !item.startsWith('~')) {
      results.push(fullPath);
    }
  }
  return results;
}

const dataDir = './data';
const files = findExcelFiles(dataDir);

console.log('Checking ALL FBA Inventory Fee descriptions across all files...\n');

const allDescriptions = new Map(); // description -> [files]

files.forEach(file => {
  try {
    const wb = XLSX.readFile(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const headers = data[0];
    if (!headers) return;

    const typeIdx = headers.findIndex(h => h && h.toString().toLowerCase() === 'type');
    const descIdx = headers.findIndex(h => h && h.toString().toLowerCase() === 'description');

    if (typeIdx === -1 || descIdx === -1) return;

    const fbaFees = data.slice(1).filter(row => {
      const type = row[typeIdx];
      return type && type.toString().toLowerCase().includes('fba inventory');
    });

    fbaFees.forEach(row => {
      const desc = row[descIdx] || '(EMPTY)';
      if (!allDescriptions.has(desc)) {
        allDescriptions.set(desc, new Set());
      }
      allDescriptions.get(desc).add(path.basename(file));
    });
  } catch (e) {
    // Skip problematic files
  }
});

// Sort by description and show
console.log('Unique descriptions found:\n');
const sorted = Array.from(allDescriptions.entries()).sort((a, b) => a[0].localeCompare(b[0]));

sorted.forEach(([desc, files]) => {
  const fileList = Array.from(files).join(', ');
  console.log(`"${desc}"`);
  console.log(`  Files: ${fileList}\n`);
});

console.log(`\nTotal unique descriptions: ${allDescriptions.size}`);
