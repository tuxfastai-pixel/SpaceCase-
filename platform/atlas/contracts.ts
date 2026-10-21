export type AtlasReferralPayload = {
  referralId: string;
  parentPersonId: string;
  learnerPersonId: string;
  sourceContextType: string;
  sourceContextId?: string;
  expiresAt: string;
  contractVersion: "spacecase-atlas-referral-v1";
};

export type SchoolSupportRequest = {
  requestId: string;
  learnerPersonId: string;
  schoolId: string;
  classId?: string;
  requestingTeacherPersonId: string;
  subject: string;
  curriculumArea?: string;
  topic?: string;
  concept: string;
  supportReason: string;
  teacherObservationSummary: string;
  supportPriority: "ROUTINE" | "IMPORTANT" | "URGENT";
  requestedOutcome: string;
  homeworkContext?: string;
  assessmentContext?: string;
  sourceObservationIds: string[];
  createdAt: string;
  expiresAt: string;
  contractVersion: "spacecase-atlas-school-support-v1";
};

export type SchoolSupportOutcome = {
  supportRequestId: string;
  learnerPersonId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "MORE_SUPPORT_RECOMMENDED";
  sessionsCompleted: number;
  conceptStatus: "NOT_STARTED" | "INTRODUCED" | "DEVELOPING" | "REINFORCED" | "DEMONSTRATED";
  supportSummary: string;
  teacherFollowupRecommendation?: string;
  updatedAt: string;
  contractVersion: "atlas-spacecase-school-support-outcome-v1";
};

export interface AtlasGateway {
  createReferral(payload: AtlasReferralPayload): Promise<{ opaqueReferralUrl: string }>;
  sendSchoolSupportRequest(request: SchoolSupportRequest): Promise<{ accepted: boolean; atlasReferenceId?: string }>;
  getSchoolSupportOutcome(supportRequestId: string): Promise<SchoolSupportOutcome | null>;
}
