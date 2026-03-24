import Papa from "papaparse";

export interface ParsedTransaction {
  date: Date;
  dateStr: string;
  type: string;
  category: string | null;
  amount: number;
  description: string;
  rawRow: number;
  addedById: string | null;
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0;
  const num = parseFloat(val.replace(/,/g, "").trim());
  return isNaN(num) ? 0 : num;
}

function parseDate(dateStr: string, fallbackYear: number): Date | null {
  const clean = dateStr.trim();
  if (!clean) return null;

  // Skip month-only headers like "Nov-2024"
  if (/^[A-Za-z]+-\d{4}$/.test(clean)) return null;

  const withYear = clean.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  if (withYear) {
    const d = new Date(`${withYear[2]} ${withYear[1]}, ${withYear[3]}`);
    if (isNaN(d.getTime())) return null;
    d.setHours(12, 0, 0, 0);
    return d;
  }

  const noYear = clean.match(/^(\d{1,2})-([A-Za-z]+)$/);
  if (noYear) {
    const d = new Date(`${noYear[2]} ${noYear[1]}, ${fallbackYear}`);
    if (isNaN(d.getTime())) return null;
    d.setHours(12, 0, 0, 0);
    return d;
  }

  const iso = new Date(clean);
  if (!isNaN(iso.getTime())) { iso.setHours(12, 0, 0, 0); return iso; }

  return null;
}

export function parseCSV(csvText: string): {
  transactions: ParsedTransaction[];
  skipped: number;
  errors: string[];
} {
  const result = Papa.parse<string[]>(csvText, { skipEmptyLines: false });

  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  let skipped = 0;
  let fallbackYear = new Date().getFullYear();
  let lastKnownDate: Date | null = null;

  result.data.forEach((cols, rowIndex) => {
    const dateStr = (cols[0] || "").trim();
    const incomeStr = (cols[1] || "").trim();
    const expenseStr = (cols[2] || "").trim();
    const description = (cols[3] || "").trim();

    // Skip header row
    if (incomeStr.toLowerCase() === "income") return;

    // Skip fully empty rows
    if (!dateStr && !incomeStr && !expenseStr && !description) {
      skipped++;
      return;
    }

    // Skip month header rows
    if (/^[A-Za-z]+-\d{4}$/.test(dateStr)) {
      skipped++;
      return;
    }

    const income = parseAmount(incomeStr);
    const expense = parseAmount(expenseStr);

    if (income === 0 && expense === 0) {
      skipped++;
      return;
    }

    const yearMatch = dateStr.match(/(\d{4})$/);
    if (yearMatch) fallbackYear = parseInt(yearMatch[1]);

    let date = parseDate(dateStr, fallbackYear);
    if (!date && lastKnownDate) date = lastKnownDate;

    if (!date) {
      errors.push(`Row ${rowIndex + 1}: Could not parse date "${dateStr}"`);
      skipped++;
      return;
    }

    lastKnownDate = date;
    const desc = description || "No description";
    const dateFormatted = date.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

    if (income > 0) {
      transactions.push({
        date,
        dateStr: dateFormatted,
        type: "INCOME",
        category: null,
        amount: income,
        description: desc,
        rawRow: rowIndex + 1,
        addedById: null,
      });
    }

    if (expense > 0) {
      transactions.push({
        date,
        dateStr: dateFormatted,
        type: "EXPENSE",
        category: "OTHER",
        amount: expense,
        description: desc,
        rawRow: rowIndex + 1,
        addedById: null,
      });
    }
  });

  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { transactions, skipped, errors };
}
