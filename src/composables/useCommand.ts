import type { UseSocketReturn } from "./useSocket";
import { useOperationLog } from "./useOperationLog";
import { ref } from "vue";

/** Node-RED 回执的 cmdAck 消息结构 */
export interface AckData {
  type: "cmdAck";
  msgId: number;
  echoType: string;
  ok: boolean;
}

/** modbusRealData 读回消息结构（触点/线圈/寄存器实时值） */
export interface ModbusRealData {
  unitId: number;
  data: number[];
  module?: string | number;
}

/** 读回比对期望值：支持完整数组匹配或业务条件匹配 */
export type ReadbackExpect =
  | { unitId: number; value: number[]; module?: string | number }
  | {
      unitId?: number;
      module?: string | number;
      matches: (data: ModbusRealData) => boolean;
    };

export interface SendCommandOptions {
  /** 单次等待 ack 的超时时间（毫秒），默认 3000 */
  timeout?: number;
  /** 超时后重发次数，默认 2 */
  retries?: number;
  /**
   * 读回比对期望。一旦设置，本指令是否成功「不认 handler 的 cmdAck」，
   * 而是等 modbusRealData 满足指定条件才 resolve(true)。
   */
  expect?: ReadbackExpect;
  /** 操作名（中文），写入操作日志用于展示；缺省用指令 type */
  label?: string;
}

interface PendingCommand {
  cmd: string;
  logId: number;
  expect?: ReadbackExpect;
  finish: (ok: boolean) => void;
}

/** 归一化并逐位比较两个 0/1 数组 */
const coilsEqual = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if ((a[i] ? 1 : 0) !== (b[i] ? 1 : 0)) return false;
  }
  return true;
};

/**
 * 指令收发关联层：每条指令带自增 msgId。
 * - 无 expect：靠 Node-RED 的 cmdAck 回执确认（echoType 与发送 type 一致 → resolve(true)）。
 * - 有 expect：cmdAck 不再作数，必须等到 modbusRealData 满足读回条件才确认，
 *   即「ModbusFlexGetter 真正执行了我发的指令」。
 * 超时重发耗尽 → resolve(false)。
 */
export function useCommand(ws: UseSocketReturn) {
  const opLog = useOperationLog();
  let msgId = 0;
  const pending = new Map<number, PendingCommand>();
  let isOk = ref(false);
  const sendCommand = (
    cmd: string,
    payload: Record<string, any> = {},
    options: SendCommandOptions = {},
  ): Promise<boolean> => {
    const { timeout = 3000, retries = 2, expect, label } = options;
    const id = ++msgId;
    const logId = opLog.start(label ?? cmd, cmd, !!expect, payload.value);

    return new Promise<boolean>((resolve) => {
      let attempts = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = (ok: boolean) => {
        if (timer) clearTimeout(timer);
        pending.delete(id);
        if (!ok) {
          opLog.timeout(logId);
          isOk.value = false;
        } else {
          isOk.value = true;
        }
        setTimeout(() => {
          resolve(ok);
        }, 1000);
      };

      const doSend = () => {
        console.log(`发送指令 ${cmd}，msgId=${id}，尝试次数 ${attempts + 1}`);
        ws.send({ type: cmd, msgId: id, payload });
        timer = setTimeout(() => {
          attempts++;
          if (attempts <= retries) {
            doSend();
          } else {
            finish(false);
          }
        }, timeout);
      };

      pending.set(id, { cmd, logId, expect, finish });
      doSend();
    });
  };

  const onAck = (data: AckData) => {
    const entry = pending.get(data.msgId);
    if (!entry) return;
    const ok = data.ok === true && data.echoType === entry.cmd;
    // 发送层结果照记（带 expect 的指令也记），只是不据此确认
    opLog.ack(entry.logId, ok);
    // 声明了读回比对的指令，cmdAck 只是“到达 Node-RED”，不作确认依据
    if (entry.expect) return;
    entry.finish(ok);
  };

  /** 把 modbusRealData 读回喂给所有等待读回确认的指令 */
  const onModbusRealData = (data: ModbusRealData) => {
    for (const [id, entry] of pending) {
      if (!entry.expect) continue;
      const ex = entry.expect;
      if (ex.unitId !== undefined && ex.unitId !== data.unitId) continue;
      if (ex.module !== undefined && ex.module !== data.module) continue;
      // 每次读回都记录最新值，匹配失败也能看到设备实际回显的线圈
      opLog.readback(entry.logId, data.data);
      const matches =
        "matches" in ex ? ex.matches(data) : coilsEqual(ex.value, data.data);
      if (matches) {
        opLog.exec(entry.logId, true);
        entry.finish(true);
        break;
      }
    }
  };

  return { sendCommand, onAck, onModbusRealData, isOk };
}
