export type InterventionType =
  | "INSTRUCTIONAL_SUPPORT"
  | "HOMEWORK_SUPPORT"
  | "ATTENDANCE_SUPPORT"
  | "BEHAVIOUR_SUPPORT"
  | "COMMUNICATION_SUPPORT";

export type InterventionStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type InterventionRecord = {
  interventionId: string;
  peosSchoolId: string;
  peosLearnerPersonId: string;
  peosClassId: string;
  interventionType: InterventionType;
  status: InterventionStatus;
  goal: string;
  createdByPersonId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export interface InterventionRepository {
  listForLearner(
    peosSchoolId: string,
    peosLearnerPersonId: string,
  ): Promise<InterventionRecord[]>;
}
