import {
  AI_CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  acceptAiConsent,
  hasAiConsent,
} from "@/lib/ai-consent";

describe("AI consent storage", () => {
  it("is absent until accepted", () => {
    expect(hasAiConsent()).toBe(false);
    expect(acceptAiConsent()).toBe(true);
    expect(hasAiConsent()).toBe(true);
    expect(JSON.parse(localStorage.getItem(AI_CONSENT_STORAGE_KEY) as string)).toEqual({
      version: CONSENT_VERSION,
    });
  });

  it("re-prompts when the stored version is older", () => {
    localStorage.setItem(
      AI_CONSENT_STORAGE_KEY,
      JSON.stringify({ version: CONSENT_VERSION - 1 })
    );
    expect(hasAiConsent()).toBe(false);
  });

  it("ignores a corrupt value", () => {
    localStorage.setItem(AI_CONSENT_STORAGE_KEY, "yes");
    expect(hasAiConsent()).toBe(false);
  });
});
