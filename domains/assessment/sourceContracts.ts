import {z} from 'zod';
export const sourceKind=z.enum(['QUESTION_PAPER','MEMORANDUM','SUPPORTING']);
export const sourceFormat=z.enum(['JPEG','PDF','DOCX','DOC']);
export type SourceFormat=z.infer<typeof sourceFormat>;
export type SourceKind=z.infer<typeof sourceKind>;
export const sourceTextInput=z.object({revision:z.number().int().positive(),text:z.string().max(40000).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),'Remove unsupported characters'),reviewed:z.boolean()}).strict();
export const SOURCE_LIMIT=20, SOURCE_BYTES=3145728, SOURCE_TOTAL_BYTES=20971520;
export const sourceMime:Record<SourceFormat,string>={JPEG:'image/jpeg',PDF:'application/pdf',DOCX:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',DOC:'application/msword'};
export type SourceMaterial={id:string;kind:SourceKind;format:SourceFormat;byteSize:number;revision:number;transcript:string;transcriptReviewed:boolean};
