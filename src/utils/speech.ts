import { TextToSpeech } from "@capacitor-community/text-to-speech";

/**
 * 语音播报。
 *
 * 基于 Capacitor 社区 TTS 插件：浏览器/Vite dev 下走 window.speechSynthesis，
 * 打包成 Android 后走系统原生 TextToSpeech，两端同一套调用。
 *
 * 播报内容较长（一次可能连续报多路继电器），因此采用串行队列：
 * 一句播完再播下一句，避免被新语音打断。
 */

/** 单条播报的超时兜底，防止某句卡住导致后续队列不再推进 */
const UTTERANCE_TIMEOUT_MS = 15_000;

let queue: Promise<void> = Promise.resolve();
/** 当前是否正在播报，用于避免重复触发 */
let speaking = false;
let stopped = false;

/** 取中文语音；浏览器首次拿不到 voices 时等 onvoiceschanged */
function pickChineseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "zh-CN") ||
    voices.find((v) => v.lang?.startsWith("zh")) ||
    null
  );
}

/** 底层播放一句，等待结束 */
function speakOne(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "zh-CN";
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 1;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    // 某些引擎不触发 onend，用超时兜底
    const timer = setTimeout(finish, UTTERANCE_TIMEOUT_MS);

    utter.onend = finish;
    utter.onerror = finish;

    const voice = pickChineseVoice();
    if (voice) {
      utter.voice = voice;
      synth.speak(utter);
    } else {
      // voices 异步加载：等就绪后再播
      const onReady = () => {
        const v = pickChineseVoice();
        if (v) utter.voice = v;
        synth.speak(utter);
      };
      if (typeof synth.addEventListener === "function") {
        synth.addEventListener("voiceschanged", onReady, { once: true });
      } else {
        synth.onvoiceschanged = onReady;
      }
      // 极端情况下拿不到语音也要推进队列
      setTimeout(() => {
        if (!settled) {
          synth.cancel();
          finish();
        }
      }, 1500);
    }
  });
}

/**
 * 播报一句话，会打断当前正在进行的播报。
 */
export function speak(text: string): void {
  if (!text) return;
  stopped = false;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  queue = speakOne(text);
}

/**
 * 按顺序播报多句，每句播完再播下一句。
 * 新的一次调用会取消尚未播完的旧队列。
 */
export function speakSequence(texts: string[]): void {
  const list = texts.filter((t) => !!t && t.trim());
  if (!list.length) return;

  stopped = false;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // 串行执行：reduce 把 N 个 Promise 串成一条链
  queue = list.reduce(
    (chain, text) => chain.then(() => (stopped ? undefined : speakOne(text))),
    Promise.resolve(),
  );
  queue.finally(() => {
    speaking = false;
  });
}

/** 停止所有播报并清空队列 */
export function stopSpeak(): void {
  stopped = true;
  queue = Promise.resolve();
  speaking = false;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** 是否正在播报 */
export function isSpeaking(): boolean {
  return speaking;
}

/**
 * Capacitor 原生播报（Android APK 生效）。
 *
 * 在浏览器中插件内部会回落到 window.speechSynthesis，行为一致，
 * 因此与 speak/speakSequence 可互换使用。
 */
export async function speakNative(options: {
  text: string;
  language?: string;
  rate?: number;
}): Promise<void> {
  try {
    await TextToSpeech.speak({
      text: options.text,
      lang: options.language ?? "zh-CN",
      rate: options.rate ?? 0.95,
    });
  } catch (err) {
    // 原生不可用时回落到浏览器实现，保证网页端可用
    console.warn("原生 TTS 不可用，回落到浏览器语音合成", err);
    await speakOne(options.text);
  }
}