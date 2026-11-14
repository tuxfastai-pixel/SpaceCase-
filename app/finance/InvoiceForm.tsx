"use client";
import { useState, type FormEvent } from "react";
import { feeCategories, randToMinor, splitInstalmentsForForm } from "./forms";
import s from "./finance.module.css";
import {financeWords} from "./presentation";
import {FinanceIcon} from "./FinanceUi";
type Learner = {
  personId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
};
export default function InvoiceForm({
  schoolId,
  disabled,
  save,
  onError,
}: {
  schoolId: string;
  disabled: boolean;
  save: (input: Record<string, unknown>) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const [reference, setReference] = useState(""),
    [learner, setLearner] = useState<Learner | null>(null),
    [checking, setChecking] = useState(false);
  async function findLearner() {
    setChecking(true);
    setLearner(null);
    onError("");
    try {
      const query = new URLSearchParams({ schoolId, reference });
      const response = await fetch(`/api/finance/learner?${query}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw Error(
          "Learner could not be confirmed. Check the exact school reference and your current finance access.",
        );
      setLearner((await response.json()) as Learner);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Learner lookup failed.",
      );
    } finally {
      setChecking(false);
    }
  }
  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!learner) return;
    const form = event.currentTarget,
      fields = new FormData(form);
    try {
      const amount = randToMinor(String(fields.get("amount")));
      if (
        await save({
          command: "INVOICE",
          learnerReference: reference,
          confirmedLearnerId: learner.personId,
          invoiceNumber: fields.get("invoiceNumber"),
          category: fields.get("category"),
          lines: [
            {
              description: fields.get("description"),
              quantity: 1,
              unitPriceMinor: amount,
            },
          ],
          instalments: splitInstalmentsForForm(
            amount,
            String(fields.get("dueDates")),
          ),
        })
      ) {
        form.reset();
        setLearner(null);
        setReference("");
      }
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Check the invoice entries.",
      );
    }
  }
  return (
    <details className={s.card}>
      <summary><FinanceIcon name="file"/> Create a fee invoice</summary>
      <form className={s.form} onSubmit={(event) => void issue(event)}>
        <fieldset disabled={disabled || checking}>
          <label>
            Exact school learner reference
            <input
              value={reference}
              maxLength={40}
              required
              onChange={(event) => {
                setReference(event.target.value);
                setLearner(null);
              }}
            />
          </label>
          <button
            type="button"
            disabled={!reference.trim()}
            onClick={() => void findLearner()}
          >
            Find learner
          </button>
          {learner && (
            <p role="status">
              <strong>
                {learner.givenName} {learner.familyName}
              </strong>{" "}
              · {learner.admissionNumber}. Check the learner reference and both
              names.
            </p>
          )}
          <label>
            Unique invoice number
            <input name="invoiceNumber" maxLength={80} required />
          </label>
          <label>
            Fee category
            <select name="category">
              {feeCategories.map((value) => (
                <option key={value} value={value}>{financeWords(value)}</option>
              ))}
            </select>
          </label>
          <label>
            Description
            <input name="description" maxLength={200} required />
          </label>
          <label>
            Total amount (R)
            <input name="amount" inputMode="decimal" required />
          </label>
          <label>
            Instalment due dates, one per line
            <textarea
              name="dueDates"
              placeholder={"2027-01-31\n2027-02-28"}
              rows={3}
              required
            />
          </label>
          <p>
            The total is split exactly across the dates, with remainder cents in
            the earliest instalments.
          </p>
          <label>
            <input name="confirmed" type="checkbox" required />I checked the
            learner, amount and instalment dates.
          </label>
          <button disabled={!learner}>Issue invoice</button>
        </fieldset>
      </form>
    </details>
  );
}
