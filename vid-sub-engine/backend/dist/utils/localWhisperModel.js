"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_WHISPER_MODELS = void 0;
exports.validateLocalWhisperModelRequest = validateLocalWhisperModelRequest;
exports.LOCAL_WHISPER_MODELS = ["tiny", "base", "small", "medium"];
function isLocalWhisperModel(value) {
    return value === "tiny" || value === "base" || value === "small" || value === "medium";
}
function validateLocalWhisperModelRequest(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { valid: false };
    }
    if (!Object.prototype.hasOwnProperty.call(body, "localWhisperModel")) {
        return { valid: true, model: "small" };
    }
    const value = body.localWhisperModel;
    if (isLocalWhisperModel(value)) {
        return { valid: true, model: value };
    }
    return { valid: false };
}
