#!/usr/bin/env python3
"""
Local Whisper transcription + translation script.
Called by Node.js worker via child_process.spawn.

Usage:
  python transcribe.py <audio_path> [source_lang] [target_lang] [model_size]

  source_lang : "auto" for auto-detect, or ISO code: "en","hi","ur","ja","zh","ar"...
  target_lang : ISO code for output language: "en","hi","ur","pa","ja","fr","de","ar"...
                Special: "hinglish" (Roman Hindi), "hinglish-en" (Hindi audio → English)
  model_size  : tiny | base | small | medium | large  (default: base)

Output: JSON to stdout (UTF-8):
  { "segments": [...], "detectedLanguage": "xx", "targetLanguage": "xx" }
"""
import sys
import json
import whisper

# ── Force UTF-8 on Windows (avoids charmap codec errors with Hindi/Japanese/etc) ──
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

WHISPER_LANG_CODES = {
    "en", "zh", "de", "es", "ru", "ko", "fr", "ja", "pt", "tr",
    "pl", "ca", "nl", "ar", "sv", "it", "id", "hi", "fi", "vi",
    "he", "uk", "el", "ms", "cs", "ro", "da", "hu", "ta", "no",
    "th", "ur", "hr", "bg", "lt", "la", "mi", "ml", "cy", "sk",
    "te", "fa", "lv", "bn", "sr", "az", "sl", "kn", "et", "mk",
    "br", "eu", "is", "hy", "ne", "mn", "bs", "kk", "sq", "sw",
    "gl", "mr", "pa", "si", "km", "sn", "yo", "so", "af", "oc",
    "ka", "be", "tg", "sd", "gu", "am", "yi", "lo", "uz", "fo",
    "ht", "ps", "tk", "nn", "mt", "sa", "lb", "my", "bo", "tl",
    "mg", "as", "tt", "haw", "ln", "ha", "ba", "jw", "su",
}

# Pseudo-codes we handle ourselves (not passed to Whisper/Google)
CUSTOM_TARGETS = {"hinglish", "hinglish-en"}


def devanagari_to_roman(text):
    """Transliterate Hindi Devanagari text → Roman script (Hinglish)."""
    try:
        from indic_transliteration import sanscript
        from indic_transliteration.sanscript import transliterate
        return transliterate(text, sanscript.DEVANAGARI, sanscript.IAST)
    except Exception as e:
        sys.stderr.write(f"Transliteration warning: {e}\n")
        return text  # fallback: return as-is


def fmt_time_srt(s):
    ms  = round((s % 1) * 1000)
    sec = int(s % 60)
    mn  = int((s // 60) % 60)
    hr  = int(s // 3600)
    return f"{hr:02d}:{mn:02d}:{sec:02d},{ms:03d}"


def translate_segments(segments, source_lang, target_lang):
    """Translate segment texts using deep-translator (Google Translate, free)."""
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source="auto", target=target_lang)
        for seg in segments:
            try:
                seg["text"] = translator.translate(seg["text"].strip()) or seg["text"]
            except Exception:
                pass  # keep original if translate fails
    except ImportError:
        sys.stderr.write("deep-translator not installed, skipping translation\n")
    return segments


def transcribe(audio_path, source_lang="auto", target_lang="en", model_size="base"):
    sys.stderr.write(f"[Whisper] Loading model '{model_size}'...\n")
    sys.stderr.flush()
    model = whisper.load_model(model_size)
    sys.stderr.write(f"[Whisper] Model loaded. Starting transcription...\n")
    sys.stderr.flush()
    kwargs = {"verbose": True}   # shows progress bar in terminal

    # ── Hinglish-EN: Hindi audio → English subtitles (Whisper built-in translate) ──
    if target_lang == "hinglish-en":
        if source_lang not in ("auto",):
            kwargs["language"] = source_lang or "hi"
        kwargs["task"] = "translate"   # Whisper translates to English
        result = model.transcribe(audio_path, **kwargs)
        detected_lang = result.get("language", "unknown")
        segments = [
            {"start": s["start"], "end": s["end"], "text": s["text"]}
            for s in result["segments"]
        ]
        print(json.dumps({
            "segments": segments,
            "detectedLanguage": detected_lang,
            "targetLanguage": "hinglish-en",
        }, ensure_ascii=False))
        return

    # ── Hinglish: Hindi spoken → Roman/Latin script (Devanagari transliterated) ──
    if target_lang == "hinglish":
        # Transcribe in Hindi first (Devanagari output)
        if source_lang not in ("auto",) and source_lang in WHISPER_LANG_CODES:
            kwargs["language"] = source_lang
        else:
            kwargs["language"] = "hi"   # force Hindi for Devanagari output
        result = model.transcribe(audio_path, **kwargs)
        detected_lang = result.get("language", "hi")
        segments = []
        for s in result["segments"]:
            roman_text = devanagari_to_roman(s["text"])
            segments.append({"start": s["start"], "end": s["end"], "text": roman_text})
        print(json.dumps({
            "segments": segments,
            "detectedLanguage": detected_lang,
            "targetLanguage": "hinglish",
        }, ensure_ascii=False))
        return

    # ── Standard mode: transcribe (+ optional translate) ──────────────────────
    if source_lang != "auto" and source_lang in WHISPER_LANG_CODES:
        kwargs["language"] = source_lang

    result = model.transcribe(audio_path, **kwargs)
    detected_lang = result.get("language", "unknown")

    # ── Decide translation strategy ──────────────────────────────────────────
    # These languages Whisper outputs natively — no Google Translate needed
    WHISPER_NATIVE_LANGS = WHISPER_LANG_CODES

    # Case 1: Target is English → ALWAYS use Whisper's built-in translate task
    # This handles: auto-detect Hindi audio → English, Japanese → English, etc.
    if target_lang == "en" and detected_lang != "en":
        # Re-run with translate task for accurate English output
        translate_kwargs = dict(kwargs)
        translate_kwargs["task"] = "translate"
        translate_kwargs["language"] = detected_lang  # pin detected language
        result = model.transcribe(audio_path, **translate_kwargs)
        segments = [
            {"start": s["start"], "end": s["end"], "text": s["text"]}
            for s in result["segments"]
        ]
        print(json.dumps({
            "segments": segments,
            "detectedLanguage": detected_lang,
            "targetLanguage": "en",
        }, ensure_ascii=False))
        return

    # Case 2: Target matches detected language → just return transcription as-is
    if target_lang == detected_lang:
        segments = [
            {"start": s["start"], "end": s["end"], "text": s["text"]}
            for s in result["segments"]
        ]
        print(json.dumps({
            "segments": segments,
            "detectedLanguage": detected_lang,
            "targetLanguage": target_lang,
        }, ensure_ascii=False))
        return

    # Case 3: Non-English target that differs from source → Google Translate
    segments = [
        {"start": s["start"], "end": s["end"], "text": s["text"]}
        for s in result["segments"]
    ]
    segments = translate_segments(segments, detected_lang, target_lang)

    print(json.dumps({
        "segments": segments,
        "detectedLanguage": detected_lang,
        "targetLanguage": target_lang,
    }, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: transcribe.py <audio> [src_lang] [tgt_lang] [model]"}))
        sys.exit(1)

    audio_path  = sys.argv[1]
    source_lang = sys.argv[2] if len(sys.argv) > 2 else "auto"
    target_lang = sys.argv[3] if len(sys.argv) > 3 else "en"
    model_size  = sys.argv[4] if len(sys.argv) > 4 else "base"

    try:
        transcribe(audio_path, source_lang, target_lang, model_size)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
