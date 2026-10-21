export type AiPurpose =
  | "TEACHER_ASSISTANCE"
  | "LESSON_PLANNING"
  | "ASSESSMENT_ASSISTANCE"
  | "PARENT_COMMUNICATION_DRAFT"
  | "RESOURCE_RESEARCH"
  | "ATLAS_SUPPORT_ASSISTANCE";

export type AiExecutionRequest = {
  purpose: AiPurpose;
  actorPersonId: string;
  schoolId?: string;
  learnerPersonId?: string;
  prompt: string;
  permittedToolIds: string[];
  policyContext: Record<string, string | boolean | number | null>;
};

export type AiExecutionResult = {
  executionId: string;
  text: string;
  modelRef: string;
  policyVersion: string;
};

export interface PsgAiGateway {
  execute(request: AiExecutionRequest): Promise<AiExecutionResult>;
}
