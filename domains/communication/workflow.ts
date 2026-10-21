export type ParentMessageStatus = "DRAFT" | "REVIEWED" | "APPROVED" | "SENT" | "CANCELLED";

export type CommunicationAction = "REVIEW" | "EDIT" | "APPROVE" | "SEND" | "CANCEL";

const transitions: Record<ParentMessageStatus, Partial<Record<CommunicationAction, ParentMessageStatus>>> = {
  DRAFT: { REVIEW: "REVIEWED", EDIT: "DRAFT", CANCEL: "CANCELLED" },
  REVIEWED: { EDIT: "DRAFT", APPROVE: "APPROVED", CANCEL: "CANCELLED" },
  APPROVED: { SEND: "SENT", CANCEL: "CANCELLED" },
  SENT: {},
  CANCELLED: {},
};

export function transitionParentMessage(status: ParentMessageStatus, action: CommunicationAction): ParentMessageStatus {
  const next = transitions[status][action];
  if (!next) {
    throw new Error(`Invalid communication transition: ${status} -> ${action}`);
  }
  return next;
}

export function requiresTeacherApproval(status: ParentMessageStatus): boolean {
  return status !== "APPROVED" && status !== "SENT";
}
