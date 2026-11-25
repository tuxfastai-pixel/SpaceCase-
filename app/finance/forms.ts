export {
  expenseCategories,
  feeCategories,
  formatZar,
  randToMinor,
} from "../../domains/school-finance/workspaceContracts";
import { financeDate } from "../../domains/school-finance/workspaceContracts";
import { splitInstalments } from "../../domains/school-finance/money";
export function splitInstalmentsForForm(amount: string, dates: string) {
  const parsed = dates
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => financeDate.parse(v));
  if (
    !parsed.length ||
    parsed.some((date, i) => i > 0 && date <= parsed[i - 1])
  )
    throw Error("Use valid, increasing due dates, one per line.");
  return splitInstalments(amount, parsed.length).map((amountMinor, i) => ({
    amountMinor,
    dueDate: parsed[i],
  }));
}
