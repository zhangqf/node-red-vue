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
  handleFindCollect: (field: string) => ReturnType<typeof getCircuits>;
}

const { withLoading, showToast } = useToast();

export function useStartBeforeTest(options: useStartBeforeTestOptions) {
  const {
    flow,
    deviceType,
    channelConfigs,
    resistanceThresholds,
    handleFindCollect,
  } = options;
  const currentResistanceChannle = ref("");
  const startBeforeLoading = ref(false);
  const startBeforeTestTips = ref<{
    dcResult: any[];
    fcResult: any[];
    direction: { DC: boolean; FC: boolean; diagnosis: string[] };
  } | null>(null);
  const diagnosisMessages = ref<string[]>([]);
  const pendingSaveData = ref<Record<string, any> | null>(null);

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

  /* 启动前测试表示 */
  const handleStartBeforeTestExpress = (data: Record<string, any>) => {
    console.log("==================");
    console.log(currentResistanceChannle.value);
    console.log(data);
    if (!startBeforeLoading.value) return;
    // 组合数据
    const r = mergeResistance(data.data);
    const result = startBeforeTestExpress(
      r,
      deviceType.value,
      currentChannelConfig.value,
      currentThreshold.value,
    );
    // 解析电路图 URL
    const resolveImg = (field: string) => {
      const circuits = handleFindCollect(field);
      return circuits?.img?.[field] || "";
    };
    result.dcResult.forEach((r) => {
      r.circuitImg = resolveImg(r.circuitField);
    });
    result.fcResult.forEach((r) => {
      r.circuitImg = resolveImg(r.circuitField);
    });
    startBeforeTestTips.value = result;
  };

  /* 启动前测试 */
  const handleStartBeforeTest = async () => {
    flow.transition("START_BEFORE_TEST");
    startBeforeLoading.value = true;
    startBeforeTestTips.value = null;
    diagnosisMessages.value = [];
    pendingSaveData.value = null;

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
      const result = gen32BitArray([], [...idxArr, ...value]);
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
        // startBeforeLoading.value = false;
        flow.fail();
        return;
      }

      await sleep(2000);
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
