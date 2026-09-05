const forbiddenCrossProductFields = new Set([
  "growthDna",
  "rawConversation",
  "rawReflection",
  "familyDiscussion",
  "diagnosis",
  "password",
  "credential",
]);

export function assertMinimizedIntegrationPayload(payload: Record<string, unknown>): void {
  for (const key of Object.keys(payload)) {
    if (forbiddenCrossProductFields.has(key)) {
      throw new Error(`Forbidden cross-product field: ${key}`);
    }
  }
}
