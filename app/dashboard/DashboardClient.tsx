"use client";

import { useEffect, useState } from "react";

import styles from "./dashboard.module.css";

import ClassTools from "./ClassTools";
import DayOverview from "./DayOverview";
import {schoolContextSchema,orderedClasses,type SchoolContext} from "./workspaceModel";

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; context: SchoolContext }
  | { status: "unauthenticated" }
  | { status: "onboarding" }
  | { status: "unavailable" };

export default function DashboardClient() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    const timeout=setTimeout(()=>controller.abort(),20000);
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
          if (response.status === 403) {
            setState({ status: "onboarding" });
            return;
          }
          setState({ status: "unavailable" });
          return;
        }

        const body = await response.json();
        const parsed=schoolContextSchema.safeParse(body.schoolContext);
        if (!parsed.success) {
          setState({ status: "unavailable" });
          return;
        }

        setState({ status: "ready", context: parsed.data });
      } catch {
        if (controller.signal.aborted && stopped) return;
        setState({ status: "unavailable" });
      } finally {clearTimeout(timeout);}
    }

    let stopped=false;
    void load();
    return () => {stopped=true;clearTimeout(timeout);controller.abort();};
  }, []);

  if (state.status === "loading") {
    return <DashboardShell><StatusPanel title="Loading teacher context" body="Checking your school and current class access…" /></DashboardShell>;
  }

  if (state.status === "unauthenticated") {
    return (
      <DashboardShell>
        <StatusPanel
          title="Sign in required"
          body="Your session has ended. Sign in again to continue."
        />
        <a href="/login">Continue to sign in</a>
      </DashboardShell>
    );
  }

  if (state.status === "onboarding") {
    return <DashboardShell>
      <StatusPanel title="Welcome to SpaceCase" body="You’re signed in. Your school workspace will appear here once your school connects your account. Ask your school administrator to arrange access—there’s no need to create another account." />
    </DashboardShell>;
  }

  if (state.status === "unavailable") {
    return (
      <DashboardShell>
        <StatusPanel
          title="Workspace temporarily unavailable"
          body="We couldn’t load your school workspace. Please refresh and try again. No learner records have been shown."
        />
      </DashboardShell>
    );
  }

  const { context } = state;
  if (context.setupStatus === "CLASS_ASSIGNMENT_REQUIRED") {
    return <DashboardShell><StatusPanel title="You’ve joined your school" body="Your teacher account is connected. Your school administrator needs to assign your classes before your teaching workspace is ready. You don’t need to accept the invitation again." /><p><button type="button" onClick={() => window.location.reload()}>Refresh workspace</button></p></DashboardShell>;
  }
  return <WorkspaceHome context={context}/>;
}

export function WorkspaceHome({context}:{context:SchoolContext}){
  const [selectedId,setSelectedId]=useState(()=>typeof window!=="undefined"?new URL(window.location.href).searchParams.get("class")??"":"");
  function chooseClass(id:string){setSelectedId(id);const url=new URL(window.location.href);url.searchParams.set("class",id);window.history.replaceState(null,"",url);}
  const [classSearch,setClassSearch]=useState("");
  const classes=orderedClasses(context.classes);
  const selected=classes.find(c=>c.classId===selectedId)??classes[0];
  const matches=orderedClasses(context.classes,classSearch);
  const operational=context.setupStatus!=="CLASSROOM_SETUP_REQUIRED"&&context.schoolWorkspace.configured===true;
  return <DashboardShell>
    <section className={styles.hero} aria-labelledby="dashboard-heading"><div><p className={styles.eyebrow}>Teacher workspace</p><h1 id="dashboard-heading">Ready for your teaching day</h1><p className={styles.lead}>Your classes, teaching tools and follow-ups in one place.</p></div><div className={styles.authorityBadge}><span>Academic year</span><strong>{context.schoolWorkspace.academicYearLabel??"School year not set"}</strong></div></section>
    <nav className={styles.workspaceNav} aria-label="Workspace sections"><a href="#classes-heading">My classes</a><a href="#tools-heading">Class tools</a>{operational&&selected?.workspaceConfigured?<a href="#day-heading">Today’s overview</a>:null}<a href="#next-heading">What’s next</a></nav>
    <section className={styles.classPicker} aria-labelledby="classes-heading"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>{classes.length} assigned {classes.length===1?"class":"classes"}</p><h2 id="classes-heading">Choose your class</h2></div><button className={styles.secondaryButton} type="button" onClick={()=>window.location.reload()}>Refresh class access</button></div>
      <div className={styles.pickerFields}><label>Find a class<input type="search" value={classSearch} onChange={e=>setClassSearch(e.target.value)} placeholder="Search by class name"/></label><label>Current class<select value={selected?.classId??""} onChange={e=>chooseClass(e.target.value)}>{classes.map((c,i)=><option key={c.classId} value={c.classId}>{c.name??`Assigned class ${i+1}`}{c.academicYear?` · ${c.academicYear}`:""}</option>)}</select></label></div>
      {classSearch?<div className={styles.classChips} aria-label="Class search results">{matches.length?matches.map(c=><button type="button" key={c.classId} aria-pressed={selected?.classId===c.classId} onClick={()=>chooseClass(c.classId)}>{c.name??"Assigned class"}</button>):<p>No assigned classes match this search.</p>}</div>:null}
      <p className={styles.subtle}>Only your current assigned classes appear here. Contact your school administrator if a class is missing.</p>
    </section>
    {selected?<>{operational&&selected.workspaceConfigured?<DayOverview key={`${context.schoolId}:${selected.classId}`} schoolId={context.schoolId} classId={selected.classId}/>:null}<ClassTools schoolId={context.schoolId} classroom={selected} schoolConfigured={operational}/></>:<p className={styles.emptyState}>No current class assignments are available. Ask your school administrator to assign your classes.</p>}
    <p><a href="/family/onboarding">Family setup: start or continue your private draft</a></p>
    <section className={styles.roadmap} aria-labelledby="next-heading"><p className={styles.eyebrow}>Still to come</p><h2 id="next-heading">More support for your working day</h2><p>Official term reports, reviewed family communication, teaching resources and the SpaceCase Teacher Assistant are planned. These capabilities will appear as tools once they are available.</p><p className={styles.subtle}>Your planning, homework and observation notes remain private to your teacher workspace. Automatic email delivery and live AI execution are not enabled.</p></section>
  </DashboardShell>;
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
        <form action="/auth/logout" method="post"><button type="submit">Sign out</button></form>
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
      <p><a href="/family/onboarding">Set up your family profile draft</a> · <a href="/help/parents">Parent / guardian help</a></p>
    </section>
  );
}
