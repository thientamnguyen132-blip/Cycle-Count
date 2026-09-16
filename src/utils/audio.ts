/**
 * Audio and Text-to-Speech (TTS) engine for SPX Cycle Count
 * Uses standard Web SpeechSynthesis API and Web Audio API
 */

// Simple detector to check if text is likely Vietnamese
export function isVietnameseText(text: string): boolean {
  // Vietnamese accented characters
  const vietnameseRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
  return vietnameseRegex.test(text);
}

/**
 * Checks if the OnHoldReason corresponds to a canceled/rejected order:
 * - Reject - Buyers change their mind
 * - Recipient reject
 * - Reject - Wrong item
 */
export function isRejectedCancelReason(reason: string): boolean {
  if (!reason) return false;
  const lower = reason.trim().toLowerCase();
  return (
    lower.includes('buyers change their mind') ||
    lower.includes('recipient reject') ||
    lower.includes('wrong item') ||
    lower === 'reject - buyers change their mind' ||
    lower === 'recipient reject' ||
    lower === 'reject - wrong item'
  );
}

/**
 * Plays OnHoldReason text using browser SpeechSynthesis
 * If reason is one of the rejected cancel reasons, speaks in Vietnamese: "Đơn Hàng Bị Hủy"
 */
export function speakOnHoldReason(
  reason: string,
  options?: { rate?: number; onEnd?: () => void }
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis API is not supported in this browser.');
    return;
  }

  // Cancel any ongoing speech immediately
  window.speechSynthesis.cancel();

  const trimmed = (reason || '').trim();
  const isCanceled = isRejectedCancelReason(trimmed);

  // If matches rejected reasons, override with Vietnamese phrase "Đơn Hàng Bị Hủy"
  let textToSpeak = trimmed.length > 0 ? trimmed : 'Không có lý do OnHold';
  let isVN = isVietnameseText(textToSpeak) || trimmed.length === 0;

  if (isCanceled) {
    textToSpeak = 'Đơn Hàng Bị Hủy';
    isVN = true;
  }

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.rate = options?.rate ?? (isCanceled ? 0.95 : 1.0);
  utterance.pitch = isCanceled ? 1.1 : 1.0;

  // Language selection: English vs Vietnamese
  const targetLangPrefix = isVN ? 'vi' : 'en';

  const voices = window.speechSynthesis.getVoices();
  const selectedVoice =
    voices.find((v) => v.lang.toLowerCase().startsWith(targetLangPrefix)) ||
    voices.find((v) => (isVN ? v.lang.includes('VN') || v.lang.includes('vi') : v.lang.includes('en')));

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = isVN ? 'vi-VN' : 'en-US';
  }

  if (options?.onEnd) {
    utterance.onend = options.onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Web Audio API synthesizer for instant feedback beeps (no external audio files needed)
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * High-fidelity, pleasant crystal bell "ting" chime for confirmed scan
 * Synthesizes harmonious bell harmonics with smooth decay
 */
export function playSuccessBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Primary crystal bell chime (high E6 - 1318.51Hz & A6 - 1760Hz shimmer)
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1567.98, now); // G6
  osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.05); // A6 shimmer

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(2093, now); // C7 harmonic chime
  osc2.frequency.exponentialRampToValueAtTime(2637, now + 0.06); // E7

  // Envelope: immediate punch, smooth acoustic ring out
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.006); // Instant attack
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45); // Resonant ting decay

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.45);
  osc2.stop(now + 0.45);
}

/**
 * Warning buzzer when order code is not found in session
 */
export function playWarningBuzzer(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, now); // Low A3
  osc.frequency.setValueAtTime(180, now + 0.15);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.35);
}

/**
 * Chime for already checked order
 */
export function playAlreadyCheckedChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(659.25, now); // E5
  osc.frequency.setValueAtTime(659.25, now + 0.1);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.2);
}
