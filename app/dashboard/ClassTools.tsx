import styles from "./dashboard.module.css";
import {classPath,teacherTools,type AssignedClass} from "./workspaceModel";
export default function ClassTools({schoolId,classroom,schoolConfigured}:{schoolId:string;classroom:AssignedClass;schoolConfigured:boolean}){
 const ready=schoolConfigured&&classroom.workspaceConfigured;
 return <section className={styles.section} aria-labelledby="tools-heading"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Your class tools</p><h2 id="tools-heading">Teach, record, follow up</h2></div><p>{classroom.name??"Assigned class"}{classroom.academicYear?` · ${classroom.academicYear}`:""}</p></div>
 {!ready?<p className={styles.setupNotice}>Your class roster is available. Ask your school administrator to finish classroom setup to use the other tools.</p>:null}
 <div className={styles.toolGrid}>{teacherTools.map(tool=><article key={tool.path} className={styles.toolCard}><span className={styles.cardMark} aria-hidden="true">{tool.mark}</span><h3>{tool.title}</h3><p>{tool.description}</p>{ready||!tool.path?<a href={classPath(schoolId,classroom.classId,tool.path)}>{tool.action}<span aria-hidden="true"> →</span></a>:<span className={styles.toolPending}>Classroom setup needed</span>}</article>)}</div></section>;
}
