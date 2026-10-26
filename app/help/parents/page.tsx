import ParentHelp from '../ParentHelp';
import styles from './parents.module.css';
export const metadata={title:'Parent and guardian help | SpaceCase'};
export default function ParentHelpPage(){return <main className={styles.page}><nav aria-label="Help navigation"><a href="/login">SpaceCase sign-in</a></nav><p className={styles.eyebrow}>SpaceCase · Family guidance</p><h1>Parent & guardian help</h1><p className={styles.availability}><strong>Family drafts and school connection requests are available.</strong> School-record views are still being completed. This help page contains no learner records. <a href="/pilot">Open the school pilot guide</a>.</p><ParentHelp/></main>;}
