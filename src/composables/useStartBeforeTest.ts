import { computed, ref, type Ref } from "vue";
import type { useTestFlow } from "./useTestFlow";
import {
  DEFAULT_THRESHOLD,
  StartBeforeTestConfig,
  startBeforeTestConfigTypeSetup,
  Step,
  type ChannelExpect,
  type ResistanceThreshold,
} from "@/utils/config";
import {
  gen32BitArray,
  getCircuits,
  mergeResistance,
  sleep,
  startBeforeTestExpress,
} from "@/utils/utils";
import { coilUnitId } from "./useButton";
import { useToast } from "./useToast";

type TestFlow = ReturnType<typeof useTestFlow>;

interface useStartBeforeTestOptions {
  deviceType: Ref<string>;
  flow: TestFlow;
  channelConfigs: Ref<any[]>;
  resistanceThresholds: Ref<any[]>;
  availableDirections: Ref<{ DC: boolean; FC: boolean }>;
  selectedContactType: Ref<string>;
  restoreInitialRelayState: () => Promise<boolean>;
  runExpressTest: () => Promise<{
    DC: boolean;
    FC: boolean;
    diagnosis: string[];
  }>;
  /** 测电阻前断开表示：表示回路带电会把电阻采样拉偏，必须先关 */
  turnExpressOff: () => Promise<boolean>;
  /** 测试通过、进入 READY 后的回调，用于启动空闲超时 */
  onPass?: () => void;
  handleFindCollect: (field: string) => ReturnType<typeof getCircuits>;
}

const { withLoading, showToast } = useToast();

interface ResistanceSnapshot {
  values: number[];
  receivedAt: number;
}

export function useStartBeforeTest(options: useStartBeforeTestOptions) {
  const {
    flow,
    deviceType,
    channelConfigs,
    resistanceThresholds,
    availableDirections,
    restoreInitialRelayState,
    runExpressTest,
    turnExpressOff,
    onPass,
    handleFindCollect,
  } = options;
  const currentResistanceChannle = ref("");
  const startBeforeLoading = ref(false);
  const startBeforeTestTips = ref<{
    dcResult: any[];
    fcResult: any[];
    /** complete 为 false 表示测试仍在进行中，DC/FC 结果尚未定论 */
    direction: {
      DC: boolean;
      FC: boolean;
      diagnosis: string[];
      complete?: boolean;
    };
  } | null>(null);
  const diagnosisMessages = ref<string[]>([]);
  const pendingSaveData = ref<Record<string, any> | null>(null);
  const latestResistance = ref<ResistanceSnapshot | null>(null);
  const latestResistanceAt = ref<number | null>(null);
  const resistanceSnapshots = ref<Record<string, ResistanceSnapshot>>({});
  const collectingResistance = ref(false);
  let testRunId = 0;

  const currentChannelConfig = computed<ChannelExpect[] | undefined>(() => {
    return channelConfigs.value.find((c) => c.device_type === deviceType.value)
      ?.config;
  });

  const currentThreshold = computed<ResistanceThreshold>(() => {
    const t = resistanceThresholds.value.find(
      (c) => c.device_type === deviceType.value,
    );
    return t
      ? {
          normalMin: t.normal_min,
          normalMax: t.normal_max,
          openMin: t.open_min,
          shortMax: t.short_max,
        }
      : DEFAULT_THRESHOLD;
  });

  const getStepMapping = () => {
    if (deviceType.value === "ZD6" || deviceType.value === "ZD9") {
      return [
        { stepKey: "1", sourceIndex: 6 },
        { stepKey: "2", sourceIndex: 7 },
      ];
    }
    return [
      { stepKey: "3", sourceIndex: 2 },
      { stepKey: "4", sourceIndex: 3 },
      { stepKey: "5", sourceIndex: 4 },
      { stepKey: "6", sourceIndex: 5 },
    ];
  };

  const resolveCircuitImages = (
    result: ReturnType<typeof startBeforeTestExpress>,
  ) => {
    const resolveImg = (field: string) => {
      const circuits = handleFindCollect(field);
      return circuits?.img?.[field] || "";
    };
    result.dcResult.forEach((item) => {
      item.circuitImg = resolveImg(item.circuitField);
    });
    result.fcResult.forEach((item) => {
      item.circuitImg = resolveImg(item.circuitField);
    });
    return result;
  };

  const buildDisplayedResult = () => {
    const mapping = getStepMapping();
    const rawValues: number[] = [];
    const completedIndexes = new Set<number>();

    mapping.forEach(({ stepKey, sourceIndex }, index) => {
      const snapshot = resistanceSnapshots.value[stepKey];
      if (snapshot) {
        rawValues[sourceIndex] = snapshot.values[sourceIndex] ?? 0;
        completedIndexes.add(index);
      }
    });

    const result = resolveCircuitImages(
      startBeforeTestExpress(
        rawValues,
        deviceType.value,
        currentChannelConfig.value,
        currentThreshold.value,
      ),
    );
    const isComplete = completedIndexes.size === mapping.length;

    result.dcResult.forEach((item, index) => {
      item.completed = completedIndexes.has(index);
      if (!item.completed) {
        item.value = 0;
        item.tip = "等待测试";
        item.isNormal = false;
      }
    });
    result.fcResult.forEach((item, index) => {
      item.completed = completedIndexes.has(index);
      if (!item.completed) {
        item.value = 0;
        item.tip = "等待测试";
        item.isNormal = false;
      }
    });

    if (!isComplete) {
      result.direction = {
        DC: false,
        FC: false,
        diagnosis: [],
        complete: false,
      };
    } else {
      result.direction.complete = true;
    }
    return result;
  };

  const captureCurrentStep = (stepKey: string, runId: number) => {
    if (runId !== testRunId || !latestResistance.value) return false;
    resistanceSnapshots.value[stepKey] = {
      values: [...latestResistance.value.values],
      receivedAt: latestResistance.value.receivedAt,
    };
    startBeforeTestTips.value = buildDisplayedResult();
    return true;
  };

  /* 启动前测试表示：只缓存当前步骤最近一帧，不直接更新界面结果 */
  const handleStartBeforeTestExpress = (data: Record<string, any>) => {
    if (!startBeforeLoading.value || !collectingResistance.value) return;
    const values = mergeResistance(data.data);
    if (!values.length) return;
    const receivedAt = Date.now();
    latestResistance.value = {
      values,
      receivedAt,
    };
    latestResistanceAt.value = receivedAt;
  };

  /* 启动前测试 */
  const handleStartBeforeTest = async (initResult: number[]) => {
    if (startBeforeLoading.value) return;
    const runId = ++testRunId;
    flow.transition("START_BEFORE_TEST");
    startBeforeLoading.value = true;
    startBeforeTestTips.value = null;
    diagnosisMessages.value = [];
    pendingSaveData.value = null;
    latestResistance.value = null;
    latestResistanceAt.value = null;
    resistanceSnapshots.value = {};
    collectingResistance.value = false;
    availableDirections.value = { DC: false, FC: false };
    startBeforeTestTips.value = buildDisplayedResult();

    const restoreRelays = async () => {
      const restored = await restoreInitialRelayState();
      if (!restored) {
        showToast(
          "启动前测试结束，但继电器恢复初始化状态失败，请重试",
          "error",
        );
      }
      return restored;
    };

    // 先断开表示再测电阻：表示回路带电会干扰电阻采样
    if (!(await turnExpressOff())) {
      startBeforeLoading.value = false;
      flow.fail();
      return;
    }
    if (runId !== testRunId) return;

    // availableDirections.value = { DC: false, FC: false };
    const idxArr =
      StartBeforeTestConfig[
        deviceType.value as keyof typeof StartBeforeTestConfig
      ];
    const resistanceValue =
      Step[
        startBeforeTestConfigTypeSetup[
          deviceType.value as keyof typeof StartBeforeTestConfig
        ] as keyof typeof Step
      ];

    console.log("resistance", resistanceValue);

    for (const [key, value] of Object.entries(resistanceValue)) {
      const result = gen32BitArray(initResult, [...idxArr, ...value]);
      currentResistanceChannle.value = key;
      const ok = await flow.sendCommand(
        "startBeforeTestRelays",
        {
          value: result,
          deviceType: deviceType.value,
        },
        // 读回比对：继电器线圈真正回显到 result 才算指令已执行
        {
          label: "启动前测试",
          expect: { unitId: coilUnitId(deviceType.value), value: result },
        },
      );

      if (!ok) {
        showToast("启动前测试指令未确认，请重试", "error");
        await restoreRelays();
        startBeforeLoading.value = false;
        flow.fail();
        return;
      }

      latestResistance.value = null;
      latestResistanceAt.value = null;
      collectingResistance.value = true;
      const ackAt = Date.now();
      await sleep(2000);
      collectingResistance.value = false;

      if (runId !== testRunId || !startBeforeLoading.value) return;
      const capturedAt = latestResistanceAt.value;
      if (
        capturedAt === undefined ||
        capturedAt === null ||
        capturedAt < ackAt ||
        !captureCurrentStep(key, runId)
      ) {
        showToast(`启动前测试第${key}组未收到有效电阻数据，请重试`, "error");
        await restoreRelays();
        startBeforeLoading.value = false;
        flow.fail();
        return;
      }
    }

    if (runId !== testRunId || !startBeforeLoading.value) return;
    const result = buildDisplayedResult();
    startBeforeTestTips.value = result;
    collectingResistance.value = false;
    if (!(await restoreRelays())) {
      startBeforeLoading.value = false;
      flow.fail();
      return;
    }
    const expressResult = await runExpressTest();
    if (runId !== testRunId || !startBeforeLoading.value) return;
    if (!(await restoreRelays())) {
      startBeforeLoading.value = false;
      flow.fail();
      return;
    }
    diagnosisMessages.value = result.direction.diagnosis;
    diagnosisMessages.value.push(...expressResult.diagnosis);
    const expressPassed = expressResult.DC || expressResult.FC;
    const finalDirections = expressPassed
      ? {
          DC: result.direction.DC && expressResult.DC,
          FC: result.direction.FC && expressResult.FC,
        }
      : {
          DC: result.direction.DC,
          FC: result.direction.FC,
        };
    availableDirections.value = {
      DC: finalDirections.DC,
      FC: finalDirections.FC,
    };
    result.direction = {
      ...result.direction,
      DC: finalDirections.DC,
      FC: finalDirections.FC,
      diagnosis: diagnosisMessages.value,
      complete: true,
    };
    startBeforeLoading.value = false;

    if (availableDirections.value.DC || availableDirections.value.FC) {
      flow.pass();
      // 进入 READY 后等待操作员点击，启动空闲超时
      onPass?.();
    } else {
      flow.fail();
    }
  };

  return {
    startBeforeLoading,
    startBeforeTestTips,
    diagnosisMessages,
    pendingSaveData,
    currentResistanceChannle,
    handleStartBeforeTest,
    handleStartBeforeTestExpress,
  };
}
