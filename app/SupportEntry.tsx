"use client";
import {usePathname} from "next/navigation";
export default function SupportEntry(){
 const path=usePathname();if(path==="/support"||path.startsWith("/founder"))return null;
 const area=path.includes("/attendance")?"ATTENDANCE":path.includes("/learners")||path.startsWith("/classes")?"ROSTER":path.startsWith("/admin")?"SCHOOL_ADMIN":path==="/dashboard"?"DASHBOARD":"OTHER";
 return <footer style={{fontFamily:"system-ui,sans-serif",padding:"18px 24px",background:"#f4f7f3",borderTop:"1px solid #dce5da"}}><a style={{color:"#234d35",fontWeight:650}} href={"/support?area="+area}>Report an issue / Share feedback</a></footer>;
}
