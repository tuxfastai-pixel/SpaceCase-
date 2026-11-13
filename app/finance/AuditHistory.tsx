"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { z } from "zod";
import s from "./finance.module.css";
import {csvDownloadName} from "../../platform/downloads/filename";
const pageSchema = z.object({rows: z.array(z.object({
  id: z.string().uuid(), occurredAt: z.string(), actorPersonId: z.string(), action: z.string(),
  resourceType: z.string(), resourceId: z.string().uuid(), decision: z.string().nullable(), reason: z.string().nullable(),
})), nextCursor: z.string().nullable()});
type Filters = {start: string; end: string; action: string; resourceId: string};
const empty: Filters = {start: "", end: "", action: "", resourceId: ""};
export default function AuditHistory({schoolId, accountId, schoolName}: {schoolId: string; accountId: string; schoolName:string}) {
  const [filters, setFilters] = useState(empty), [cursor, setCursor] = useState<string | null>(null),
    [previous, setPrevious] = useState<(string | null)[]>([]), [page, setPage] = useState<z.infer<typeof pageSchema> | null>(null),
    [error, setError] = useState(""), [exporting, setExporting] = useState(false), [refresh, setRefresh] = useState(0);
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => () => exportController.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setPage(null); setError("");
    const params = new URLSearchParams({schoolId, accountId});
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    if (cursor) params.set("cursor", cursor);
    void fetch(`/api/finance/audit?${params}`, {cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])})
      .then(async response => {
        if (!response.ok) throw Error(response.status === 403 ? "Your current audit permission could not be confirmed." : "Audit history could not be loaded. Check the filters and try again.");
        return pageSchema.parse(await response.json());
      }).then(result => { if (!controller.signal.aborted) setPage(result); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Audit history unavailable."); });
    return () => controller.abort();
  }, [schoolId, accountId, filters, cursor, refresh]);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setFilters({start: String(form.get("start") ?? ""), end: String(form.get("end") ?? ""), action: String(form.get("action") ?? "").trim(), resourceId: String(form.get("resourceId") ?? "").trim()});
    setCursor(null); setPrevious([]); setRefresh(v => v+1); setPage(null);
  }
  async function download() {
    if (!page || exporting) return;
    setExporting(true); setError("");
    const controller = new AbortController(); exportController.current = controller;
    const params = new URLSearchParams({schoolId, accountId, format: "csv"});
    for (const [key,value] of Object.entries(filters)) if (value) params.set(key,value);
    if (cursor) params.set("cursor",cursor);
    try {
      const response = await fetch(`/api/finance/audit?${params}`, {cache:"no-store",signal:AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])});
      if (!response.ok) throw Error("Export could not be authorized or completed. Check your current audit access and try again.");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href=url; link.download=csvDownloadName({topic:filters.action?`${filters.action}-audit-history`:"financial-audit-history",school:schoolName,start:filters.start,end:filters.end,page:previous.length+1}); link.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Export unavailable."); }
    finally { setExporting(false); }
  }
  return <section className={s.card}>
    <h2>Financial audit history</h2>
    <p>Search older activity by UTC dates, exact action or record ID. Each page contains up to 100 events. CSV rechecks access and exports up to 100 matching events at this page position. New activity may appear on the first page; this is not a full-account export.</p>
    <form className={s.form} onSubmit={search}><fieldset disabled={exporting}>
      <label>From (UTC)<input name="start" type="date" /></label>
      <label>Through (UTC)<input name="end" type="date" /></label>
      <label>Exact action (optional)<input name="action" maxLength={78} placeholder="FINANCE_EXPENSE_REVIEWED" /></label>
      <label>Record ID (optional)<input name="resourceId" maxLength={36} /></label>
      <button>Search audit history</button>
    </fieldset></form>
    {error && <p role="alert" className={s.error}>{error}</p>}
    {!page && !error && <p role="status">Loading audit history…</p>}
    {page && <>
      <div className={s.toolbar}>
        <button disabled={!previous.length || exporting} onClick={() => {setCursor(previous.at(-1) ?? null); setPrevious(p => p.slice(0,-1)); setPage(null);}}>Newer page</button>
        <button disabled={!page.nextCursor || exporting} onClick={() => {setPrevious(p => [...p,cursor]); setCursor(page.nextCursor); setPage(null);}}>Older page</button>
        <button onClick={() => void download()} disabled={!page.rows.length || exporting}>{exporting ? "Exporting…" : "Export this page (CSV)"}</button>
      </div>
      <p role="status">Page {previous.length+1} · {page.rows.length} events{page.nextCursor ? " · Older events available" : " · End of matching history"}</p>
      {!page.rows.length && <p>No matching events.</p>}
      <ol>{page.rows.map(row => <li key={row.id}>
        <strong>{row.action}</strong> · {row.occurredAt}
        <div>{row.resourceType} · Record: {row.resourceId}</div>
        <div>Actor ID: {row.actorPersonId}</div>
        {row.decision && <div>Decision: {row.decision}</div>}
        {row.reason && <div>Reason: {row.reason}</div>}
      </li>)}</ol>
    </>}
  </section>;
}
