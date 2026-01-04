// Test normalize function
const testCases = [
  'FBA storage fee',
  'FBA Storage Fee',
  'FBA Long-Term Storage Fee',
  'FBA Disposal Fee',
  'Long-Term Storage Fee',
  'Storage Fee',
  'Disposal Fee',
  'FBA Removal Order: Disposal Fee',
  'Fulfilment by Amazon removal order: disposal fee',
  'FBA Removal Order: Return Fee',
  'FBA Return Fee',
  'Inbound Transportation Charge',
  'Inbound Transportation Program Fee',
  'FBA Amazon-Partnered Carrier Shipment Fee',
  'Capacity Reservation Fee'
];

const normalizeInventoryFeeDescription = (description, orderId) => {
  if (!description || description.trim() === '') {
    if (orderId && /^FBA[0-9A-Z]+$/i.test(orderId.trim())) {
      return 'Partnered Carrier Fee';
    }
    return 'Other';
  }
  const lower = description.toLowerCase().trim();

  if (lower.includes('partnered carrier') ||
      lower.includes('amazon-partnered carrier') ||
      lower.includes('carrier shipment fee') ||
      lower.includes('corriere convenzionato') ||
      lower.includes('transporteur partenaire') ||
      lower.includes('amazon-partnerversand') ||
      lower.includes('transportista asociado') ||
      lower.includes('partnertransporteur') ||
      lower.includes('frachtkosten für den transport') ||
      lower.includes('transportpartner-programm')) {
    return 'Partnered Carrier Fee';
  }

  if (lower.includes('long-term storage') ||
      lower.includes('long term storage') ||
      lower.includes('fba long-term storage') ||
      lower.includes('stoccaggio a lungo termine') ||
      lower.includes('langzeitlagergebühr') ||
      lower.includes('stockage à long terme') ||
      lower.includes('almacenamiento a largo plazo') ||
      lower === 'long-term storage fee') {
    return 'Long-Term Storage Fee';
  }

  if (lower.includes('storage fee') ||
      (lower.includes('storage') && lower.includes('fee')) ||
      lower.includes('tariffa di stoccaggio') ||
      lower.includes('lagergebühr') ||
      lower.includes('frais de stockage') ||
      lower.includes('tarifa de almacenamiento')) {
    return 'Storage Fee';
  }

  if (lower.includes('disposal') ||
      lower.includes('removal order: disposal') ||
      lower.includes('entsorgung') ||
      lower.includes('élimination') ||
      lower.includes('smaltimento') ||
      lower.includes('eliminación')) {
    return 'Disposal Fee';
  }

  // Inbound/Inventory Placement
  if (lower.includes('inbound') ||
      lower.includes('inventory placement') ||
      lower.includes('inbound transportation')) {
    return 'Inbound/Placement Fee';
  }

  // Return Fee
  if (lower.includes('return fee') ||
      lower.includes('removal order: return')) {
    return 'Return Fee';
  }

  // Capacity Reservation
  if (lower.includes('capacity reservation')) {
    return 'Capacity Reservation Fee';
  }

  return description;
};

console.log('Testing normalize function:');
testCases.forEach(tc => {
  console.log(`  "${tc}" => "${normalizeInventoryFeeDescription(tc)}"`);
});
