import {SchoolWatermark} from '../../ui/appearance/Appearance';
import SchoolNoticeLink from '../../ui/SchoolNoticeLink';
import styles from '../../ui/noticesEntry.module.css';
import type {ReactNode} from 'react';
export default async function ClassLayout({children,params}:{children:ReactNode;params:Promise<{schoolId:string}>}){return <><SchoolWatermark school={(await params).schoolId} view='teacher'/><nav className={styles.shortcut} aria-label='School communication'><SchoolNoticeLink schoolId={(await params).schoolId}/></nav>{children}</>;}
