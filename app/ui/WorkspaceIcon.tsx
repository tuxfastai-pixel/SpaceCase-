import type { ReactNode } from "react";
import styles from "./workspaceIcon.module.css";

const artwork = {
  today: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
  class: <><path d="M3 7.5 12 3l9 4.5L12 12 3 7.5Z"/><path d="M6 10v5c3 3 9 3 12 0v-5M21 8v7"/></>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.5a5.5 5.5 0 0 1 11 0V19M17 5a3 3 0 0 1 0 6M17 14a4 4 0 0 1 3.5 4V19"/></>,
  attendance: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6M8.5 11l2 2 4-4M9 17h6"/></>,
  planner: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3"/></>,
  assessment: <><path d="M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 15h7M9 18h5"/></>,
  homework: <><path d="M4 5h7a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H4zM20 5h-3a3 3 0 0 0-3 3v12a3 3 0 0 1 3-3h3z"/></>,
  observations: <><path d="M12 20s-8-4.5-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5.5-8 10-8 10Z"/></>,
  report: <><path d="M5 20h14M7 17v-4M12 17V7M17 17v-7"/><path d="M5 4h14"/></>,
  camera: <><path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3"/></>,
  school: <><path d="M3 10 12 4l9 6M5 9v11h14V9M9 20v-6h6v6M10 9h4"/></>,
  family: <><circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="8" r="2.5"/><circle cx="12" cy="13" r="2"/><path d="M2.5 19v-1a5.5 5.5 0 0 1 5-5.5M21.5 19v-1a5.5 5.5 0 0 0-5-5.5M8 20v-1a4 4 0 0 1 8 0v1"/></>,
  connection: <><path d="M10 13.5 14 9.5M8.5 16l-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M15.5 8l1-1a3.5 3.5 0 1 1 5 5l-3 3a3.5 3.5 0 0 1-5 0"/></>,
  support: <><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/><circle cx="12" cy="12" r="7"/></>,
  billing: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4M12 17h.01"/></>,
  refresh: <><path d="M19 8a7.5 7.5 0 0 0-13-2L4 8M4 4v4h4M5 16a7.5 7.5 0 0 0 13 2l2-2M20 20v-4h-4"/></>,
  overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
} satisfies Record<string, ReactNode>;

export type WorkspaceIconName = keyof typeof artwork;
export default function WorkspaceIcon({name}: {name: WorkspaceIconName}) {
  return <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">{artwork[name]}</svg></span>;
}
