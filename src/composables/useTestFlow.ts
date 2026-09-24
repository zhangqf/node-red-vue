/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-09-09 16:32:15
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-09-23 10:43:20
 * @FilePath: /switch-machine/src/composables/useTestFlow.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { ref } from "vue";
import { STEP_TABLE, type StepId } from "@/utils/flow";
import { useCommand, type AckData, type ModbusRealData } from "./useCommand";
import type { UseSocketReturn } from "./useSocket";

/**
 * 测试流程状态机：持有当前步骤，统一收口「合格 → 下一步 / 不合格 → 跳转」，
 * 并基于 useCommand 提供带 ack 确认的指令发送。
 */
export function useTestFlow(ws: UseSocketReturn) {
  const { sendCommand, onAck, onModbusRealData, isOk } = useCommand(ws);

  const currentStep = ref<StepId>("SETUP");

  const transition = (to: StepId) => {
    currentStep.value = to;
  };

  /** 当前步骤判定合格，跳到 onPass */
  const pass = () => {
    console.log(STEP_TABLE[currentStep.value].onPass);
    transition(STEP_TABLE[currentStep.value].onPass);
  };

  /** 当前步骤判定不合格，跳到 onFail（未配置则停留） */
  const fail = () => {
    const target = STEP_TABLE[currentStep.value].onFail;
    if (target) transition(target);
  };

  const reset = () => {
    currentStep.value = "SETUP";
  };

  /** 供 useMessageHandler 的 cmdAck 事件回调使用 */
  const handleAck = (data: AckData) => onAck(data);

  /** 供 useMessageHandler 的 modbusRealData 事件回调使用，喂给等待读回比对的指令 */
  const handleModbusRealData = (data: ModbusRealData) => onModbusRealData(data);

  return {
    currentStep,
    sendCommand,
    handleAck,
    handleModbusRealData,
    transition,
    pass,
    fail,
    reset,
    isOk,
  };
}
