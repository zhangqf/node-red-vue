import { computed, onMounted, onUnmounted, ref } from "vue";
import { useOperationLog } from "./useOperationLog";

/** 单条日志的逐位展示数据：发送/响应各一排 0/1 格子，diff 位标红 */
export interface LogBit {
  v: number;
  diff: boolean;
  missing: boolean;
}

const normalizeBits = (v: any): number[] | null =>
  Array.isArray(v) ? v.map((x) => (x ? 1 : 0)) : null;

/**
 * 操作日志抽屉：把 useOperationLog 的原始条目展开成逐位对比的展示数据。
 * 只负责展示，不参与指令流程。
 */
export function useOperationLogPanel() {
  const { entries, clear } = useOperationLog();

  const logDrawerOpen = ref(false);

  /** 最新在前，每条记录展开为发送/响应两排位网格 */
  const logDisplay = computed(() => {
    return entries.value
      .slice()
      .reverse()
      .map((e) => {
        const send = normalizeBits(e.detail?.sendValue);
        const recv = normalizeBits(e.detail?.execValue);
        const len = Math.max(send?.length ?? 0, recv?.length ?? 0);
        const sendBits: LogBit[] = [];
        const recvBits: LogBit[] = [];
        for (let i = 0; i < len; i++) {
          const s = send?.[i];
          const r = recv?.[i];
          const sMissing = s === undefined;
          const rMissing = r === undefined;
          const diff = !sMissing && !rMissing && s !== r;
          sendBits.push({ v: s ?? 0, diff, missing: sMissing });
          recvBits.push({ v: r ?? 0, diff, missing: rMissing });
        }
        const diffIndices: number[] = [];
        for (let i = 0; i < len; i++) if (sendBits[i]?.diff) diffIndices.push(i);
        return {
          e,
          sendBits,
          recvBits,
          hasSend: !!send,
          hasRecv: !!recv,
          diffIndices,
        };
      });
  });

  /** 有任一层失败的条目，用于页面底部的异常提示条 */
  const operationLogErrors = computed(() =>
    logDisplay.value.filter(
      ({ e }) => e.send === "error" || e.exec === "error",
    ),
  );

  const bitClass = (b: LogBit) => {
    if (b.missing) return "log-bit-missing";
    if (b.diff) return "log-bit-diff";
    return b.v ? "log-bit-on" : "log-bit-off";
  };

  const diffText = (indices: number[]) =>
    indices.length ? `差异位:${indices.map((i) => i + 1).join(",")}` : "";

  const formatLogTime = (ts: number) =>
    new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });

  const logStatusText = (s: string) =>
    s === "success"
      ? "成功"
      : s === "error"
        ? "失败"
        : s === "pending"
          ? "待确认"
          : "无读回";

  const onLogKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") logDrawerOpen.value = false;
  };
  onMounted(() => window.addEventListener("keydown", onLogKeydown));
  onUnmounted(() => window.removeEventListener("keydown", onLogKeydown));

  return {
    entries,
    logDrawerOpen,
    logDisplay,
    operationLogErrors,
    bitClass,
    diffText,
    formatLogTime,
    logStatusText,
    clearLog: clear,
  };
}