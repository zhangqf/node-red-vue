import { ref, watch } from "vue";

/** 发送层状态：pending=已发出待确认 */
export type SendStatus = "pending" | "success" | "error";
/** 响应层状态：none=该指令无读回比对 */
export type ExecStatus = "none" | "pending" | "success" | "error";

/** 一条操作记录：发送（cmdAck）与响应（Modbus 读回）两级状态分开记录 */
export interface OperationLogEntry {
  id: number;
  time: number;
  /** 操作名（中文），用于展示 */
  label: string;
  /** 指令 type，排障用 */
  cmd: string;
  send: SendStatus;
  exec: ExecStatus;
  detail?: Record<string, any>;
}

const STORAGE_KEY = "switch-machine:operation-log";
const MAX_ENTRIES = 200;

function load(): OperationLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const entries = ref<OperationLogEntry[]>(load());
let seq = entries.value.reduce((max, e) => Math.max(max, e.id), 0);

// 落盘 debounce 500ms：日志只在操作节点产生，频率与用户操作同级，无需实时写
let saveTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  entries,
  () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value));
      } catch (err) {
        console.error("操作日志持久化失败：", err);
      }
    }, 500);
  },
  { deep: true },
);

const find = (id: number) => entries.value.find((e) => e.id === id);

/** 指令发出：新建一条记录，返回其 id 供后续状态更新 */
function start(
  label: string,
  cmd: string,
  hasExpect: boolean,
  dataValue: any,
): number {
  const id = ++seq;
  entries.value.push({
    id,
    time: Date.now(),
    label,
    cmd,
    send: "pending",
    exec: hasExpect ? "pending" : "none",
    detail: { sendValue: dataValue, execValue: null },
  });
  if (entries.value.length > MAX_ENTRIES) {
    entries.value.splice(0, entries.value.length - MAX_ENTRIES);
  }
  return id;
}

/** 收到 cmdAck：更新发送层状态（带 expect 的指令也记录，只是不据此确认） */
function ack(id: number, ok: boolean) {
  const e = find(id);
  if (e) e.send = ok ? "success" : "error";
}

/** Modbus 读回匹配：更新响应层状态；设备已执行说明必然已送达 */
function exec(id: number, ok: boolean) {
  const e = find(id);
  if (!e) return;
  e.exec = ok ? "success" : "error";
  if (ok) e.send = "success";
}

/** 超时重发耗尽：未定状态的层标记为失败 */
function timeout(id: number) {
  const e = find(id);
  if (!e) return;
  if (e.send === "pending") e.send = "error";
  if (e.exec === "pending") e.exec = "error";
}
function readback(id: number, value: any) {
  const e = find(id);
  if (!e) return;
  if (!e.detail) e.detail = {};
  e.detail.execValue = value;
}

function clear() {
  entries.value = [];
}

/** 供写入测试记录 payload 的快照副本 */
function snapshot(): OperationLogEntry[] {
  return entries.value.map((e) => ({ ...e }));
}

export function useOperationLog() {
  return { entries, readback, start, ack, exec, timeout, clear, snapshot };
}
