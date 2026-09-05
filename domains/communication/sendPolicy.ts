import type { ParentMessageStatus } from "./workflow";

export type SendAuthority = {
  status: ParentMessageStatus;
  authenticatedPersonId: string;
  teacherPersonId: string;
  approvedByPersonId: string | null;
};

export function authorizeMessageSend(authority: SendAuthority): boolean {
  return authority.status === "APPROVED"
    && authority.authenticatedPersonId === authority.teacherPersonId
    && authority.approvedByPersonId === authority.teacherPersonId;
}
