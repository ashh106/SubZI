#!/usr/bin/env python3
"""
Local Whisper transcription + translation script.
Called by Node.js worker via child_process.spawn.

Usage:
  python transcribe.py <audio_path> [source_lang] [target_lang] [model_size]

  source_lang : "auto" or ISO code: "en","hi","ur","ja","zh","ar"...
  target_lang : "en","hi","ur","pa","ja","fr"... or "hinglish"/"hinglish-en"
  model_size  : tiny | base | small | medium | large  (default: base)

Output: clean JSON to stdout (UTF-8):
  { "segments": [...], "detectedLanguage": "xx", "targetLanguage": "xx" }
"""
import sys
import json
import whisper

# ── Force UTF-8 on Windows ───────────────────────────────────────────────────
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

EMOJI_MAP = {
    "money": "💸", "fast": "🚀", "love": "❤️", "viral": "🔥", "ai": "🤖",
    "export": "📤", "confidence": "😎", "amazing": "✨", "time": "⏱️",
    "hack": "🤯", "secret": "🤫", "pro": "💪", "start": "🟢", "stop": "⛔",
    "paisa": "💸", "pyaar": "❤️", "video": "📹", "crazy": "🤪",
}

def apply_emojis_and_extract(segments):
    """Automatically append emojis to viral keywords and extract a master list of keywords."""
    found_keywords = list()
    for seg in segments:
        words = seg["text"].split()
        new_words = []
        for w in words:
            clean_w = w.lower().strip(".,!?\"'")
            if clean_w in EMOJI_MAP:
                new_words.append(f"{w} {EMOJI_MAP[clean_w]}")
                if clean_w not in found_keywords:
                    found_keywords.append(clean_w)
            else:
                new_words.append(w)
        seg["text"] = " ".join(new_words)
    return segments, found_keywords


def devanagari_to_roman(text):
    """Transliterate Hindi Devanagari → Roman script (Hinglish)."""
    try:
        from indic_transliteration import sanscript
        from indic_transliteration.sanscript import transliterate
        return transliterate(text, sanscript.DEVANAGARI, sanscript.IAST)
    except Exception as e:
        sys.stderr.write(f"Transliteration warning: {e}\n")
        return text


def translate_segments(segments, source_lang, target_lang):
    """Post-translate segments using Google Translate (free, via deep-translator)."""
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source="auto", target=target_lang)
        for seg in segments:
            try:
                seg["text"] = translator.translate(seg["text"].strip()) or seg["text"]
            except Exception:
                pass
    except ImportError:
        sys.stderr.write("deep-translator not installed, skipping translation\n")
    return segments


def transcribe(audio_path, source_lang="auto", target_lang="en", model_size="base"):
    sys.stderr.write(f"[Whisper] Loading model '{model_size}'...\n")
    sys.stderr.flush()
    model = whisper.load_model(model_size)
    sys.stderr.write("[Whisper] Model loaded. Starting transcription...\n")
    sys.stderr.flush()

    # ── KEY FIX: redirect stdout → stderr during model.transcribe() calls ────
    # Whisper verbose=True prints [00:00 --> 00:05] lines to stdout.
    # We redirect stdout to stderr so those lines appear in the terminal
    # but do NOT corrupt the JSON we later write to the real stdout.
    _real_stdout = sys.stdout
    sys.stdout = sys.stderr   # Whisper segment lines now go to terminal stderr

    def emit(obj):
        """Restore real stdout and print clean JSON. Called exactly once."""
        sys.stdout = _real_stdout
        print(json.dumps(obj, ensure_ascii=False), flush=True)

    kwargs = {"verbose": True, "fp16": False}

    # ── Hinglish-EN: any audio → English (Whisper built-in translate) ─────────
    if target_lang == "hinglish-en":
        if source_lang != "auto":
            kwargs["language"] = source_lang
        kwargs["task"] = "translate"
        result = model.transcribe(audio_path, **kwargs)
        detected = result.get("language", "unknown")
        
        segments = [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in result["segments"]]
        segments, keywords = apply_emojis_and_extract(segments)

        emit({
            "segments": segments,
            "detectedLanguage": detected,
            "targetLanguage": "hinglish-en",
            "keywords": keywords
        })
        return

    # ── Hinglish: Hindi audio → Roman/Latin script (transliterated) ───────────
    if target_lang == "hinglish":
        kwargs["language"] = source_lang if (source_lang != "auto" and source_lang in WHISPER_LANG_CODES) else "hi"
        result = model.transcribe(audio_path, **kwargs)
        detected = result.get("language", "hi")
        
        segments = [
            {"start": s["start"], "end": s["end"], "text": devanagari_to_roman(s["text"])}
            for s in result["segments"]
        ]
        segments, keywords = apply_emojis_and_extract(segments)

        emit({
            "segments": segments,
            "detectedLanguage": detected,
            "targetLanguage": "hinglish",
            "keywords": keywords
        })
        return

    # ── Standard: transcribe (+ optional translate) ────────────────────────────
    if source_lang != "auto" and source_lang in WHISPER_LANG_CODES:
        kwargs["language"] = source_lang

    result = model.transcribe(audio_path, **kwargs)
    detected = result.get("language", "unknown")
    sys.stderr.write(f"[Whisper] Detected language: {detected}\n")
    sys.stderr.flush()

    # Case 1: Target = English, source ≠ English → re-run with Whisper translate
    if target_lang == "en" and detected != "en":
        sys.stderr.write("[Whisper] Re-running with translate task for English output...\n")
        sys.stderr.flush()
        tq = dict(kwargs)
        tq["task"] = "translate"
        tq["language"] = detected
        result = model.transcribe(audio_path, **tq)

        segments = [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in result["segments"]]
        segments, keywords = apply_emojis_and_extract(segments)

        emit({
            "segments": segments,
            "detectedLanguage": detected,
            "targetLanguage": "en",
            "keywords": keywords
        })
        return

    # Case 2: Target == detected → transcription already in the right language
    if target_lang == detected:
        segments = [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in result["segments"]]
        segments, keywords = apply_emojis_and_extract(segments)

        emit({
            "segments": segments,
            "detectedLanguage": detected,
            "targetLanguage": target_lang,
            "keywords": keywords
        })
        return

    # Case 3: Non-English target different from source → Google Translate
    segments = [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in result["segments"]]
    sys.stdout = _real_stdout
    segments = translate_segments(segments, detected, target_lang)
    
    segments, keywords = apply_emojis_and_extract(segments)

    emit({
        "segments": segments,
        "detectedLanguage": detected,
        "targetLanguage": target_lang,
        "keywords": keywords
    })


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
        sys.stdout = sys.__stdout__
        sys.stdout.reconfigure(encoding="utf-8")
        print(json.dumps({"error": str(e)}), flush=True)
        sys.exit(1)
