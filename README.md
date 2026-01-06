# AmzSellMetrics

Amazon Seller Central transaction analysis and profitability tracking application. Analyze your Amazon sales data, calculate accurate profit margins, and gain insights into your business performance.

## Features

### Transaction Analyzer
- Upload and parse Amazon transaction reports (CSV/XLSX)
- Multi-marketplace support (US, UK, DE, FR, IT, ES, CA, AU, AE, SA)
- Automatic currency detection and conversion
- Transaction categorization and filtering
- Export filtered data to Excel

### Profitability Analyzer
- Real-time profit/loss calculation per SKU, product, and category
- Cost data management (product cost, prep cost, shipping cost)
- FBA fee breakdown and analysis
- ROI and margin calculations
- Comparison mode for period-over-period analysis
- CSV/XLSX cost data import
- Visual charts (pie charts, category breakdown)

### Trends Analyzer
- Sales trend visualization over time
- Revenue and unit tracking
- Marketplace performance comparison

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Data Export**: xlsx, jspdf, html2canvas
- **Virtualization**: react-window (for large datasets)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd amazon-analyzer

# Install dependencies
npm install

# Start development server
npm start
```

The application will be available at `http://localhost:3000`

## Building for Production

```bash
npm run build
```

The optimized build will be created in the `build/` folder, ready for deployment.

## Usage

### 1. Upload Transactions
1. Navigate to **Transaction Analyzer**
2. Click "Upload File" and select your Amazon transaction report
3. Supported formats: CSV, XLSX
4. Data is parsed and displayed automatically

### 2. Analyze Profitability
1. Navigate to **Profitability Analyzer**
2. Set date range filter
3. Upload cost data (optional) for accurate profit calculations
4. View profitability by SKU, Product, Parent ASIN, or Category

### 3. Cost Data Format
Upload cost data as CSV/XLSX with the following columns:
- `sku` - Your seller SKU
- `cost` - Product cost
- `prep` - Prep/handling cost (optional)
- `shipping` - Inbound shipping cost (optional)

## Project Structure

```
src/
├── components/
│   ├── TransactionAnalyzer.tsx     # Main transaction upload/view
│   ├── ProfitabilityAnalyzer.tsx   # Profitability dashboard
│   ├── TrendsAnalyzer.tsx          # Trends visualization
│   ├── Navigation.tsx              # App navigation
│   ├── profitability-analyzer/     # Profitability sub-components
│   │   ├── CostUploadTab.tsx
│   │   ├── SKUTable.tsx
│   │   ├── ProductTable.tsx
│   │   ├── ParentTable.tsx
│   │   ├── CategoryTable.tsx
│   │   └── PieChartModal.tsx
│   └── ui/
│       └── Toast.tsx               # Toast notification system
├── services/
│   ├── parser/                     # Transaction parsing
│   ├── profitability/              # Profit calculations
│   └── export/                     # Excel/PDF export
├── utils/
│   ├── formatters.ts               # Currency/number formatting
│   └── currencyExchange.ts         # Multi-currency support
└── types/
    └── index.ts                    # TypeScript definitions
```

## Supported Marketplaces

| Marketplace | Currency | Code |
|-------------|----------|------|
| United States | USD | US |
| United Kingdom | GBP | UK |
| Germany | EUR | DE |
| France | EUR | FR |
| Italy | EUR | IT |
| Spain | EUR | ES |
| Canada | CAD | CA |
| Australia | AUD | AU |
| UAE | AED | AE |
| Saudi Arabia | SAR | SA |

## Development

```bash
# Run development server
npm start

# Run tests
npm test

# Build for production
npm run build
```

## Security

- All data processing happens client-side
- No data is sent to external servers
- Sensitive transaction data stays in your browser

## License

Private - All rights reserved
