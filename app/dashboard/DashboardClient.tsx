"use client";

import { useEffect, useState } from "react";

import styles from "./dashboard.module.css";

type SchoolContext = {
  teacherPersonId: string;
  schoolId: string;
  roleIds: string[];
  schoolWorkspace: {
    configured: boolean;
    timezone?: string;
    academicYearLabel?: string;
    settings: Record<string, unknown>;
  };
  classes: Array<{
    classId: string;
    workspaceConfigured: boolean;
    localSettings: Record<string, unknown>;
  }>;
};

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; context: SchoolContext }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

const capabilityGroups = [
  {
    title: "Teaching",
    description: "Classes, lesson planning, assessments and homework.",
  },
  {
    title: "Learner support",
    description: "Authorized school learning profiles and bounded interventions.",
  },
  {
    title: "Communication",
    description: "Teacher-reviewed parent communication and school updates.",
  },
  {
    title: "STA",
    description: "SpaceCase Teacher Assistant — governed AI support for teacher workflows.",
  },
];

export default function DashboardClient() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/v1/school/context", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          setState({ status: "unauthenticated" });
          return;
        }

        if (!response.ok) {
          setState({ status: "unavailable" });
          return;
        }

        const body = (await response.json()) as { schoolContext?: SchoolContext };
        if (!body.schoolContext) {
          setState({ status: "unavailable" });
          return;
        }

        setState({ status: "ready", context: body.schoolContext });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "unavailable" });
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return <DashboardShell><StatusPanel title="Loading teacher context" body="Checking your current PEOS school and class authority…" /></DashboardShell>;
  }

  if (state.status === "unauthenticated") {
    return (
      <DashboardShell>
        <StatusPanel
          title="Sign in required"
          body="STOS only opens a teacher workspace after PEOS has authenticated the person and confirmed current school authority."
        />
      </DashboardShell>
    );
  }

  if (state.status === "unavailable") {
    return (
      <DashboardShell>
        <StatusPanel
          title="Teacher context unavailable"
          body="SpaceCase could not confirm a current PEOS teacher context. No school or learner data has been shown."
        />
      </DashboardShell>
    );
  }

  const { context } = state;
  return (
    <DashboardShell>
      <section className={styles.hero} aria-labelledby="dashboard-heading">
        <div>
          <p className={styles.eyebrow}>Teacher workspace</p>
          <h1 id="dashboard-heading">SpaceCase Teacher OS</h1>
          <p className={styles.lead}>
            Your workspace is scoped to the school and classes currently authorized by PEOS.
          </p>
        </div>
        <div className={styles.authorityBadge}>
          <span>Authority confirmed</span>
          <strong>{context.classes.length} class{context.classes.length === 1 ? "" : "es"}</strong>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label="Current workspace summary">
        <SummaryCard label="School workspace" value={context.schoolWorkspace.configured ? "Configured" : "Not configured"} />
        <SummaryCard label="Assigned classes" value={String(context.classes.length)} />
        <SummaryCard label="Current roles" value={String(context.roleIds.length)} />
        <SummaryCard label="Academic year" value={context.schoolWorkspace.academicYearLabel ?? "Not set"} />
      </section>

      <section className={styles.section} aria-labelledby="work-heading">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Your work</p>
            <h2 id="work-heading">Teacher tools</h2>
          </div>
          <p>Only capabilities backed by current authority should expose learner records.</p>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilityGroups.map((item) => (
            <article className={styles.capabilityCard} key={item.title}>
              <div className={styles.cardMark} aria-hidden="true">{item.title.slice(0, 1)}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className={styles.cardStatus}>Foundation available</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="classes-heading">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Current authority</p>
            <h2 id="classes-heading">My classes</h2>
          </div>
          <p>Class membership comes from PEOS; SpaceCase stores only local operational configuration.</p>
        </div>
        {context.classes.length === 0 ? (
          <div className={styles.emptyState}>No current class assignments were returned by PEOS.</div>
        ) : (
          <div className={styles.classList}>
            {context.classes.map((item, index) => (
              <article className={styles.classRow} key={item.classId}>
                <div>
                  <strong>Assigned class {index + 1}</strong>
                  <span>{item.workspaceConfigured ? "SpaceCase workspace configured" : "Workspace not configured"}</span>
                </div>
                <span className={styles.scopeLabel}>PEOS authorized</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>S</span>
          <div>
            <strong>SpaceCase</strong>
            <span>Teacher OS</span>
          </div>
        </div>
        <div className={styles.environment}>STOS</div>
      </header>
      <div className={styles.content}>{children}</div>
    </main>
  );
}

function StatusPanel({ title, body }: Readonly<{ title: string; body: string }>) {
  return (
    <section className={styles.statusPanel}>
      <p className={styles.eyebrow}>Secure workspace</p>
      <h1>{title}</h1>
      <p>{body}</p>
    </section>
  );
}

function SummaryCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <article className={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
