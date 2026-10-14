const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateLocalWhisperModelRequest } = require("../src/utils/localWhisperModel");

test("defaults requests without a local Whisper model to small", () => {
  assert.deepEqual(validateLocalWhisperModelRequest({ sourceLanguage: "auto" }), {
    valid: true,
    model: "small",
  });
});

test("accepts every supported local Whisper model in an upload request", () => {
  for (const model of ["tiny", "base", "small", "medium"]) {
    assert.deepEqual(validateLocalWhisperModelRequest({ localWhisperModel: model }), {
      valid: true,
      model,
    });
  }
});

test("rejects unsupported local Whisper model values", () => {
  for (const model of ["large", "Gemini Flash", "", 1, ["small"]]) {
    assert.deepEqual(validateLocalWhisperModelRequest({ localWhisperModel: model }), {
      valid: false,
    });
  }
});
