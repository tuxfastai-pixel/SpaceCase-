export type LearnerProfileRecord = {
  profileId: string;
  peosSchoolId: string;
  peosLearnerPersonId: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

export interface LearnerProfileRepository {
  getActiveProfile(
    peosSchoolId: string,
    peosLearnerPersonId: string,
  ): Promise<LearnerProfileRecord | null>;
}
