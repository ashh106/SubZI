export const LOCAL_WHISPER_MODELS = ["tiny", "base", "small", "medium"] as const;

export type LocalWhisperModel = (typeof LOCAL_WHISPER_MODELS)[number];

type LocalWhisperModelRequestResult =
  | { valid: true; model: LocalWhisperModel }
  | { valid: false };

function isLocalWhisperModel(value: unknown): value is LocalWhisperModel {
  return value === "tiny" || value === "base" || value === "small" || value === "medium";
}

export function validateLocalWhisperModelRequest(body: unknown): LocalWhisperModelRequestResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false };
  }

  if (!Object.prototype.hasOwnProperty.call(body, "localWhisperModel")) {
    return { valid: true, model: "small" };
  }

  const value = (body as Record<string, unknown>).localWhisperModel;
  if (isLocalWhisperModel(value)) {
    return { valid: true, model: value };
  }

  return { valid: false };
}
