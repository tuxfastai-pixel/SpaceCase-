import { z } from "zod";

export const parentMessagePurposeSchema = z.enum([
  "LEARNER_PROGRESS",
  "HOMEWORK",
  "ATTENDANCE",
  "BEHAVIOUR",
  "GENERAL_SCHOOL",
]);

export const createParentMessageSchema = z.object({
  schoolId: z.string().uuid(),
  learnerPersonId: z.string().uuid().optional(),
  purpose: parentMessagePurposeSchema,
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
  aiAssisted: z.boolean().default(false),
}).strict();

export const communicationActionSchema = z.object({
  action: z.enum(["REVIEW", "EDIT", "APPROVE", "SEND", "CANCEL"]),
  subject: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === "EDIT" && value.subject === undefined && value.body === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "EDIT requires subject or body" });
  }
});
