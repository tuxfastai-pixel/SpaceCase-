export type PeosTeacherContext = {
  personId: string;
  schoolId: string;
  roleIds: string[];
  classIds: string[];
  active: boolean;
};

export type PeosLearnerContext = {
  personId: string;
  schoolId: string;
  classId?: string;
  gradeLevel?: string;
};

export type PeosConsentCheck = {
  granted: boolean;
  consentGrantId?: string;
  policyVersion: string;
};

export interface PeosGateway {
  getTeacherContext(personId: string): Promise<PeosTeacherContext | null>;
  getLearnerContext(personId: string, schoolId: string): Promise<PeosLearnerContext | null>;
  checkConsent(input: {
    parentPersonId: string;
    learnerPersonId: string;
    purpose: string;
    sourceProduct: "SPACECASE";
    destinationProduct: "ATLAS";
  }): Promise<PeosConsentCheck>;
}
