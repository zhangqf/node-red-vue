/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-07-24 18:34:20
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-07-24 18:43:17
 * @FilePath: /switch-machine/src/utils/speech.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
function getChineseVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "zh-CN") ||
    voices.find((v) => v.lang.startsWith("zh")) ||
    null
  );
}

// 核心播放方法
export function speak(
  text: string,
  options?: {
    rate?: number; // 语速 0.1~10，默认 1
    pitch?: number; // 音高 0~2，默认 1
    volume?: number; // 音量 0~1，默认 1
  },
) {
  if (!text) return;
  window.speechSynthesis.cancel(); // 防止重复叠加

  const utter = new SpeechSynthesisUtterance(text);
  utter.voice = getChineseVoice();
  utter.rate = options?.rate ?? 1;
  utter.pitch = options?.pitch ?? 1;
  utter.volume = options?.volume ?? 1;

  // voices 异步加载的容错：第一次可能为 null，延迟重试
  if (!utter.voice) {
    speechSynthesis.onvoiceschanged = () => {
      utter.voice = getChineseVoice();
      speechSynthesis.speak(utter);
    };
    return;
  }

  speechSynthesis.speak(utter);
}

// 停止播放
export function stopSpeak() {
  window.speechSynthesis.cancel();
}
