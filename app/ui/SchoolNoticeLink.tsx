import NoticesEntry from './NoticesEntry';
export default function SchoolNoticeLink({schoolId,className,variant='nav'}:{schoolId:string;className?:string;variant?:'nav'|'tile'}){return <NoticesEntry schoolId={schoolId} className={className} variant={variant}/>;}
