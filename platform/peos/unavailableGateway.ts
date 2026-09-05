import type {
  PeosConsentCheck,
  PeosGateway,
  PeosLearnerContext,
  PeosTeacherContext,
} from "./contracts";

export class UnavailablePeosGateway implements PeosGateway {
  async getTeacherContext(): Promise<PeosTeacherContext | null> {
    return null;
  }

  async getLearnerContext(): Promise<PeosLearnerContext | null> {
    return null;
  }

  async checkConsent(): Promise<PeosConsentCheck> {
    return {
      granted: false,
      policyVersion: "peos-unavailable-v1",
    };
  }
}
