import { z } from "zod";

import type {
  PeosConsentCheck,
  PeosGateway,
  PeosLearnerContext,
  PeosTeacherContext,
} from "./contracts";

const teacherContextSchema = z.object({
  personId: z.string().min(1),
  schoolId: z.string().min(1),
  roleIds: z.array(z.string()),
  classIds: z.array(z.string()),
  active: z.boolean(),
});

const learnerContextSchema = z.object({
  personId: z.string().min(1),
  schoolId: z.string().min(1),
  classId: z.string().optional(),
  gradeLevel: z.string().optional(),
});

const consentCheckSchema = z.object({
  granted: z.boolean(),
  consentGrantId: z.string().optional(),
  policyVersion: z.string().min(1),
});

export class HttpPeosGateway implements PeosGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly authorization: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getTeacherContext(personId: string): Promise<PeosTeacherContext | null> {
    const response = await this.fetchImpl(
      new URL(`/v1/people/${encodeURIComponent(personId)}/teacher-context`, this.baseUrl),
      { headers: this.headers() },
    );

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`PEOS teacher context failed: ${response.status}`);

    return teacherContextSchema.parse(await response.json());
  }

  async getLearnerContext(
    personId: string,
    schoolId: string,
  ): Promise<PeosLearnerContext | null> {
    const url = new URL(
      `/v1/people/${encodeURIComponent(personId)}/learner-context`,
      this.baseUrl,
    );
    url.searchParams.set("schoolId", schoolId);

    const response = await this.fetchImpl(url, { headers: this.headers() });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`PEOS learner context failed: ${response.status}`);

    return learnerContextSchema.parse(await response.json());
  }

  async checkConsent(input: {
    parentPersonId: string;
    learnerPersonId: string;
    purpose: string;
    sourceProduct: "SPACECASE";
    destinationProduct: "ATLAS";
  }): Promise<PeosConsentCheck> {
    const response = await this.fetchImpl(new URL("/v1/consents/check", this.baseUrl), {
      method: "POST",
      headers: {
        ...this.headers(),
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) throw new Error(`PEOS consent check failed: ${response.status}`);
    return consentCheckSchema.parse(await response.json());
  }

  private headers(): HeadersInit {
    return {
      authorization: this.authorization,
      accept: "application/json",
      "x-psg-source-product": "SPACECASE",
    };
  }
}
