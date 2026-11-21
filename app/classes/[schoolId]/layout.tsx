import {SchoolWatermark} from '../../ui/appearance/Appearance';
import type {ReactNode} from 'react';
export default async function ClassLayout({children,params}:{children:ReactNode;params:Promise<{schoolId:string}>}){return <><SchoolWatermark school={(await params).schoolId} view='teacher'/>{children}</>;}
