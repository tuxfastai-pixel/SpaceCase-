import {z} from "zod";
const id=z.string().uuid();
export const schoolContextSchema=z.object({teacherPersonId:id,schoolId:id,roleIds:z.array(z.string()),setupStatus:z.enum(["CLASS_ASSIGNMENT_REQUIRED","CLASSROOM_SETUP_REQUIRED"]).optional(),schoolWorkspace:z.object({configured:z.boolean().nullable(),timezone:z.string().optional(),academicYearLabel:z.string().optional(),settings:z.record(z.unknown())}),classes:z.array(z.object({classId:id,name:z.string().optional(),academicYear:z.number().nullable().optional(),workspaceConfigured:z.boolean(),localSettings:z.record(z.unknown())}))});
export type SchoolContext=z.infer<typeof schoolContextSchema>;
export type AssignedClass=SchoolContext["classes"][number];
export const teacherTools=[
 {path:"",title:"Class roster",mark:"01",description:"View the current learner list and school references.",action:"View class roster"},
 {path:"attendance",title:"Attendance",mark:"02",description:"Save today’s register and make audited corrections.",action:"Take attendance"},
 {path:"planner",title:"Lesson planner",mark:"03",description:"Prepare lessons, activities and reflections for your week.",action:"Plan lessons"},
 {path:"assessments",title:"Assessments & marking",mark:"04",description:"Upload work, confirm learner matches and review marks.",action:"Open assessments"},
 {path:"homework",title:"Homework",mark:"05",description:"Plan tasks, set due dates and record completion.",action:"Manage homework"},
 {path:"observations",title:"Behaviour & observations",mark:"06",description:"Record factual observations, support and follow-ups.",action:"Open observations"},
 {path:"reports",title:"Learner progress reports",mark:"07",description:"Review saved attendance and your approved assessment results, then print a learner report.",action:"Open reports"},
] as const;
export function classPath(school:string,classId:string,tool=""){return `/classes/${school}/${classId}${tool?`/${tool}`:""}`;}
export function orderedClasses(classes:AssignedClass[],query=""){
 const normalized=query.trim().toLocaleLowerCase();return [...classes].filter(c=>(c.name??"Assigned class").toLocaleLowerCase().includes(normalized)).sort((a,b)=>(a.name??a.classId).localeCompare(b.name??b.classId,undefined,{numeric:true}));
}
