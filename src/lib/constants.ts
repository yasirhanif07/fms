export const ROLES = {
  ADMIN: "ADMIN",
  PARTNER: "PARTNER",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const TRANSACTION_TYPES = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
  LOAN_GIVEN: "LOAN_GIVEN",
  LOAN_RECEIVED: "LOAN_RECEIVED",
  LOAN_REPAYMENT: "LOAN_REPAYMENT",
} as const;

export type TransactionType =
  (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

export const EXPENSE_CATEGORIES = {
  SALARIES: "SALARIES",
  UTILITIES: "UTILITIES",
  OFFICE_SUPPLIES: "OFFICE_SUPPLIES",
  OTHER: "OTHER",
} as const;

export type ExpenseCategory =
  (typeof EXPENSE_CATEGORIES)[keyof typeof EXPENSE_CATEGORIES];

export const LOAN_DIRECTIONS = {
  INFLOW: "INFLOW",
  OUTFLOW: "OUTFLOW",
} as const;

export type LoanDirection =
  (typeof LOAN_DIRECTIONS)[keyof typeof LOAN_DIRECTIONS];

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  LOAN_GIVEN: "Loan Given",
  LOAN_RECEIVED: "Loan Received",
  LOAN_REPAYMENT: "Loan Repayment",
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  SALARIES: "Salaries",
  UTILITIES: "Utilities",
  OFFICE_SUPPLIES: "Office Supplies",
  OTHER: "Other",
};

export const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  INCOME: "bg-green-100 text-green-800",
  EXPENSE: "bg-red-100 text-red-800",
  LOAN_GIVEN: "bg-orange-100 text-orange-800",
  LOAN_RECEIVED: "bg-blue-100 text-blue-800",
  LOAN_REPAYMENT: "bg-purple-100 text-purple-800",
};

// Returns +1 or -1 based on transaction type effect on balance
export function getBalanceDelta(
  type: string,
  loanDirection?: string | null
): number {
  switch (type) {
    case "INCOME":
      return 1;
    case "EXPENSE":
      return -1;
    case "LOAN_GIVEN":
      return -1;
    case "LOAN_RECEIVED":
      return 1;
    case "LOAN_REPAYMENT":
      return loanDirection === "INFLOW" ? 1 : -1;
    default:
      return 0;
  }
}
