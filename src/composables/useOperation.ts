import { ref, type Ref } from "vue";
import { gen32BitArray, sleep } from "@/utils/utils";
import { testExpress } from "@/utils/config";
import { EXPRESS_COMMAND_FAILED_TIP } from "@/utils/announce";
import { speak } from "@/utils/speech";
import type { ActionRelays } from "@/utils/interface";
import { useToast } from "./useToast";
import type { useTestFlow } from "./useTestFlow";

interface UseOperationOptions {
  flow: ReturnType<typeof useTestFlow>;
  deviceType: Ref<string>;
  /** 各继电器的期望状态（default_status），随操作实时改动 */
  terminals: Ref<any[]>;
  /** 当前闭合方式对应的继电器分组 */
  configActionRelays: Ref<ActionRelays | null>;
  /** 初始化时快照下来的继电器期望状态 */
  initResult: Ref<any[]>;
  /** 线圈所在 unitId，与 flows.json 的 deviceType 推导一致 */
  coilUnitId: (deviceType: string) => number;
  /** 恢复全部继电器到 default_status */
  restoreInitialRelayState: () => Promise<boolean>;
  /** 合上表示：操动结束后让操作员看到动作后的位置 */
  turnExpressOn: () => Promise<boolean>;
  /** 断开表示：开启动作电源前必须先断开并确认成功 */
  turnExpressOff: () => Promise<boolean>;
  /** 往期望值里清零表示位，供操动回路复用 */
  stripExpressBits: (value: number[]) => number[];
  /** 保存本次操动记录，返回 success/error */
  saveRecord: (relay: "DC" | "FC") => Promise<string>;
  /** 清空两路曲线的历史数据 */
  resetCurves: () => void;
  /** 清空表示判定结果 */
  initTestResults: () => void;
  /** 操动结束后合表示，等采样窗口到了播报表示异常 */
  announceExpressResult: () => void;
}

/** 变频器是 ZYJ7/ZDJ9 才有的模块 */
const hasVfd = (deviceType: string) =>
  deviceType === "ZYJ7" || deviceType === "ZDJ9";

/** 兜底收尾时限：超过则无论是否归零都结束本次操动 */
const ACTION_TIMEOUT_MS = 13000;
/**
 * 电流连续为 0 多久判定动作结束。
 *
 * 后端采集周期是 1 秒，因此 2 秒意味着需要连续 3 个零样本，中间任何一个
 * 抖动都会重新计时——这正是要的：单点读数不可信，连续 3 点才认。
 */
const ZERO_HOLD_MS = 2000;
/** 强电操动前的警示倒计时 */
const WARN_COUNTDOWN = 3;
/** READY 态等待操作员的空闲超时：超时后退回启动前测试 */
const IDLE_TIMEOUT_MS = 120_000;
/** 合上表示后等采样的窗口，与 work.vue 的启动前测试表示测试一致 */
const EXPRESS_SAMPLE_WINDOW_MS = 2000;
/**
 * 上电前预充采样窗口（ms）。
 *
 * 后端交流采集通道的实测采样周期是 200ms。开启采集后等一个周期再上电，
 * 保证曲线上确实存在 0 值的前导点，起点才是 0 而不是工作电流。
 * 取 300ms 留一点余量。
 */
const SAMPLE_PRECHARGE_MS = 300;

/**
 * 操动流程：定操/反操从警示倒计时、继电器下发、采集到收尾落库的完整编排。
 *
 * 每次操动用 operationRunId 作为运行代号，所有 await 之后都比对代号，
 * 用户中途切换闭合方式或离开页面时直接放弃本次流程，避免并发写记录。
 */
export function useOperation(options: UseOperationOptions) {
  const { showToast } = useToast();
  const {
    flow,
    deviceType,
    terminals,
    configActionRelays,
    initResult,
    coilUnitId,
    restoreInitialRelayState,
    turnExpressOn,
    turnExpressOff,
    stripExpressBits,
    saveRecord,
    resetCurves,
    initTestResults,
    announceExpressResult,
  } = options;

  /* ---- 本次操动的采集与计时状态 ---- */
  /**
   * 是否处于本次操动中（动作电源已确认）。
   *
   * 归零检测与记录落库都以它为准：电源没确认就收尾属于异常，不能算
   * 一次完成的操动。
   */
  const isAction = ref(false);
  /**
   * 是否正在采集曲线。
   *
   * 与 isAction 分开：曲线要覆盖「上电爬升」这段，而 isAction 要等到
   * 动作电源指令回读确认后才置位。两者之间隔着一次 Modbus 下发+回读的
   * 往返，这段时间里物理电流已经从 0 爬到工作值，若此时才开始记录，
   * 曲线起点就不是 0，峰值也可能偏低。
   */
  const isRecording = ref(false);

  /** 本次操动是否真正开始过，用于决定失败时是否落库 */
  const operationStarted = ref(false);
  const butItemIsDisable = ref(false);
  const butItemStatus = ref("");
  const operationWarningVisible = ref(false);
  const operationCountdown = ref(WARN_COUNTDOWN);

  let actionTimerId: ReturnType<typeof setTimeout> | null = null;
  let zeroSince: number | null = null;
  let currentActionKey: "DC" | "FC" | null = null;
  let operationRunId = 0;
  /** 电流是否已连续归零达到阈值 */
  let zeroHeld = false;
  /** READY 态等待操作员的超时定时器 */
  let idleTimerId: ReturnType<typeof setTimeout> | null = null;

  /** 结束所有采集与计时（进入收尾、切闭合方式、卸载时都要走） */
  const stopRecord = () => {
    isAction.value = false;
    isRecording.value = false;
  };

  /**
   * 开始采集曲线。
   *
   * 在动作电源指令下发前调用，好让曲线覆盖上电爬升段。
   * 电源指令失败时由调用方 stopRecord() 撤销。
   */
  const startRecording = () => {
    isRecording.value = true;
  };

  /** 动作电源已确认：本次操动正式开始，可以判定归零、可以落库 */
  const startRecord = () => {
    isAction.value = true;
    operationStarted.value = true;
  };

  /**
   * 电流归零检测：连续 ZERO_HOLD_MS 判定为归零即结束动作。
   *
   * 单相/三相的「是否归零」由调用方判定（取各自通道的读数，与容差
   * CURRENT_ZERO_EPS 比较），此处只负责计时。
   */
  const checkZeroCurrent = (isZero: boolean) => {
    if (!isAction.value) return;

    if (isZero) {
      if (!zeroHeld) {
        zeroHeld = true;
        zeroSince = performance.now();
        return;
      }
      if (
        currentActionKey &&
        zeroSince !== null &&
        performance.now() - zeroSince >= ZERO_HOLD_MS
      ) {
        finishAction(currentActionKey);
      }
    } else {
      zeroHeld = false;
      zeroSince = null;
    }
  };

  /** 下发继电器并等待线圈读回确认 */
  async function sendRelayState(
    value: number[],
    label: string,
  ): Promise<boolean> {
    return flow.sendCommand(
      "relays",
      { value, deviceType: deviceType.value },
      { label, expect: { unitId: coilUnitId(deviceType.value), value } },
    );
  }

  /**
   * 按当前 terminals 的 default_status 生成 32 位期望值。
   *
   * stripExpress=true 时强制把表示位清零——部分机型的 default_status 里表示位为 1，
   * 操动回路若沿用该值会把刚断开的表示重新合上。
   */
  const buildExpectedValue = (stripExpress = false) => {
    const v = gen32BitArray(
      terminals.value.map((item) => item.default_status),
      [],
    );
    return stripExpress ? stripExpressBits(v) : v;
  };

  /**
   * 收尾并回到启动前测试：保存记录 + 复位界面 + 跳转。
   * 所有「回到 START_BEFORE_TEST」的路径都统一走这里。
   */
  const finalizeAction = async (key: "DC" | "FC") => {
    let lastStatus: string | null = null;
    if (operationStarted.value) {
      lastStatus = await saveRecord(key);
    }
    operationStarted.value = false;
    stopRecord();
    butItemIsDisable.value = false;
    butItemStatus.value = "";
    flow.transition("START_BEFORE_TEST");
    if (lastStatus === "error") {
      showToast("操动判定不合格，返回启动前测试", "error");
    }
  };

  /**
   * 动作结束：依次关闭动作电源、停变频器、延时后开启表示继电器，再落库。
   * 每步 await 后都校验 runId，用户已离开则静默中止。
   */
  const finishAction = async (key: "DC" | "FC", collectTail = false) => {
    if (actionTimerId) {
      clearTimeout(actionTimerId);
      actionTimerId = null;
    }
    zeroSince = null;
    zeroHeld = false;
    currentActionKey = null;
    const runId = operationRunId;

    try {
      const relay = configActionRelays.value?.[key];
      if (!relay?.length) {
        throw new Error("当前操动方向没有配置对应继电器");
      }

      for (const name of relay) {
        const t = terminals.value.find((item) => item.relay_name === name);
        if (t) t.default_status = 0;
      }
      const offValue = buildExpectedValue();
      offValue[31] = 0;
      const powerOffOk = await sendRelayState(offValue, "关闭动作电源");
      if (runId !== operationRunId) return;
      if (!powerOffOk) throw new Error("动作电源关闭指令未确认");

      if (hasVfd(deviceType.value)) {
        const driveStopOk = await flow.sendCommand(
          "variableFrequencyDrive",
          { value: [5], deviceType: deviceType.value },
          {
            label: "变频器停止确认",
            timeout: 8000,
            retries: 0,
            expect: {
              module: "variableFrequencyDrive",
              matches: (data) =>
                data.module === "variableFrequencyDrive" &&
                typeof data.data[3] === "number" &&
                Number.isFinite(data.data[3]) &&
                data.data[3] < 20,
            },
          },
        );
        if (runId !== operationRunId) return;
        if (!driveStopOk) throw new Error("变频器停止回读值未小于 20");
      }

      if (collectTail) await sleep(1000);
      if (runId !== operationRunId) return;
      stopRecord();

      await sleep(2000);
      if (runId !== operationRunId) return;

      // 操动结束合上表示，让操作员看到动作后的道岔位置
      const expressOk = await turnExpressOn();
      if (runId !== operationRunId) return;
      if (!expressOk) {
        // 指令未下发成功时表示没带电，读数无意义，按状态未知播报；
        // toast 仍由下面的 catch 统一出，避免只提示一半
        speak(EXPRESS_COMMAND_FAILED_TIP);
        throw new Error("开启表示继电器指令未确认");
      }

      // 等采样窗口回来再判定：操动全程表示是断开的，此时才有读数。
      // 与启动前测试、选型两处保持同一口径，异常统一由 announceExpressResult 播报。
      await sleep(EXPRESS_SAMPLE_WINDOW_MS);
      if (runId !== operationRunId) return;
      announceExpressResult();

      await finalizeAction(key);
    } catch (error) {
      // 已被更新的 runId 作废的流程，不再提示也不落库
      if (runId !== operationRunId) return;
      const message = error instanceof Error ? error.message : "未知错误";
      showToast(`动作结束流程未完成：${message}，请检查设备状态`, "error");
      await finalizeAction(key);
    }
  };

  /** 放弃本次操动：作废运行代号并解除按钮锁定 */
  const cancelPendingOperation = () => {
    operationRunId++;
    operationWarningVisible.value = false;
    butItemIsDisable.value = false;
    butItemStatus.value = "";
    flow.transition("READY");
    // 回到 READY 仍需等待操作员，重新计时
    armIdleTimer();
  };

  /** 把某个方向的继电器置为指定期望状态 */
  const batchUpdateTerminal = (nameList: string[], status: number) => {
    terminals.value
      .filter((item) => nameList.includes(item.relay_name))
      .forEach((item) => {
        item.default_status = status;
      });
  };

  /** 指令下发序列：变频器启动（可选）→ 操动继电器 → 开启动作电源 */
  const sendOperationCommands = async (
    type: "DC" | "FC",
    runId: number,
  ): Promise<boolean> => {
    const relay = configActionRelays.value?.[type];
    if (!relay?.length) {
      showToast(`${type === "DC" ? "定操" : "反操"}继电器未配置`, "error");
      return false;
    }

    batchUpdateTerminal(relay, 1);
    // 操动回路必须排除表示位，否则会把刚断开的表示重新合上
    const baseValue = buildExpectedValue(true);

    // 操动前必须先断开表示并确认成功，否则不得开启动作电源
    const expressOffOk = await turnExpressOff();
    if (runId !== operationRunId) return false;
    if (!expressOffOk) {
      showToast("表示未成功断开，已停止后续操动指令", "error");
      return false;
    }

    if (hasVfd(deviceType.value)) {
      const driveOk = await flow.sendCommand(
        "variableFrequencyDrive",
        { value: [2], deviceType: deviceType.value },
        {
          label: type === "DC" ? "变频器定操指令确认" : "变频器反操指令确认",
          timeout: 8000,
          retries: 0,
          expect: {
            module: "variableFrequencyDrive",
            matches: (data) =>
              data.module === "variableFrequencyDrive" &&
              typeof data.data[3] === "number" &&
              Number.isFinite(data.data[3]) &&
              Math.abs(data.data[3] - 380) <= 10,
          },
        },
      );
      if (runId !== operationRunId) return false;
      if (!driveOk) {
        showToast("变频器回读值未达到 380±10，已停止后续操动指令", "error");
        return false;
      }
    }

    const relaysOk = await sendRelayState(
      baseValue,
      `${type === "DC" ? "定操" : "反操"}继电器指令`,
    );
    if (runId !== operationRunId) return false;
    if (!relaysOk) {
      showToast("操动继电器指令未确认，已停止后续操动指令", "error");
      return false;
    }

    const finalValue = [...baseValue];
    finalValue[31] = 1;
    // 先开采集再上电，曲线才能覆盖上电爬升段。
    //
    // 光是「提前开采集」还不够：采样周期是 200ms，若电源指令恰好落在采样
    // 周期的后半段，下一个采样点到达时物理电流已经起来，曲线起点仍不是 0
    // （现场记录里同一个操作有 3 条起点是 0、3 条起点直接是工作值）。
    // 所以开采集后先等一个采样周期，让 0 点确实被采到再上电。
    startRecording();
    await sleep(SAMPLE_PRECHARGE_MS);
    if (runId !== operationRunId) {
      stopRecord();
      return false;
    }
    const finalRelayOk = await sendRelayState(finalValue, "开启动作电源");
    if (runId !== operationRunId) {
      stopRecord();
      return false;
    }
    if (!finalRelayOk) {
      // 电源没合上，采到的数据不代表一次操动，撤销采集
      stopRecord();
      showToast("开启电源指令未确认，请检查设备状态", "error");
      return false;
    }
    // 动作电源确认成功，才认为本次操动真正开始
    startRecord();
    return true;
  };

  /**
   * 按下定操/反操：先警示周围人员倒计时，再执行继电器序列。
   */
  const handleOpe = async (type: string) => {
    if (type !== "DC" && type !== "FC") return;
    if (flow.currentStep.value !== "READY") return;
    if (!configActionRelays.value) {
      showToast("请先选择闭合方式", "error");
      return;
    }
    if (butItemIsDisable.value) return;

    // 操作员已开始操作，取消空闲超时
    clearIdleTimer();

    const runId = ++operationRunId;
    resetCurves();
    operationStarted.value = false;
    initTestResults();
    butItemStatus.value = type;
    butItemIsDisable.value = true;
    flow.transition("OPERATING");
    operationCountdown.value = WARN_COUNTDOWN;
    operationWarningVisible.value = true;

    for (let remaining = WARN_COUNTDOWN; remaining > 0; remaining--) {
      await sleep(1000);
      if (runId !== operationRunId) return;
      operationCountdown.value = remaining - 1;
    }
    operationWarningVisible.value = false;

    try {
      const commandsOk = await sendOperationCommands(type, runId);
      if (runId !== operationRunId) return;
      if (!commandsOk) {
        batchUpdateTerminal(configActionRelays.value[type], 0);
        await restoreInitialRelayState();
        await finalizeAction(type);
        return;
      }
      zeroSince = null;
      zeroHeld = false;
      currentActionKey = type;
      actionTimerId = setTimeout(() => {
        finishAction(type, true);
      }, ACTION_TIMEOUT_MS);
    } catch (error) {
      if (runId !== operationRunId) return;
      console.error("操动继电器序列执行失败:", error);
      showToast("操动指令执行异常，已停止后续操作", "error");
      batchUpdateTerminal(configActionRelays.value[type], 0);
      await restoreInitialRelayState();
      await finalizeAction(type);
    }
  };

  /* ============================================================
   * READY 态空闲超时
   *
   * 启动前测试通过后进入 READY，等待操作员点定操/反操。若长时间无人操作，
   * 退回启动前测试重新开始，避免停留在上一次的判定结果上继续操作。
   *
   * 超时只改流程状态，不动继电器——操作员重新点启动前测试时，
   * 那里会先关表示再测电阻。
   * ========================================================== */

  /** 空闲超时后弹出的提示框 */
  const idleTimeoutVisible = ref(false);

  const clearIdleTimer = () => {
    if (idleTimerId) clearTimeout(idleTimerId);
    idleTimerId = null;
  };

  const armIdleTimer = () => {
    clearIdleTimer();
    idleTimerId = setTimeout(() => {
      idleTimerId = null;
      // 期间可能已进入操动或离开页面，此时不再回退
      if (flow.currentStep.value !== "READY") return;
      flow.transition("START_BEFORE_TEST");
      idleTimeoutVisible.value = true;
    }, IDLE_TIMEOUT_MS);
  };

  /** 操作员点【知道了】关闭提示 */
  const closeIdleTimeoutDialog = () => {
    idleTimeoutVisible.value = false;
  };

  /** 组件卸载：作废运行代号并停掉所有定时器 */
  const dispose = () => {
    operationRunId++;
    if (actionTimerId) clearTimeout(actionTimerId);
    actionTimerId = null;
    clearIdleTimer();
  };

  return {
    // 状态
    isAction,
    /** 曲线采集开关，与 isAction 解耦：采集早于电源确认 */
    isRecording,
    butItemIsDisable,
    butItemStatus,
    operationWarningVisible,
    operationCountdown,
    idleTimeoutVisible,
    // 动作
    checkZeroCurrent,
    handleOpe,
    cancelPendingOperation,
    stopRecord,
    batchUpdateTerminal,
    // 空闲超时
    armIdleTimer,
    clearIdleTimer,
    closeIdleTimeoutDialog,
    // 生命周期
    dispose,
  };
}