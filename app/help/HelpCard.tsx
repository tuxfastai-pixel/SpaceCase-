import styles from '../teacher-help/teacherHelp.module.css';
import type {ReactNode} from 'react';
export default function HelpCard({title,description,children,spotlight=false}:{title:string;description:string;children:ReactNode;spotlight?:boolean}){
 return <details className={`${styles.guide} ${spotlight?styles.spotlight:''}`}><summary><span className={styles.helpIcon} aria-hidden="true">?</span><span className={styles.summaryText}><strong>{title}</strong><span>{description}</span></span><span className={styles.chevron} aria-hidden="true">⌄</span></summary><div className={styles.body}>{children}</div></details>;
}
