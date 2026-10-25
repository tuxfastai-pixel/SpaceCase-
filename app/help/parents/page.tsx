import ParentHelp from '../ParentHelp';
import styles from './parents.module.css';
export const metadata={title:'Parent and guardian help | SpaceCase'};
export default function ParentHelpPage(){return <main className={styles.page}><nav aria-label="Help navigation"><a href="/login">SpaceCase sign-in</a></nav><p className={styles.eyebrow}>SpaceCase · Family guidance</p><h1>Parent & guardian help</h1><p className={styles.availability}><strong>Parent workspace not available yet.</strong> This page explains current access and how to get school assistance. It contains no learner records.</p><ParentHelp/></main>;}
