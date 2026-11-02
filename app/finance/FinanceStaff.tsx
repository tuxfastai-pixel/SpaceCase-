"use client";
import { useEffect, useState, type FormEvent } from "react";
import InvitationShare from "../admin/InvitationShare";
import {
  prepareInvitationMessage,
  type InvitationMessage,
} from "../../platform/invitations/message";
import s from "./finance.module.css";
type Invite = {
  id: string;
  email: string;
  roleCode: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
};
export default function FinanceStaff({
  schoolId,
  schoolName,
}: {
  schoolId: string;
  schoolName: string;
}) {
  const [invites, setInvites] = useState<Invite[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [share, setShare] = useState<{
      recipient: string;
      message: InvitationMessage;
    } | null>(null),
    [notice, setNotice] = useState("");
  const base = `/api/v1/admin/schools/${schoolId}/invitations`;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(base, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw Error("Finance invitations could not be checked.");
        return (await response.json()) as { invitations: Invite[] };
      })
      .then((result) => {
        if (!controller.signal.aborted)
          setInvites(
            result.invitations.filter((i) => i.roleCode.startsWith("FINANCE_")),
          );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Finance invitations could not be checked.");
      });
    return () => controller.abort();
  }, [base, refresh]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setShare(null);
    const form = event.currentTarget,
      fields = new FormData(form);
    try {
      const recipient = String(fields.get("email")),
        roleCode = String(fields.get("roleCode"));
      const response = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: recipient, roleCode }),
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(
          body.error === "FINANCE_INVITATIONS_NOT_ENABLED"
            ? "Finance staff invitations are awaiting activation after principal security checks."
            : "The invitation could not be created. Check current principal authority and existing pending invitations.",
        );
      setShare({
        recipient,
        message: prepareInvitationMessage({
          origin: window.location.origin,
          token: body.token,
          schoolName,
          roleCode,
          expiresAt: body.expiresAt,
        }),
      });
      form.reset();
      setRefresh((v) => v + 1);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Invitation could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(invite: Invite) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        invite.acceptedAt
          ? `/api/finance/staff/${schoolId}/${invite.id}`
          : `${base}/${invite.id}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw Error(
          "Access could not be removed. Confirm current principal authority.",
        );
      setShare(null);
      setRefresh((v) => v + 1);
      setNotice(
        invite.acceptedAt
          ? "The finance role was ended. Other school roles are unchanged."
          : "The pending invitation was revoked.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Access could not be removed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className={s.card}>
      <summary>Finance team access</summary>
      <p>
        Only the current principal can invite finance staff. A finance officer
        prepares records; a finance manager can also verify another person’s
        payment. Reconciliation and expenditure approval remain with the
        principal.
      </p>
      <p>
        Invitations use manual links and the exact intended Google email.
        Principal security and finance invitation activation must be ready
        before use.
      </p>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <form className={s.form} onSubmit={(event) => void invite(event)}>
        <fieldset disabled={busy}>
          <label>
            Staff email
            <input type="email" name="email" maxLength={254} required />
          </label>
          <label>
            Finance role
            <select name="roleCode">
              <option value="FINANCE_OFFICER">Finance officer</option>
              <option value="FINANCE_MANAGER">Finance manager</option>
            </select>
          </label>
          <button>Create private invitation</button>
        </fieldset>
      </form>
      {share && <InvitationShare {...share} />}
      <p>
        Latest finance invitations within the school’s latest 200 staff
        invitations. Ending an accepted role does not change its historical
        acceptance status.
      </p>
      {invites.map((row) => (
        <div className={s.row} key={row.id}>
          <span>
            {row.email} ·{" "}
            {row.roleCode === "FINANCE_MANAGER"
              ? "Finance manager"
              : "Finance officer"}{" "}
            ·{" "}
            {row.acceptedAt
              ? "Accepted"
              : row.revokedAt
                ? "Revoked"
                : Date.parse(row.expiresAt) <= Date.now()
                  ? "Expired"
                  : "Pending"}
          </span>
          {!row.revokedAt &&
            (row.acceptedAt || Date.parse(row.expiresAt) > Date.now()) && (
              <button disabled={busy} onClick={() => void revoke(row)}>
                {row.acceptedAt ? "End finance role" : "Revoke invitation"}
              </button>
            )}
        </div>
      ))}
    </details>
  );
}
