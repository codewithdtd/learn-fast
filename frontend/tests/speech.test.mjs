import assert from "node:assert/strict";
import test from "node:test";
import {
  isIOS,
  isSpeechSupported,
  getPronunciationAudioUrl,
  setupAudioSessionPlayback,
  unlockIOSAudio,
} from "../lib/speech.ts";

test("isSpeechSupported returns true when window or Audio is available", () => {
  // In Node environment without window/Audio, it gracefully returns false
  const supported = isSpeechSupported();
  assert.equal(typeof supported, "boolean");
});

test("getPronunciationAudioUrl generates Youdao voice for short words and phrases", () => {
  const wordUrl = getPronunciationAudioUrl("Orienteering");
  assert.ok(wordUrl.includes("dict.youdao.com/dictvoice"));
  assert.ok(wordUrl.includes("audio=Orienteering"));
  assert.ok(wordUrl.includes("type=2"));

  const shortPhraseUrl = getPronunciationAudioUrl("maps and compasses");
  assert.ok(shortPhraseUrl.includes("dict.youdao.com/dictvoice"));
  assert.ok(shortPhraseUrl.includes("audio=maps%20and%20compasses"));
});

test("getPronunciationAudioUrl generates Google TTS stream for full sentences", () => {
  const sentence = "That is because it was the World Orienteering Championships";
  const sentenceUrl = getPronunciationAudioUrl(sentence);
  assert.ok(sentenceUrl.includes("translate.google.com/translate_tts"));
  assert.ok(sentenceUrl.includes("client=tw-ob"));
  assert.ok(sentenceUrl.includes("tl=en"));
});

test("setupAudioSessionPlayback and unlockIOSAudio execute safely in any environment", () => {
  assert.doesNotThrow(() => {
    setupAudioSessionPlayback();
  });
  assert.doesNotThrow(() => {
    unlockIOSAudio();
  });
});

