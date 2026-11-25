import { z } from "zod";
import { minorUnits } from "./money";
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\u0000-\u001f\u007f]+$/);
export const financeReviewReason = text(500);
export const financeDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(value + "T00:00:00Z");
    return (
      Number(value.slice(0, 4)) > 0 &&
      Number.isFinite(d.getTime()) &&
      d.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");
export const positiveMinor = z.string().refine((value) => {
  try {
    return minorUnits(value) > 0n;
  } catch {
    return false;
  }
}, "Enter positive integer cents");
export const expenseCategories = [
  "ELECTRICITY",
  "WATER",
  "MAINTENANCE",
  "REPAIRS",
  "CLEANING",
  "SECURITY",
  "TRANSPORT",
  "SALARY_EXPENDITURE",
  "OTHER",
] as const;
export const feeCategories = [
  "SCHOOL_FEES",
  "TEXTBOOKS",
  "STATIONERY",
  "UNIFORMS",
  "PHOTO_DAY",
  "TRANSPORT",
  "FUNDRAISER",
  "LEVY",
  "OTHER",
] as const;
const scope = {
  schoolId: z.string().uuid().toLowerCase(),
  accountId: z.string().uuid(),
};
export const financeCommand = z.discriminatedUnion("command", [
  z
    .object({
      command: z.literal("INITIALIZE"),
      schoolId: z.string().uuid().toLowerCase(),
    })
    .strict(),
  z
    .object({
      command: z.literal("INVOICE"),
      ...scope,
      learnerReference: text(40),
      confirmedLearnerId: z.string().uuid(),
      invoiceNumber: text(80),
      category: z.enum(feeCategories),
      lines: z
        .array(
          z
            .object({
              description: text(200),
              quantity: z.number().int().min(1).max(10000),
              unitPriceMinor: positiveMinor,
            })
            .strict(),
        )
        .min(1)
        .max(100),
      instalments: z
        .array(
          z
            .object({ dueDate: financeDate, amountMinor: positiveMinor })
            .strict(),
        )
        .min(1)
        .max(60),
    })
    .strict(),
  z
    .object({
      command: z.literal("PAYMENT"),
      ...scope,
      reference: text(80),
      amountMinor: positiveMinor,
      method: z.enum(["EFT", "CASH", "CARD", "OTHER"]),
    })
    .strict(),
  z
    .object({
      command: z.literal("VERIFY_PAYMENT"),
      ...scope,
      paymentId: z.string().uuid(),
      decision: z.enum(["VERIFIED", "REJECTED"]),
      evidenceReference: text(200),
      reason: text(500),
    })
    .strict(),
  z
    .object({
      command: z.literal("ALLOCATE"),
      ...scope,
      paymentId: z.string().uuid(),
      invoiceId: z.string().uuid(),
      amountMinor: positiveMinor,
    })
    .strict(),
  z
    .object({
      command: z.literal("BUDGET"),
      ...scope,
      academicYear: z.number().int().min(2020).max(2200),
      category: z.enum(expenseCategories),
      amountMinor: positiveMinor,
    })
    .strict(),
  z
    .object({
      command: z.literal("EXPENSE"),
      ...scope,
      budgetId: z.string().uuid(),
      reference: text(80),
      description: text(300),
      amountMinor: positiveMinor,
      evidenceReference: text(200),
    })
    .strict(),
  z
    .object({
      command: z.literal("REVIEW_BUDGET"),
      reason: financeReviewReason,
      ...scope,
      resourceId: z.string().uuid(),
      decision: z.enum(["APPROVED", "REJECTED"]),
    })
    .strict(),
  z
    .object({
      command: z.literal("REVIEW_EXPENSE"),
      reason: financeReviewReason,
      ...scope,
      resourceId: z.string().uuid(),
      decision: z.enum(["APPROVED", "REJECTED"]),
    })
    .strict(),
  z
    .object({
      command: z.literal("RECONCILIATION"),
      ...scope,
      periodStart: financeDate,
      periodEnd: financeDate,
    })
    .strict(),
  z
    .object({
      command: z.literal("SUBMIT_RECONCILIATION"),
      ...scope,
      reconciliationId: z.string().uuid(),
      evidenceReference: text(200),
    })
    .strict(),
  z
    .object({
      command: z.literal("REVIEW_RECONCILIATION"),
      ...scope,
      reconciliationId: z.string().uuid(),
      decision: z.enum(["APPROVED", "REJECTED"]),
      reason: text(500),
    })
    .strict(),
]);
export type FinanceCommand = z.infer<typeof financeCommand>;
export function formatZar(value: string) {
  const cents = BigInt(value);
  const sign = cents < 0n ? "-" : "";
  const amount = cents < 0n ? -cents : cents;
  return `${sign}R ${(amount / 100n).toLocaleString("en-ZA")}.${(amount % 100n).toString().padStart(2, "0")}`;
}
export function randToMinor(value: string) {
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(value))
    throw Error("Enter rand and cents, for example 125.50");
  const [whole, fraction = ""] = value.split(".");
  return minorUnits(
    (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))).toString(),
  ).toString();
}
