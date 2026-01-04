const XLSX = require('xlsx');
const workbook = XLSX.readFile('./data/ara 25/us_12.25.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Find header row and column indices
const headers = data[0];
const typeIdx = headers.findIndex(h => h && h.toLowerCase().includes('type'));
const descIdx = headers.findIndex(h => h && h.toLowerCase().includes('description'));
const totalIdx = headers.findIndex(h => h && h.toLowerCase().includes('total'));
const orderIdIdx = headers.findIndex(h => h && h.toLowerCase().includes('order'));

console.log('Headers:', headers.slice(0, 15));
console.log('Type col:', typeIdx, 'Desc col:', descIdx, 'Total col:', totalIdx, 'OrderId col:', orderIdIdx);
console.log('');

// Find FBA Inventory Fee rows and their descriptions
const inventoryFees = data.slice(1).filter(row => {
  const type = row[typeIdx];
  return type && type.toString().toLowerCase().includes('fba inventory');
});

console.log('FBA Inventory Fee satır sayısı:', inventoryFees.length);
console.log('');

// Group by description
const descGroups = {};
inventoryFees.forEach(row => {
  const desc = row[descIdx] || '(EMPTY)';
  const total = parseFloat(row[totalIdx]) || 0;
  if (!descGroups[desc]) {
    descGroups[desc] = { count: 0, total: 0, sampleOrderId: row[orderIdIdx] };
  }
  descGroups[desc].count++;
  descGroups[desc].total += total;
  if (!descGroups[desc].sampleOrderId && row[orderIdIdx]) {
    descGroups[desc].sampleOrderId = row[orderIdIdx];
  }
});

console.log('Description grupları:');
Object.entries(descGroups)
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([desc, info]) => {
    console.log(`  "${desc}": ${info.count} adet, toplam: $${info.total.toFixed(2)}, örnek orderId: ${info.sampleOrderId || 'yok'}`);
  });
