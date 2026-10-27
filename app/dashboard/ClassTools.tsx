import WorkspaceIcon, {type WorkspaceIconName} from "../ui/WorkspaceIcon";
import {TeacherExamples} from "../teacher-help/TeacherGuide";
import styles from "./dashboard.module.css";
import {classPath,teacherTools,type AssignedClass} from "./workspaceModel";
const toolIcons:Record<string,WorkspaceIconName>={"":"people",attendance:"attendance",planner:"planner",assessments:"assessment",homework:"homework",observations:"observations",reports:"report"};
export default function ClassTools({schoolId,classroom,schoolConfigured}:{schoolId:string;classroom:AssignedClass;schoolConfigured:boolean}){
 const ready=schoolConfigured&&classroom.workspaceConfigured;
 return <section className={styles.section} aria-labelledby="tools-heading"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Your class tools</p><h2 id="tools-heading">Teach, record, follow up</h2></div><p>{classroom.name??"Assigned class"}{classroom.academicYear?` · ${classroom.academicYear}`:""}</p></div>
 <TeacherExamples/>
 {!ready?<p className={styles.setupNotice}>Your class roster is available. Ask your school administrator to finish classroom setup to use the other tools.</p>:null}
 {ready?<a className={styles.scanShortcut} href={`${classPath(schoolId,classroom.classId,"assessments")}?scan=1`}><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false"><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></svg><span><strong>Scan / upload work</strong><span>Take page photos or upload a batch for {classroom.name??"this class"}. Choose the assessment next.</span></span><span aria-hidden="true">→</span></a>:null}
 <div className={styles.toolGrid}>{teacherTools.map(tool=>{
  const available=ready||!tool.path;
  const content=<><WorkspaceIcon name={toolIcons[tool.path]}/><div className={styles.toolText}><h3>{tool.title}</h3><p>{tool.description}</p><span className={available?styles.toolAction:styles.toolPending}>{available?tool.action:"Classroom setup needed"}</span></div>{available?<span className={styles.toolArrow} aria-hidden="true">→</span>:null}</>;
  return available?<a key={tool.path} className={`${styles.toolCard} ${styles.toolLink}`} href={classPath(schoolId,classroom.classId,tool.path)}>{content}</a>:<article key={tool.path} className={`${styles.toolCard} ${styles.toolDisabled}`}>{content}</article>;
 })}</div></section>;
}
