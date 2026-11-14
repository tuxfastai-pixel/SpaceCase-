"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { z } from "zod";
import s from "./finance.module.css";
import {csvDownloadName} from "../../platform/downloads/filename";
import {FinanceIcon,FinanceStatus} from "./FinanceUi";
import {auditActions,auditActionLabel,financeDateLabel} from "./presentation";
import ReportDateInput from "../reports/ReportDateInput";
const pageSchema = z.object({rows: z.array(z.object({
  id: z.string().uuid(), occurredAt: z.string(), actorPersonId: z.string(), action: z.string(),
  resourceType: z.string(), resourceId: z.string().uuid(), decision: z.string().nullable(), reason: z.string().nullable(),
})), nextCursor: z.string().nullable()});
type Filters = {start: string; end: string; action: string; resourceId: string};
const empty: Filters = {start: "", end: "", action: "", resourceId: ""};
export default function AuditHistory({schoolId, accountId, schoolName, initialRecordId=""}: {schoolId: string; accountId: string; schoolName:string;initialRecordId?:string}) {
  const [filters, setFilters] = useState({...empty,resourceId:initialRecordId}), [cursor, setCursor] = useState<string | null>(null),
    [previous, setPrevious] = useState<(string | null)[]>([]), [page, setPage] = useState<z.infer<typeof pageSchema> | null>(null),
    [error, setError] = useState(""), [exporting, setExporting] = useState(false), [refresh, setRefresh] = useState(0);
  const [draftStart,setDraftStart]=useState(""),[draftEnd,setDraftEnd]=useState(""),[recordDraft,setRecordDraft]=useState(initialRecordId);
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
    setFilters({start: String(form.get("start") ?? ""), end: String(form.get("end") ?? ""), action: String(form.get("customAction") || form.get("action") || "").trim(), resourceId: String(form.get("resourceId") ?? "").trim()});
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
  function clear(form:HTMLFormElement|null){form?.reset();setDraftStart("");setDraftEnd("");setRecordDraft("");setFilters(empty);setCursor(null);setPrevious([]);setRefresh(v=>v+1);}
  return <section className={s.card}>
    <div className={s.intro}><div><h2 className={s.sectionTitle}><FinanceIcon name="audit"/>Financial audit trail</h2><p>See what was recorded, reviewed and approved, with the reasons kept alongside each decision.</p></div></div>
    {filters.resourceId&&<p className={s.softPanel}>Showing the selected record’s activity. Clear the filters to return to all financial activity.</p>}
    <form className={s.form} onSubmit={search}><fieldset disabled={exporting}>
      <div className={s.twoColumns}><ReportDateInput key={`from-${refresh}`} label="From date (UTC)" name="start" required={false} value={draftStart} onChange={setDraftStart}/><ReportDateInput key={`through-${refresh}`} label="To date (UTC)" name="end" required={false} value={draftEnd} onChange={setDraftEnd}/></div>
      <label>Type of activity<select name="action" defaultValue=""><option value="">All financial activity</option>{auditActions.map(action=><option key={action} value={action}>{auditActionLabel(action)}</option>)}</select></label>
      <details className={s.details}><summary>Filter by a specific record or activity code</summary><label>Record reference (optional)<input name="resourceId" maxLength={36} value={recordDraft} onChange={e=>setRecordDraft(e.target.value)}/></label><label>Exact activity code (optional)<input name="customAction" maxLength={78} placeholder="For example: FINANCE_EXPENSE_REVIEWED"/></label></details>
      <div className={s.actions}><button><FinanceIcon name="search"/>Search audit trail</button><button type="button" className={s.secondary} onClick={e=>clear(e.currentTarget.form)}>Clear filters</button></div>
    </fieldset></form>
    {error && <p role="alert" className={s.error}>{error}</p>}
    {!page && !error && <p role="status">Loading audit trail…</p>}
    {page && <>
      <div className={s.actions}>
        <button className={s.secondary} disabled={!previous.length || exporting} onClick={() => {setCursor(previous.at(-1) ?? null); setPrevious(p => p.slice(0,-1)); setPage(null);}}><FinanceIcon name="back"/>Newer activity</button>
        <button className={s.secondary} disabled={!page.nextCursor || exporting} onClick={() => {setPrevious(p => [...p,cursor]); setCursor(page.nextCursor); setPage(null);}}>Older activity<FinanceIcon name="next"/></button>
        <button onClick={() => void download()} disabled={!page.rows.length || exporting}><FinanceIcon name="download"/>{exporting ? "Preparing download…" : "Download this page (CSV)"}</button>
      </div>
      <p role="status" className={s.fileHelp}>Page {previous.length+1} · {page.rows.length} entries{page.nextCursor ? " · More activity available" : " · End of matching history"}. Downloads contain up to 100 matching entries from this page, rather than the whole account. New activity may appear on the first page.</p>
      {!page.rows.length && <p className={s.softPanel}>No activity matches these filters. Try a wider date range or clear the filters.</p>}
      <ol className={s.auditList}>{page.rows.map(row => <li key={row.id}>
        <div className={s.receiptSummary}><strong>{auditActionLabel(row.action)}</strong>{row.decision&&<FinanceStatus value={row.decision}/>}</div>
        <time dateTime={row.occurredAt}>{financeDateLabel(row.occurredAt)} · {new Date(row.occurredAt).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</time>
        {row.reason && <p><strong>Reason:</strong> {row.reason}</p>}
        <details className={s.details}><summary>Staff and record references</summary><p>Staff reference: <code>{row.actorPersonId}</code></p><p>{row.resourceType.replaceAll('_',' ')} reference: <code>{row.resourceId}</code></p><p>Exact timestamp: <code>{row.occurredAt}</code></p><p>Activity code: <code>{row.action}</code></p></details>
      </li>)}</ol>
    </>}
  </section>;
}
