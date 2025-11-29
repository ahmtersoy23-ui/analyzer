// Bu dosyayı ProductAnalyzer.tsx içinde kullanabilirsiniz
console.log('=== DEBUG: Checking transaction types ===');
console.log('Advertising:', enrichedTransactions.filter(t => t.descriptionLower?.includes('cost of advertising') || t.categoryType === 'Advertising').length);
console.log('Commission:', enrichedTransactions.filter(t => t.descriptionLower?.includes('commission') || t.categoryType === 'Commission').length);
console.log('FBA Fulfillment:', enrichedTransactions.filter(t => t.descriptionLower?.includes('fba per unit fulfillment')).length);
