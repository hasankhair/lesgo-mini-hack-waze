// Thin wrapper around the browser's Speech Synthesis API.

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined);

export const speechSupported = () => Boolean(synth() && typeof window.SpeechSynthesisUtterance === 'function');

function pickVoice(lang) {
  const voices = synth()?.getVoices?.() ?? [];
  const base = lang.split('-')[0];
  return voices.find((v) => v.lang === lang) || voices.find((v) => v.lang?.startsWith(base)) || null;
}

// Speaks `text`. Urgent phrases ("Turn left") interrupt anything still being
// said; others queue behind it.
export function speak(text, { lang = 'en-GB', urgent = false } = {}) {
  if (!speechSupported() || !text) return;
  const s = synth();
  if (urgent) s.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1;
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  s.speak(utterance);
}

export function stopSpeaking() {
  synth()?.cancel?.();
}
