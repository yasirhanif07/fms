import Papa from "papaparse";

export interface ParsedTransaction {
  date: Date;
  dateStr: string;
  type: string;
  category: string | null;
  amount: number;
  description: string;
  rawRow: number;
}

// Clean amount string: remove commas, spaces, parse float
function parseAmount(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Parse date strings like "1-Nov-2024", "01-Jan-2025", "12-Dec"
function parseDate(dateStr: string, fallbackYear: number): Date | null {
  const clean = dateStr.trim();
  if (!clean) return null;

  // Skip month-year only like "Nov-2024"
  if (/^[A-Za-z]+-\d{4}$/.test(clean)) return null;

  // Format: "1-Nov-2024", "01-Jan-2025"
  const withYear = clean.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  if (withYear) {
    const d = new Date(`${withYear[2]} ${withYear[1]}, ${withYear[3]}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Format: "12-Dec" (no year — use fallback)
  const noYear = clean.match(/^(\d{1,2})-([A-Za-z]+)$/);
  if (noYear) {
    const d = new Date(`${noYear[2]} ${noYear[1]}, ${fallbackYear}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Format: "2025-01-01" ISO
  const iso = new Date(clean);
  if (!isNaN(iso.getTime())) return iso;

  return null;
}

// Auto-detect expense category from description
function detectCategory(description: string): string {
  const d = description.toLowerCase();
  if (/salary|salaries|salary transfer|salaries transfer/.test(d)) return "SALARIES";
  if (/rent|electricity|internet|subscription|membership|connects|cursor|server cost/.test(d)) return "UTILITIES";
  if (/laptop|ssd|nvme|ram|charger|repair|battery|hard disk|usb|printer|mouse|keyboard|monitor|equipment|branded/.test(d)) return "OFFICE_SUPPLIES";
  return "OTHER";
}

// Detect if transaction is a loan
function detectType(description: string, isIncome: boolean): string {
  const d = description.toLowerCase();
  if (/\bloan\b/.test(d)) {
    return isIncome ? "LOAN_RECEIVED" : "LOAN_GIVEN";
  }
  return isIncome ? "INCOME" : "EXPENSE";
}

export function parseCSV(csvText: string): {
  transactions: ParsedTransaction[];
  skipped: number;
  errors: string[];
} {
  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: false,
  });

  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  let skipped = 0;
  let fallbackYear = new Date().getFullYear();
  let lastKnownDate: Date | null = null; // carry forward for dateless rows

  result.data.forEach((cols, rowIndex) => {
    const dateStr = (cols[0] || "").trim();
    const incomeStr = (cols[1] || "").trim();
    const expenseStr = (cols[2] || "").trim();
    const description = (cols[3] || "").trim();

    // Skip header row
    if (dateStr === "" && incomeStr.toLowerCase() === "income") return;

    // Skip completely empty rows
    if (!dateStr && !incomeStr && !expenseStr && !description) {
      skipped++;
      return;
    }

    // Skip month-year summary rows like "Nov-2024"
    if (/^[A-Za-z]+-\d{4}$/.test(dateStr)) {
      skipped++;
      return;
    }

    // Skip rows with no amount
    const income = parseAmount(incomeStr);
    const expense = parseAmount(expenseStr);
    if (income === 0 && expense === 0) {
      skipped++;
      return;
    }

    // Parse date — update fallback year if we see a full date
    const yearMatch = dateStr.match(/(\d{4})$/);
    if (yearMatch) fallbackYear = parseInt(yearMatch[1]);

    let date = parseDate(dateStr, fallbackYear);

    // No date in this row — use the last known date (e.g. continuation rows)
    if (!date && lastKnownDate) {
      date = lastKnownDate;
    }

    if (!date) {
      errors.push(`Row ${rowIndex + 1}: Could not parse date "${dateStr}"`);
      skipped++;
      return;
    }

    lastKnownDate = date;
    const desc = description || "No description";

    if (income > 0) {
      const type = detectType(desc, true);
      transactions.push({
        date,
        dateStr: date.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }),
        type,
        category: null,
        amount: income,
        description: desc,
        rawRow: rowIndex + 1,
      });
    }

    if (expense > 0) {
      const type = detectType(desc, false);
      transactions.push({
        date,
        dateStr: date.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }),
        type,
        category: type === "EXPENSE" ? detectCategory(desc) : null,
        amount: expense,
        description: desc,
        rawRow: rowIndex + 1,
      });
    }
  });

  // Sort by date ascending
  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

  return { transactions, skipped, errors };
}
