import { computed, ref, type Ref } from "vue";
import { gen32BitArray } from "@/utils/utils";
import { testExpress } from "@/utils/config";
import type { useTestFlow } from "./useTestFlow";

interface UseExpressRelayOptions {
  flow: ReturnType<typeof useTestFlow>;
  deviceType: Ref<string>;
  /** 各继电器当前期望状态（default_status），随操作实时改动 */
  terminals: Ref<any[]>;
  /** 线圈所在 unitId，与 flows.json 的 deviceType 推导一致 */
  coilUnitId: (deviceType: string) => number;
  onError: (msg: string) => void;
}

/**
 * 表示继电器生命周期。
 *
 * 表示回路与电阻测量回路共用部分线圈：表示带电会把电阻采样拉偏，
 * 因此「测电阻前必须关表示」是硬约束；测完、操动完再合上给操作员看位置。
 *
 * 本模块统一表达三件事：表示位是哪几位、怎么强制开关、下发用什么指令，
 * 避免各调用点各写一遍 gen32BitArray(initResult, testExpress[...])。
 */
export function useExpressRelay(options: UseExpressRelayOptions) {
  const { flow, deviceType, terminals, coilUnitId, onError } = options;

  /** 表示继电器在线圈数组中的下标 */
  const expressIndexes = computed<number[]>(
    () =>
      [...(testExpress[deviceType.value as keyof typeof testExpress] ?? [])],
  );

  /** 表示当前是否处于合上状态（仅表示本模块下发过的状态，不含外部写入） */
  const isOn = ref(false);

  /** 按当前 terminals 的 default_status 生成基础期望值 */
  const buildBase = (): number[] =>
    gen32BitArray(
      terminals.value.map((item) => item.default_status),
      [],
    );

  /** 关表示：默认态 + 表示位强制 0 */
  const buildOffValue = (): number[] => {
    const v = buildBase();
    for (const idx of expressIndexes.value) v[idx] = 0;
    return v;
  };

  /** 开表示：默认态 + 表示位强制 1 */
  const buildOnValue = (): number[] =>
    gen32BitArray(buildBase(), [...expressIndexes.value]);

  /** 往已有期望值里抹掉表示位，不重新构造 */
  const stripExpress = (value: number[]): number[] => {
    const v = [...value];
    for (const idx of expressIndexes.value) v[idx] = 0;
    return v;
  };

  const send = async (
    value: number[],
    label: string,
    failTip: string,
  ): Promise<boolean> => {
    const ok = await flow.sendCommand(
      "startBeforeTestRelays",
      { value, deviceType: deviceType.value },
      {
        label,
        expect: { unitId: coilUnitId(deviceType.value), value },
      },
    );
    if (!ok) onError(failTip);
    return ok;
  };

  /** 合上表示。用于选型完成、表示测试、操动完成三个时机 */
  const turnOn = (label = "开启表示") =>
    send(buildOnValue(), label, "开启表示指令未确认，请检查设备状态").then(
      (ok) => {
        if (ok) isOn.value = true;
        return ok;
      },
    );

  /** 断开表示。用于测电阻前与定/反操前两个时机 */
  const turnOff = (label = "关闭表示") =>
    send(buildOffValue(), label, "关闭表示指令未确认，请检查设备状态").then(
      (ok) => {
        if (ok) isOn.value = false;
        return ok;
      },
    );

  /**
   * 仅按期望值下发（用于表示测试：合上表示后还要读各项状态）。
   *
   * 与 turnOn 的区别是这里不参与「读各项状态」的流程，但表示位同样是合上
   * 的，所以 isOn 也要置位——否则界面上会显示「表示OFF」而实际带电。
   */
  const applyOnValue = (label = "开启表示") =>
    send(buildOnValue(), label, "开启表示指令未确认，请检查设备状态").then(
      (ok) => {
        if (ok) isOn.value = true;
        return ok;
      },
    );

  return {
    expressIndexes,
    isOn,
    buildBase,
    buildOffValue,
    buildOnValue,
    stripExpress,
    turnOn,
    turnOff,
    applyOnValue,
  };
}