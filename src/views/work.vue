<script setup lang="ts">
import { computed, onMounted, ref, toRaw, toRef, watch } from "vue";
import { useSocket } from "@/composables/useSocket";
import DeviceBar from "@/components/DeviceBar.vue";
import CurrentCurve from "@/components/CurrentCurve.vue";
import PowerCurve from "@/components/PowerCurve.vue";
import TestResults from "@/components/TestResults.vue";

import { HTTP_URL, WEBSOCKET_URL } from "@/config/config";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import {
  gen32BitArray,
  handleCalculate,
  parseWsData,
  findRelayIndex,
  startBeforeTestExpress,
  powerStatusJudgmen,
  getCircuits,
  mergeResistance,
} from "@/utils/utils";
import type {
  WSSTATUS,
  ActionRelays,
  TestItem,
  RelayTip,
} from "@/utils/interface";
import {
  relayConfigList,
  StartPowerConfig,
  StartBeforeTestConfig,
  contact24Closed,
  contact13Closed,
  DEFAULT_THRESHOLD,
  DEFAULT_CURVE_THRESHOLD,
} from "@/utils/config";
import type {
  ChannelExpect,
  ResistanceThreshold,
  CurveThreshold,
} from "@/utils/config";

import { speak } from "@/utils/speech";

const route = useRoute();
const router = useRouter();
const { withLoading, showToast } = useToast();

const ws = useSocket(WEBSOCKET_URL);
ws.connect();

// 原始websocket消息
const rawWsMsg = ref<string | null>(null);
// 分别缓存线圈、寄存器最新有效值
const lastCoilArr = ref<number[]>([]);
const lastRegisterArr = ref<number[]>([]);
const configActionRelays = ref<ActionRelays | null>(null);

// 锁定状态缓存
const lockStatus = ref<Record<string, boolean>>({
  GreenLight: false,
  YellowLight: false,
  SecondaryTransmissionInReversePosition: false,
  SecondaryTransmissionPositioning: false,
  PrimaryTransmissionInReversePosition: false,
  PrimaryTransmissionPositioning: false,
});

const modbusStatus = ref();
const temperature = ref(0);
const phaseACurrent = ref(0);
const phaseBCurrent = ref(0);
const phaseCCurrent = ref(0);
const phasePower = ref(0);

const testResults = ref<TestItem[]>([]);

const startBeforeLoading = ref(false);

let tempDate: number[][] = [];

// 寄存器计算属性：永远返回缓存的最新寄存器数据，不会清空
const registerArr = computed(() => lastRegisterArr.value);

// 三相电流寄存器数组（用 ref 而非 computed，确保每次赋值新数组引用，watch 才能检测到变化）
const registerArrA = ref<number[]>([]);
const registerArrB = ref<number[]>([]);
const registerArrC = ref<number[]>([]);

// 功率数组
const powerArr = ref<number[]>([]);

const device = ref({
  name: "",
});
const combinationName = ref("");
const configName = ref("");

const showContactDialog = ref(
  route.query.opeModel !== "code" && route.query.universal !== "true",
);
const showWireDialog = ref(route.query.universal === "true");
const selectedContactType = ref("");

const currentData = ref({
  currentValue: 3.8,
  startCurrent: 1.0,
  convertCurrent: 0,
  lockCurrent: 0,
});

const powerData = ref({
  powerKw: 4.19,
  powerValue: 3.14,
  startPower: "09",
  convertPower: "000",
  lockPower: "0",
});
const butItemStatus = ref("");

const itemConfig = ref<any[]>([]);

export type RelayKey = string;

const terminals = ref<any[]>([]);

const wsSendData = ref<number[] | null>(null);

const active = ref<string>("");

const deviceId = route.params.deviceId as string;
const combinationId = ref(route.params.combinationId as string);
const configId = ref(route.params.configId as string);

const opeModel = route.query.opeModel as string;
const codeName = route.query.name as string;
const isUniversalMode = route.query.universal === "true";
const routeCloseType = route.query.closeType as string;
const indicationRelay = ref<any[]>([]);

const startBeforeTestFinshed = ref(false);
const availableDirections = ref<{ DC: boolean; FC: boolean }>({
  DC: false,
  FC: false,
});
const diagnosisMessages = ref<string[]>([]);
const completedDirections = ref<Set<string>>(new Set());
const pendingSaveData = ref<Record<string, any> | null>(null);

const typeToFieldMap: Record<string, keyof ActionRelays> = {};
relayConfigList.forEach((item) => {
  typeToFieldMap[item.type] = item.field;
});

// 定操/反操相关表示项分组（定位表示/反位表示始终显示）
const DC_GROUP_TYPES = new Set([
  "SecondaryTransmissionPositioning",
  "PrimaryTransmissionPositioning",
  "DCBX",
  "DCCX",
]);
const FC_GROUP_TYPES = new Set([
  "SecondaryTransmissionInReversePosition",
  "PrimaryTransmissionInReversePosition",
  "FCBX",
  "FCCX",
]);

// 记录判定范围：反操(FC)检查定位表示+定操项，定操(DC)检查反位表示+反操项
const FC_RECORD_TYPES = new Set<string>(["GreenLight", ...DC_GROUP_TYPES]);
const DC_RECORD_TYPES = new Set<string>(["YellowLight", ...FC_GROUP_TYPES]);

// 定位表示 / 反位表示 实时状态
const positioningTrue = computed(() => {
  const item = testResults.value.find((t) => t.type === "GreenLight");
  return item?.status === true;
});
const reverseTrue = computed(() => {
  const item = testResults.value.find((t) => t.type === "YellowLight");
  return item?.status === true;
});

// 定位/反位表示灯的显示：定位成功优先，只显示定位；反位仅在定位失败时显示
const showPositioning = computed(() => positioningTrue.value);
const showReverse = computed(
  () => !positioningTrue.value && reverseTrue.value,
);

// 定操/反操视角始终显示，不再依赖定位/反位表示
const showDCGroup = computed(() => true);
const showFCGroup = computed(() => true);

// 诊断提示按当前视角过滤：定操视角只显示定操项，反操视角只显示反操项，混线等通用提示始终显示
const displayDiagnosisMessages = computed(() => {
  return diagnosisMessages.value.filter((msg) => {
    if (msg.startsWith("定操-")) return showDCGroup.value;
    if (msg.startsWith("反操-")) return showFCGroup.value;
    return true;
  });
});

// 按定位/反位状态过滤后的表示项
const displayedTestResults = computed(() => {
  return testResults.value.filter((item) => {
    if (item.type === "GreenLight") return showPositioning.value;
    if (item.type === "YellowLight") return showReverse.value;
    if (DC_GROUP_TYPES.has(item.type)) return positioningTrue.value;
    if (FC_GROUP_TYPES.has(item.type)) return reverseTrue.value;
    return true;
  });
});

// 重置锁定
const resetAllLock = () => {
  testResults.value = [];
  Object.keys(lockStatus.value).forEach((key) => {
    lockStatus.value[key] = false;
  });
};

const handleFindCollect = (field: string) => {
  const cfg = configName.value.replace(/(【.+?】)$/, "");
  return getCircuits(
    selectedContactType.value,
    deviceType.value,
    combinationName.value,
    cfg,
    field,
  );
};

/* 表示数据处理 */
const handleWsRelayData = (data: number[]) => {
  const relayData = configActionRelays.value;
  if (!relayData) return;

  const sampleData = indicationRelay.value;
  if (!Array.isArray(sampleData) || sampleData.length < 1) return;

  const realData = data.map((item) => (item ? 1 : 0));

  // 在已有的 testResults 基础上更新状态
  testResults.value = testResults.value.map((item) => {
    if (item.type === "empty") return item;

    const field = typeToFieldMap[item.type];
    if (!field) return item;
    const targetArr = relayData[field];
    if (targetArr.length < 1) return item;
    const resCollect = handleFindCollect(field);
    const res = findRelayIndex(targetArr, realData, sampleData);
    const relayTips: RelayTip[] = [];

    if (item.relayName.length > 0) {
      item.relayName.forEach((v) => {
        const closed = res.relayStates[v] === true;
        if (deviceType.value === "ZYJ7") {
          const cfg = configName.value.replace(/(【.+?】)$/, "");
          switch (cfg) {
            case "SH6":
              if (item.type === "DCBX") {
                return relayTips.push({ name: v, path: "D7→43-44→D3", closed });
              }
              if (item.type === "DCCX") {
                return relayTips.push({
                  name: v,
                  path: "D8→23→13-14→44→D3",
                  closed,
                });
              }
              relayTips.push({ name: v, path: resCollect[v], closed });
              break;
            default:
              relayTips.push({ name: v, path: resCollect[v], closed });
          }
        } else {
          relayTips.push({ name: v, path: resCollect?.[v] || "", closed });
        }
      });
    }
    const img = resCollect?.img?.[field] || "";
    return {
      ...item,
      relayTips,
      img,
      status: res.allClosed,
      realCheck: res.allClosed,
    };
  });
};

/* 电源状态 */
const powerStatus = ref({
  isRunning: false,
  desc: "",
});

/* 动作继电器 */
const handleActionRelays = (data: Record<string, any>) => {
  const rawCoil = Array.isArray(data.data) ? data.data : [];
  const coilArr = rawCoil.map((item: number) => (item ? 1 : 0));
  let idxArr =
    StartPowerConfig[deviceType.value as keyof typeof StartPowerConfig];
  //  console.log(idxArr)

  // 模拟继电器状态
  // const tempArr = new Array(32).fill(0)
  // tempArr[31] = 1
  // tempArr[30] = 1
  powerStatus.value = powerStatusJudgmen(coilArr, idxArr);

  lastCoilArr.value = coilArr.slice(0, terminals.value.length);
};

const startBeforeTestTips = ref<{
  dcResult: any[];
  fcResult: any[];
  direction: { DC: boolean; FC: boolean; diagnosis: string[] };
} | null>(null);

/* 表示继电器 */
const handleExpressRelays = (data: Record<string, any>) => {
  //  if (isAction.value) {
  return handleWsRelayData(data.data);
  // }
};

/* 采集直流曲线 */
const handleCollectDCCurve = (data: Record<string, any>) => {
  const rawReg: number[] = Array.isArray(data.data) ? data.data : [];
  tempDate.unshift(rawReg);

  // 限制最大20条，超出截断
  if (tempDate.length > 5) {
    tempDate = tempDate.slice(0, 5);
  }
  if (isAction.value) {
    tempDate.forEach((element) => {
      lastRegisterArr.value = element;
    });
    checkZeroCurrent();
  }
};

/*
  启动前测试表示
  */
const handleStartBeforeTestExpress = (data: Record<string, any>) => {
  if (!startBeforeLoading.value) return;
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

  // 放行判断：完全由电阻判定结果决定，与定位/反位表示无关，
  // 定操(DC)或反操(FC)任一方向电阻判定通过即可进入下一步
  const dcAvailable = result.direction.DC;
  const fcAvailable = result.direction.FC;
  const proceed = dcAvailable || fcAvailable;

  if (proceed) {
    startBeforeLoading.value = false;
    startBeforeTestFinshed.value = true;
    availableDirections.value = { DC: dcAvailable, FC: fcAvailable };
    diagnosisMessages.value = result.direction.diagnosis;
    completedDirections.value = new Set();
    initTestResults();
  } else {
    // 未通过：保持 startBeforeLoading=true，继续接收实时电阻数据反复判断
    startBeforeTestFinshed.value = false;
    availableDirections.value = { DC: false, FC: false };
    diagnosisMessages.value = result.direction.diagnosis;
  }
};

const funWsRealData = (data: Record<string, string | number>) => {
  let unitId = data.unitId;
  switch (unitId) {
    // case 1:
    // case 2:
    //   handleActionRelays(data);
    //   break;
    case 1:
      if (deviceType.value === "ZYJ7" || deviceType.value === "ZDJ9") return;
      handleActionRelays(data);
      break;
    case 2:
      if (deviceType.value === "ZD6" || deviceType.value === "ZD9") return;
      handleActionRelays(data);
      break;
    case 3:
      // 表示
      handleExpressRelays(data);
      break;
    case 4:
      // 采集220曲线
      handleCollectDCCurve(data);
      break;
    case 6:
      handleStartBeforeTestExpress(data);
      break;
    default:
      console.warn("未知 unitId:", unitId);
  }
};

const speakDelayTime = ref(0);

const funWsStatus = (data: Record<string, string>) => {
  if (!data.connected) {
    lastCoilArr.value = [];
    isThreePhase.value = false;
  }
  if (!data.connected && speakDelayTime.value <= 0) {
    speak("通讯异常，请检查通讯连接或设备状态");
  }
  speakDelayTime.value++;
  if (speakDelayTime.value >= 7) {
    speakDelayTime.value = 0;
  }
  modbusStatus.value = data;
};

/* 三相采集模块初级处理 */
const funThreePhaseACCollector = (data: number[] | undefined) => {
  if (!data) return;
  if (deviceType.value !== "ZYJ7" && deviceType.value !== "ZDJ9") return;
  isThreePhase.value = true;
  temperature.value = handleCalculate(data[4] ?? 0, 100);
  phaseACurrent.value = handleCalculate(data[8] ?? 0, 1000);
  phaseBCurrent.value = handleCalculate(data[9] ?? 0, 1000);
  phaseCCurrent.value = handleCalculate(data[10] ?? 0, 1000);
  phasePower.value = handleCalculate(data[15] ?? 0, 10000);

  if (isAction.value) {
    registerArrA.value = [phaseACurrent.value];
    registerArrB.value = [phaseBCurrent.value];
    registerArrC.value = [phaseCCurrent.value];
    powerArr.value = [phasePower.value];
    checkZeroCurrent();
  }
};

// 监听ws消息，自动更新对应缓存，另一个数组保留旧值
watch(
  () => ws.message.value,
  (newMsg) => {
    rawWsMsg.value = newMsg;
    const data = parseWsData(newMsg);
    if (!data) return;
    if (data && data.sendData) {
      switch (data.sendData.type) {
        case "modbusStatus":
          funWsStatus(data.sendData);
          break;
        case "modbusRealData":
          funWsRealData(data.sendData);
          break;
        case "ThreePhaseACCollector":
          funThreePhaseACCollector(data.sendData.value);
          break;
      }
    }
  },
  { immediate: true },
);

// 线圈计算属性：永远返回缓存的最新线圈数据，不会清空
const coilArr = computed(() => lastCoilArr.value);

// 状态栏描述：跟随启动前测试流程
const statusDesc = computed(() => {
  if (!startBeforeTestFinshed.value) return "请先进行启动前测试";
  return powerStatus.value?.desc || "";
});

const totalPower = computed(() => phasePower.value);

const handleContactDialogSelect = (type: string) => {
  selectedContactType.value = type;
  handleContactConfigClick(type);
  showContactDialog.value = false;
};
const handleBack = () => {
  const result = terminals.value.map(() => 0);
  wsSendData.value = gen32BitArray(result, []);
  sendCmd(wsSendData.value, "relays", deviceType.value);
  router.back();
};

async function getConfig(itemType: string) {
  try {
    const response = await fetch(HTTP_URL + "/getConfigRelays/" + itemType, {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    const { indicationRelays, relays } = await response.json();
    terminals.value = relays;
    indicationRelay.value = indicationRelays;

    // WS 连上后先发端子默认状态（不带电源），电源等用户点击"开启动作电源"时再发
    const initResult = terminals.value.map((item) => item.default_status);
    wsSendData.value = gen32BitArray(initResult, []);
    sendCmd(wsSendData.value, "relays", deviceType.value);
  } catch (e) {
    console.error("加载配置失败:", e);
    terminals.value = [];
  }
}

watch(active, (newkey) => {
  if (!newkey) return;
  getConfig(newkey);
});

watch(
  () => powerStatus.value.isRunning,
  (newKey) => {
    if (newKey) {
      initTestResults();
    } else {
      startBeforeLoading.value = false;
      startBeforeTestFinshed.value = false;
      availableDirections.value = { DC: false, FC: false };
      diagnosisMessages.value = [];
      startBeforeTestTips.value = null;
    }
  },
);

/* 回到启动前测试初始状态 */
const resetToStartBeforeTest = () => {
  // 停止记录与定时器
  stopRecord();
  if (actionTimerId) {
    clearTimeout(actionTimerId);
    actionTimerId = null;
  }
  if (finalizeTimerId) {
    clearTimeout(finalizeTimerId);
    finalizeTimerId = null;
  }
  zeroSince = null;
  currentActionKey = null;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  nextDoTime.value = 15;
  butItemIsDisable.value = false;
  butItemStatus.value = "";

  // 复位启动前测试相关状态
  startBeforeLoading.value = false;
  startBeforeTestFinshed.value = false;
  availableDirections.value = { DC: false, FC: false };
  diagnosisMessages.value = [];
  startBeforeTestTips.value = null;
  completedDirections.value = new Set();
  pendingSaveData.value = null;

  // 清空曲线，重置锁定状态并重建测试项
  currentCurveRef.value?.resetData();
  powerCurveRef.value?.resetData();
  resetAllLock();
  initTestResults();
};

/* 开启动作电源 / 紧急停止 */
const handleStart = () => {
  if (powerStatus.value?.isRunning) {
    // 紧急停止：全关，不包含电源位
    const result = terminals.value.map(() => 0);
    wsSendData.value = gen32BitArray(result, []);
    sendCmd(wsSendData.value, "relays", deviceType.value);

    // 回到启动前测试初始状态
    resetToStartBeforeTest();
  } else {
    handleDo();
  }
};

/* 启动前测试 */
const handleStartBeforeTest = () => {
  // availableDirections.value = { DC: false, FC: false };
  // startBeforeTestTips.value = null
  // testResults.value = []
  startBeforeLoading.value = true;
  startBeforeTestTips.value = null;
  diagnosisMessages.value = [];
  pendingSaveData.value = null;

  availableDirections.value = { DC: false, FC: false };
  const idxArr =
    StartBeforeTestConfig[
      deviceType.value as keyof typeof StartBeforeTestConfig
    ];
  const powerArr =
    StartPowerConfig[deviceType.value as keyof typeof StartPowerConfig];

  const result = gen32BitArray([], [...idxArr]);

  sendCmd(result, "startBeforeTestRelays", deviceType.value);
};

// 单个更新
const findNode = (relay_name: string, default_status: number) => {
  const targetTerminal = terminals.value.find(
    (item) => item.relay_name === relay_name,
  );
  if (targetTerminal) {
    targetTerminal.default_status = default_status;
  }
};

/* 批量更新 */
const batchUpdateTerminal = (nameList: string[], status: number) => {
  terminals.value
    .filter((item) => nameList.includes(item.relay_name))
    .forEach((item) => {
      item.default_status = status;
    });
};

// 根据 configActionRelays 生成初始结果列表（不依赖 WS 数据）
function initTestResults(direction?: "DC" | "FC") {
  const relayData = configActionRelays.value;
  if (!relayData) {
    testResults.value = [];
    return;
  }

  testResults.value = relayConfigList
    .filter((item) => relayData[item.field] && relayData[item.field].length > 0)
    .map((item) => {
      let field = typeToFieldMap[item.type];
      // console.log("闭合方式", selectedContactType.value, field);
      // if (selectedContactType.value === "contact24Closed") {
      //   if (field === "DWBS" || field === "FWBS") {
      //     field = field === "DWBS" ? "FWBS" : "DWBS";
      //   }
      // }
      console.log(field);
      const resCollect = field ? handleFindCollect(field) : undefined;
      console.log(resCollect?.img?.[field]);
      return {
        type: item.type,
        name: item.name,
        status: "NT" as const,
        realCheck: false,
        relayName: relayData[item.field],
        img: resCollect?.img?.[field] || "",
      };
    });

  if (testResults.value.length === 0) {
    testResults.value = [
      {
        type: "empty",
        name: "无所需的表示项",
        status: "NT",
        realCheck: false,
        relayName: [],
      },
    ];
  }
}

/* 
  闭合方式配置
*/
const handleContact13Closed = () => {
  configActionRelays.value = contact13Closed.value;
  initTestResults();
};

const handleContact24Closed = () => {
  configActionRelays.value = contact24Closed.value;
  initTestResults();
};

const persistCloseType = async (type: string) => {
  if (opeModel !== "code") return;
  try {
    await fetch(HTTP_URL + "/updateCodeDeviceCloseType", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deviceId, closeType: type }),
    });
  } catch (e) {
    console.error("保存闭合方式失败:", e);
  }
};

const handleContactConfigClick = (type: string) => {
  resetAllLock();
  selectedContactType.value = type;
  // 切换闭合方式后，原启动前测试结果失效，需重新测试
  startBeforeLoading.value = false;
  startBeforeTestFinshed.value = false;
  availableDirections.value = { DC: false, FC: false };
  diagnosisMessages.value = [];
  startBeforeTestTips.value = null;
  completedDirections.value = new Set();
  pendingSaveData.value = null;
  switch (type) {
    case "contact13Closed":
      handleContact13Closed();
      break;
    case "contact24Closed":
      handleContact24Closed();
      break;
  }
  persistCloseType(type);
};

const isAction = ref(false);
const isThreePhase = ref(false);

/* 开始记录 */
const startRecord = () => {
  isAction.value = true;
};

/* 停止记录 */
const stopRecord = () => {
  isAction.value = false;
};

const currentCurveRef = ref<InstanceType<typeof CurrentCurve>>();
const powerCurveRef = ref<InstanceType<typeof PowerCurve>>();

/* 动作定时器与电流归零计时 */
let actionTimerId: ReturnType<typeof setTimeout> | null = null;
let zeroSince: number | null = null;
let currentActionKey: keyof ActionRelays | null = null;
let finalizeTimerId: number | null = null;

/* 结束本次动作：立即关闭继电器；超时结束时继续采集 1s 电流尾段后再停止记录并保存 */
const finishAction = (key: keyof ActionRelays, collectTail = false) => {
  if (actionTimerId) {
    clearTimeout(actionTimerId);
    actionTimerId = null;
  }
  zeroSince = null;
  currentActionKey = null;

  // 先停倒计时，避免尾段采集期间被倒计时解锁
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  nextDoTime.value = 15;

  const relay = configActionRelays.value![key];
  batchUpdateTerminal(relay, 0);
  handleDo();

  if (collectTail) {
    // 超时：关闭继电器后继续采集 1s 电流尾段，再停止记录并保存
    finalizeTimerId = window.setTimeout(() => {
      finalizeAction(key);
    }, 1000);
  } else {
    // 正常归零：立即停止记录并保存
    finalizeAction(key);
  }
};

const finalizeAction = async (key: keyof ActionRelays) => {
  finalizeTimerId = null;
  stopRecord();

  const bothAvailable =
    availableDirections.value.DC && availableDirections.value.FC;
  if (bothAvailable) {
    const currentData = buildRecordData(key);
    if (!pendingSaveData.value) {
      // 第一个方向完成，暂存数据，不提交
      pendingSaveData.value = currentData;
    } else {
      // 第二个方向完成，一起提交
      await postRecord(pendingSaveData.value);
      await postRecord(currentData);
      pendingSaveData.value = null;
    }
  } else {
    saveRecord(key);
  }

  // 操动结束
  butItemIsDisable.value = false;
  const finishedDir = butItemStatus.value;
  butItemStatus.value = "";
  completedDirections.value.add(finishedDir);

  if (
    bothAvailable &&
    completedDirections.value.has("DC") &&
    completedDirections.value.has("FC")
  ) {
    startBeforeTestFinshed.value = false;
    completedDirections.value = new Set();
  } else if (!bothAvailable) {
    startBeforeTestFinshed.value = false;
  }
};

/* 电流归零检测：1.5s 内持续为 0 则立即结束动作 */
const checkZeroCurrent = () => {
  if (!isAction.value) return;
  const isZero = isThreePhase.value
    ? phaseACurrent.value === 0 &&
      phaseBCurrent.value === 0 &&
      phaseCCurrent.value === 0
    : (lastRegisterArr.value[0] ?? 0) === 0;

  if (isZero) {
    if (zeroSince === null) {
      zeroSince = performance.now();
    } else if (currentActionKey && performance.now() - zeroSince >= 1500) {
      finishAction(currentActionKey);
    }
  } else {
    zeroSince = null;
  }
};

/* 处理继电器动作 */
const handleRelayAction = (key: keyof ActionRelays) => {
  const relay = configActionRelays.value![key];
  batchUpdateTerminal(relay, 1);
  handleDo();
  startRecord();
  zeroSince = null;
  currentActionKey = key;
  actionTimerId = setTimeout(() => {
    finishAction(key, true);
  }, 15000);
};

/* 通讯链接状态，button根据这个链接状态显示 */
const isShowButtons = computed(() => {
  return modbusStatus.value && modbusStatus.value.connected;
});

/* 定操处理 */
const handleDC = () => {
  const key = butItemStatus.value as keyof ActionRelays;
  handleRelayAction(key);
};

/* 反操处理 */
const handleFC = () => {
  const key = butItemStatus.value as keyof ActionRelays;
  handleRelayAction(key);
};

/* 操作处理 */
const handleDo = () => {
  let result = terminals.value.map((item) => item.default_status);
  let idxArr =
    StartPowerConfig[deviceType.value as keyof typeof StartPowerConfig];
  wsSendData.value = gen32BitArray(result, idxArr);

  sendCmd(wsSendData.value, "relays", deviceType.value);
};

/* 发送命令 */
function sendCmd(data: number[] | null, type: string, deviceType?: string) {
  console.log("发送命令", type, data, deviceType);
  if (type === "startBeforeTestRelays" || type === "relays") {
    console.log("发送继电器命令", type, data, deviceType);
  }
  ws.send({ type: type, value: data, deviceType: deviceType });
}

// const updateConfigData = () => {
//   wsSendData.value = result;
// };

const butItemIsDisable = ref(false);

const nextDoTime = ref(15);
let timerId: number | null = null;

/* 操作处理 */
const handleOpe = (type: string) => {
  if (!configActionRelays.value) {
    return showToast("请先选择闭合方式", "error");
  }
  if (butItemIsDisable.value) return;

  const exposed = currentCurveRef.value;
  exposed?.resetData();
  powerCurveRef.value?.resetData();
  initTestResults(type as "DC" | "FC");
  butItemStatus.value = type;
  butItemIsDisable.value = true;

  // 关闭启动前测试继电器，恢复原有吸合状态，等2s后执行
  handleDo();
  nextDoTime.value = 2;

  setTimeout(() => {
    switch (type) {
      case "DC":
        handleDC();
        break;
      case "FC":
        handleFC();
        break;
    }
    nextDoTime.value = 15;
    // 开启每秒递减
    timerId = window.setInterval(() => {
      nextDoTime.value--;
      if (nextDoTime.value <= 0) {
        nextDoTime.value = 15;
        clearInterval(timerId!);
        timerId = null;
        butItemIsDisable.value = false;
        butItemStatus.value = "";
      }
    }, 1000);
  }, 2000);
};

/* 设备类型 */
const deviceType = ref("");

/* 通道电阻配置（全局，按 deviceType 匹配） */
const channelConfigs = ref<{ device_type: string; config: ChannelExpect[] }[]>(
  [],
);
const currentChannelConfig = computed<ChannelExpect[] | undefined>(() => {
  return channelConfigs.value.find((c) => c.device_type === deviceType.value)
    ?.config;
});

/* 阻值判定阈值（全局，按 deviceType 匹配） */
const resistanceThresholds = ref<
  {
    device_type: string;
    normal_min: number;
    normal_max: number;
    open_min: number;
    short_max: number;
  }[]
>([]);
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

/* 曲线判定阈值（全局，按 deviceType 匹配） */
const curveThresholds = ref<
  {
    device_type: string;
    current_peak_min: number;
    current_peak_max: number;
    current_zero_max: number;
    min_points: number;
    power_peak_min: number;
    power_peak_max: number;
    power_zero_max: number;
  }[]
>([]);
const currentCurveThreshold = computed<CurveThreshold>(() => {
  const t = curveThresholds.value.find(
    (c) => c.device_type === deviceType.value,
  );
  return t
    ? {
        currentPeakMin: t.current_peak_min,
        currentPeakMax: t.current_peak_max,
        currentZeroMax: t.current_zero_max,
        minPoints: t.min_points,
        powerPeakMin: t.power_peak_min,
        powerPeakMax: t.power_peak_max,
        powerZeroMax: t.power_zero_max,
      }
    : DEFAULT_CURVE_THRESHOLD;
});

/* 获取列表数据 */
async function getList() {
  try {
    const [
      itemRes,
      deviceRes,
      comboRes,
      configRes,
      channelConfigRes,
      thresholdRes,
      curveThresholdRes,
    ] = await Promise.all([
      fetch(HTTP_URL + "/getConfig/" + deviceId + "/" + combinationId.value),
      fetch(HTTP_URL + "/getDevice/" + deviceId),
      fetch(HTTP_URL + "/getCombination/" + combinationId.value),
      fetch(HTTP_URL + "/getConfigList/" + configId.value),
      fetch(HTTP_URL + "/getChannelConfigs"),
      fetch(HTTP_URL + "/getResistanceThresholds"),
      fetch(HTTP_URL + "/getCurveThresholds"),
    ]);

    itemConfig.value = await itemRes.json();

    if (itemConfig.value.length > 0) {
      active.value = itemConfig.value.filter(
        (v) => v.id === configId.value,
      )[0].id;
    }

    const deviceData = await deviceRes.json();
    device.value.name = deviceData.name || "";

    const comboData = await comboRes.json();
    combinationName.value = comboData.name || "";
    deviceType.value = comboData.deviceType || "";
    ws.send({ type: "setDeviceType", deviceType: deviceType.value });
    const configData = await configRes.json();
    // configActionRelays.value = configData.actionRelays || {};
    contact13Closed.value = configData.contact13Closed || {};
    contact24Closed.value = configData.contact24Closed || {};
    configName.value = configData.name || "";

    channelConfigs.value = await channelConfigRes.json();
    resistanceThresholds.value = await thresholdRes.json();
    curveThresholds.value = await curveThresholdRes.json();
  } catch (e) {
    console.error("加载数据失败:", e);
    throw e;
  }
}

/* 获取代码设备列表 */
async function getCodeDeviceList() {
  try {
    const [
      comboRes,
      configRes,
      channelConfigRes,
      thresholdRes,
      curveThresholdRes,
    ] = await Promise.all([
      fetch(HTTP_URL + "/getCombination/" + combinationId.value),
      fetch(HTTP_URL + "/getConfigList/" + configId.value),
      fetch(HTTP_URL + "/getChannelConfigs"),
      fetch(HTTP_URL + "/getResistanceThresholds"),
      fetch(HTTP_URL + "/getCurveThresholds"),
    ]);

    active.value = configId.value;
    device.value.name = codeName;
    const comboData = await comboRes.json();

    combinationName.value = comboData.name || "";
    deviceType.value = comboData.deviceType || "";
    ws.send({ type: "setDeviceType", deviceType: deviceType.value });

    const configData = await configRes.json();
    // configActionRelays.value = configData.actionRelays || {};
    contact13Closed.value = configData.contact13Closed || {};
    contact24Closed.value = configData.contact24Closed || {};
    configName.value = configData.name || "";

    channelConfigs.value = await channelConfigRes.json();
    resistanceThresholds.value = await thresholdRes.json();
    curveThresholds.value = await curveThresholdRes.json();

    if (
      routeCloseType === "contact13Closed" ||
      routeCloseType === "contact24Closed"
    ) {
      handleContactConfigClick(routeCloseType);
    }
  } catch (e) {
    console.error("加载数据失败:", e);
    throw e;
  }
}

/* 电流曲线判定：峰值区间 + 末段归零 + 采样点数 */
function judgeCurrentCurve(
  peak: any,
  history: any,
  th: CurveThreshold,
): { ok: boolean; peak: number; end: number; points: number } {
  let peakVal = 0;
  let endVal = 0;
  let points = 0;
  if (Array.isArray(history)) {
    points = history.length;
    peakVal =
      typeof peak === "number" ? peak : points ? Math.max(...history) : 0;
    endVal = points ? history[history.length - 1] : 0;
  } else if (history && typeof history === "object") {
    const a: number[] = history.A ?? [];
    const b: number[] = history.B ?? [];
    const c: number[] = history.C ?? [];
    points = Math.max(a.length, b.length, c.length);
    peakVal = Math.max(
      typeof peak?.A === "number" ? peak.A : 0,
      typeof peak?.B === "number" ? peak.B : 0,
      typeof peak?.C === "number" ? peak.C : 0,
    );
    const lastA = a.length ? (a[a.length - 1] ?? 0) : 0;
    const lastB = b.length ? (b[b.length - 1] ?? 0) : 0;
    const lastC = c.length ? (c[c.length - 1] ?? 0) : 0;
    endVal = Math.max(lastA, lastB, lastC);
  }
  const ok =
    points >= th.minPoints &&
    peakVal >= th.currentPeakMin &&
    peakVal <= th.currentPeakMax &&
    endVal <= th.currentZeroMax;
  return { ok, peak: peakVal, end: endVal, points };
}

/* 功率曲线判定：峰值区间 + 末段归零 */
function judgePowerCurve(
  history: number[],
  th: CurveThreshold,
): { ok: boolean; peak: number; end: number } {
  if (!Array.isArray(history) || history.length < 1) {
    return { ok: false, peak: 0, end: 0 };
  }
  const peakVal = Math.max(...history);
  const endVal = history[history.length - 1] ?? 0;
  const ok =
    peakVal >= th.powerPeakMin &&
    peakVal <= th.powerPeakMax &&
    endVal <= th.powerZeroMax;
  return { ok, peak: peakVal, end: endVal };
}

/* 构建保存数据（不发送请求） */
const buildRecordData = (relay: keyof ActionRelays): Record<string, any> => {
  const data = toRaw(testResults.value).map((item) => {
    return {
      status: item.status,
      name: item.name,
      relayName: item.relayName,
    };
  });
  const exposed = currentCurveRef.value;
  let peak, valley, history, xLabels;
  if (exposed?.isThreePhase) {
    peak = { A: exposed.peakA, B: exposed.peakB, C: exposed.peakC };
    valley = { A: exposed.valleyA, B: exposed.valleyB, C: exposed.valleyC };
    history = {
      A: exposed.currentHistoryA,
      B: exposed.currentHistoryB,
      C: exposed.currentHistoryC,
    };
    xLabels = exposed.xLabels3;
  } else {
    peak = exposed?.peakSingle;
    valley = exposed?.valleySingle;
    history = exposed?.currentHistory;
    xLabels = exposed?.xLabels;
  }

  // 曲线 + 表示继电器综合判定（仅判断当前操作相关的表示项）
  const th = currentCurveThreshold.value;
  const currentJudge = judgeCurrentCurve(peak, history, th);
  const recordTypes = relay === "FC" ? FC_RECORD_TYPES : DC_RECORD_TYPES;
  const relevantTests = toRaw(testResults.value).filter((item) =>
    recordTypes.has(item.type),
  );
  const resultPass = !relevantTests.some((item) => item.status === false);
  let powerJudge: { ok: boolean; peak: number; end: number } | null = null;
  const pw = powerCurveRef.value;
  if (isThreePhase.value && pw) {
    powerJudge = judgePowerCurve(pw.history, th);
  }
  const powerOk = powerJudge ? powerJudge.ok : true;
  const status = resultPass && currentJudge.ok && powerOk ? "success" : "error";

  // 失败原因（仅失败时记录，供历史记录展示）
  const reasons: string[] = [];
  if (!resultPass) {
    const failed = relevantTests
      .filter((item) => item.status === false)
      .map((item) => {
        if (item.name) return item.name;
        if (item.relayName && item.relayName.length)
          return item.relayName.join(",");
        return "";
      })
      .filter((s) => s);
    if (failed.length) reasons.push(`表示继电器异常(${failed.join(",")})`);
  }
  if (!currentJudge.ok) {
    if (currentJudge.points < th.minPoints)
      reasons.push(`采样点不足(${currentJudge.points}<${th.minPoints})`);
    if (currentJudge.peak < th.currentPeakMin)
      reasons.push(
        `电流峰值偏低(${currentJudge.peak.toFixed(1)}<${th.currentPeakMin}A)`,
      );
    if (currentJudge.peak > th.currentPeakMax)
      reasons.push(
        `电流峰值偏高(${currentJudge.peak.toFixed(1)}>${th.currentPeakMax}A)`,
      );
    if (currentJudge.end > th.currentZeroMax)
      reasons.push(
        `电流未归零(${currentJudge.end.toFixed(1)}>${th.currentZeroMax}A)`,
      );
  }
  if (powerJudge && !powerJudge.ok) {
    if (powerJudge.peak < th.powerPeakMin)
      reasons.push(
        `功率峰值偏低(${powerJudge.peak.toFixed(2)}<${th.powerPeakMin}KW)`,
      );
    if (powerJudge.peak > th.powerPeakMax)
      reasons.push(
        `功率峰值偏高(${powerJudge.peak.toFixed(2)}>${th.powerPeakMax}KW)`,
      );
    if (powerJudge.end > th.powerZeroMax)
      reasons.push(
        `功率未归零(${powerJudge.end.toFixed(2)}>${th.powerZeroMax}KW)`,
      );
  }
  const fail_reason = reasons.join("；");

  const tempData: Record<string, any> = {
    device_name: device.value.name,
    combination_name: combinationName.value,
    config_name: configName.value,
    op_type: relay,
    status,
    fail_reason,
    peak_current: typeof peak === "object" ? JSON.stringify(peak) : peak,
    valley_current:
      typeof valley === "object" ? JSON.stringify(valley) : valley,
    curve_data: history,
    time_data: xLabels,
    result: data,
  };

  if (startBeforeTestTips.value) {
    const tips = startBeforeTestTips.value;
    tempData.pre_test = {
      direction: tips.direction,
      channels: tips.dcResult.map((r) => ({
        name: r.channelName,
        value: r.value,
        state: r.state,
      })),
    };
  }

  if (isThreePhase.value && pw) {
    tempData.phasePower = pw.history;
    tempData.power_time = pw.xLabels;
  }

  return tempData;
};

const postRecord = async (tempData: Record<string, any>) => {
  try {
    await fetch(HTTP_URL + "/saveRecord", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tempData),
    });
  } catch (error) {
    console.error(error);
    showToast("保存记录失败", "error");
  }
};

/* 保存记录 */
const saveRecord = async (relay: keyof ActionRelays) => {
  const tempData = buildRecordData(relay);
  await postRecord(tempData);
};

// 通用模式：加载数据后弹出闭合方式选择
async function loadUniversalData() {
  await withLoading(async () => {
    await getList();
  }, "数据加载成功");
  showContactDialog.value = true;
}

// 六线制：沿用进入时携带的双动双机 + 一动J机
function selectSixWire() {
  showWireDialog.value = false;
  loadUniversalData();
}

// 四线制：单动单机 + ZD6-D
function selectFourWire() {
  combinationId.value =
    (route.query.fourCombo as string) || combinationId.value;
  configId.value = (route.query.fourConfig as string) || configId.value;
  showWireDialog.value = false;
  loadUniversalData();
}

onMounted(async () => {
  if (isUniversalMode) {
    // 通用模式：先选择四线制/六线制，再加载数据
    showWireDialog.value = true;
    return;
  }
  await withLoading(async () => {
    switch (opeModel) {
      case "code":
        await getCodeDeviceList();
        break;
      default:
        await getList();
        break;
    }
    // await getList();
  }, "数据加载成功");
});
</script>

<template>
  <!-- 通用模式：四线制/六线制选择弹框 -->
  <div v-if="showWireDialog" class="wire-overlay">
    <div class="wire-dialog">
      <div class="wire-dialog-title">请选择接线方式</div>
      <div class="wire-dialog-buttons">
        <button class="wire-dialog-btn" @click="selectSixWire">六线制</button>
        <button class="wire-dialog-btn" @click="selectFourWire">四线制</button>
      </div>
    </div>
  </div>

  <!-- 触点选择弹框 -->
  <div v-if="showContactDialog" class="contact-overlay">
    <div class="contact-dialog">
      <div class="contact-dialog-title">请选择闭合方式</div>
      <div class="contact-dialog-buttons">
        <button
          class="contact-dialog-btn"
          @click="handleContactDialogSelect('contact13Closed')">
          1、3闭合
        </button>
        <button
          class="contact-dialog-btn"
          @click="handleContactDialogSelect('contact24Closed')">
          2、4闭合
        </button>
      </div>
    </div>
  </div>

  <div class="dashboard">
    <DeviceBar
      :device-name="device.name"
      :combination-name="isUniversalMode ? '通用模式' : combinationName"
      :device-type="deviceType"
      :config-name="isUniversalMode ? '通用模式' : configName"
      :item-config="itemConfig"
      :contact-active="selectedContactType"
      v-model:active="active"
      @contactConfigClick="handleContactConfigClick"
      @back="handleBack()" />
    <div class="main-content">
      <CurrentCurve
        :start-current="currentData.startCurrent"
        :convert-current="currentData.convertCurrent"
        :lock-current="currentData.lockCurrent"
        :register-arr="isThreePhase ? undefined : registerArr"
        :register-arr-a="isThreePhase ? registerArrA : undefined"
        :register-arr-b="isThreePhase ? registerArrB : undefined"
        :register-arr-c="isThreePhase ? registerArrC : undefined"
        ref="currentCurveRef"
        @start="handleStart" />

      <PowerCurve
        ref="powerCurveRef"
        v-if="isThreePhase"
        :total-power="totalPower"
        :power-arr="isThreePhase ? powerArr : undefined" />

      <TestResults
        :tests="displayedTestResults"
        :modbus-status="modbusStatus"
        :powerStatusIsRunning="powerStatus?.isRunning"
        :isAction="isAction"
        :test-result="startBeforeTestTips"
        :start-before-loading="startBeforeLoading"
        :available-directions="availableDirections"
        :diagnosis-messages="displayDiagnosisMessages"
        :start-before-test-finshed="startBeforeTestFinshed"
        :show-d-c="showDCGroup"
        :show-f-c="showFCGroup"
        :device-type="deviceType" />
    </div>

    <div class="button-rows">
      <!-- 启动前测试 - 最先显示，不需要通电 -->
      <div
        v-if="isShowButtons && !startBeforeTestFinshed"
        style="
          flex: 1;
          justify-content: center;
          display: flex;
          align-items: center;
        ">
        <button
          v-if="!startBeforeLoading"
          class="action-btn test-btn"
          @click="handleStartBeforeTest()">
          启动前测试
        </button>
        <span v-if="startBeforeLoading" class="action-tips"
          >启动前测试中...</span
        >
      </div>

      <!-- 开启动作电源/紧急停止 - 测试通过后显示 -->
      <div
        v-if="isShowButtons && startBeforeTestFinshed"
        style="
          flex: 1;
          justify-content: center;
          display: flex;
          align-items: center;
        ">
        <button class="emergency-btn" @click="handleStart()">
          {{ powerStatus?.isRunning ? "紧急停止" : "开启动作电源" }}
        </button>
      </div>

      <!-- 定操/反操 - 通电后显示 -->
      <div
        class="action-buttons"
        style="flex: 1"
        v-if="
          isShowButtons && startBeforeTestFinshed && powerStatus?.isRunning
        ">
        <!-- <span class="action-light">
          <span v-if="butItemStatus === 'DC'" class="light light-green"></span>
          <span v-if="butItemStatus === 'FC'" class="light light-yellow"></span>
        </span> -->
        <button
          v-if="availableDirections.DC && showDCGroup"
          class="action-btn dc-btn"
          :disabled="butItemIsDisable"
          :class="butItemStatus === 'DC' ? 'active' : ''"
          @click="handleOpe('DC')">
          定操
        </button>
        <button
          v-if="availableDirections.FC && showFCGroup"
          class="action-btn fc-btn"
          :disabled="butItemIsDisable"
          :class="butItemStatus === 'FC' ? 'active' : ''"
          @click="handleOpe('FC')">
          反操
        </button>
        <span class="action-tips" v-if="butItemIsDisable">
          {{ nextDoTime }}s后可以再次操作</span
        >
      </div>
    </div>
    <div class="terminal-bar">
      <span class="terminal-bar-title">期望端子状态</span>

      <div
        v-for="t in terminals"
        :key="t.id"
        class="terminal-bar-item"
        :class="[t.default_status ? 'ok' : 'ng']">
        <span class="terminal-bar-name">{{ t.relay_name }}</span>
        <span
          class="terminal-bar-dot"
          :class="[t.default_status ? 'ok' : 'ng']"></span>
      </div>
    </div>
    <div class="terminal-bar">
      <span class="terminal-bar-title">端子实时状态</span>

      <div
        v-for="(t, index) in coilArr"
        :key="index"
        class="terminal-bar-item"
        :class="{ ok: t, ng: !t }">
        <span class="terminal-bar-name">{{
          terminals[index]?.relay_name
        }}</span>
        <span class="terminal-bar-dot" :class="{ ok: t, ng: !t }"></span>
      </div>
    </div>
    <div class="status-bar">
      <span class="status-text">{{ ws.status }}</span>
      <span
        v-if="modbusStatus"
        class="status-message"
        :class="modbusStatus.color"
        >{{ modbusStatus.msg }}</span
      >
      <span>{{ statusDesc }}</span>
      <!-- <span v-if="temperature">{{ temperature }}℃</span> -->
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #051424;
  overflow: hidden;
}

.main-content {
  display: flex;
  flex: 1;
  gap: 8px;
  padding: 8px 12px;
  min-height: 0;
  overflow: hidden;
}

.main-content > * {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.terminal-bar {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  height: 50px;
  overflow-y: auto;
  background: #0b1d33;
  border-top: 1px solid #1a2d44;
  border-bottom: 1px solid #1a2d44;
  padding: 4px 20px;
  flex-shrink: 0;
  scrollbar-width: thin;
  scrollbar-color: #1a3350 transparent;
}

.terminal-bar::-webkit-scrollbar {
  width: 4px;
}

.terminal-bar::-webkit-scrollbar-track {
  background: transparent;
}

.terminal-bar::-webkit-scrollbar-thumb {
  background: #1a3350;
  border-radius: 2px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.action-btn {
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid #2a4a68;
  color: #7a8fa0;
  font-size: 26px;
  padding: 4px 16px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}
.action-btn.active {
  background: rgba(90, 146, 208, 0.25);
  border-color: #5a92d0;
  color: #fff;
}
.dc-btn {
  background: rgba(52, 211, 153, 0.15);
  border-color: #34d399;
  color: #34d399;
}
.dc-btn.active {
  background: rgba(52, 211, 153, 0.35);
  border-color: #34d399;
  color: #fff;
}
.fc-btn {
  background: rgba(255, 197, 32, 0.15);
  border-color: #ffc520;
  color: #ffc520;
}
.fc-btn.active {
  background: rgba(255, 197, 32, 0.35);
  border-color: #ffc520;
  color: #fff;
}

.action-btn:disabled {
  background: rgba(149, 178, 211, 0.25);
  border-color: #759dcc;
  color: #fff;
  cursor: not-allowed;
}

.emergency-btn {
  background: #d93025;
  color: #fff;
  border: none;
  font-size: 26px;
  font-weight: 600;
  padding: 6px 20px;
  border-radius: 4px;
  cursor: pointer;
  letter-spacing: 1px;
  transition: background 0.2s;
}

.emergency-btn:hover {
  background: #e8473b;
}
.emergency-btn:disabled {
  background: #f19b94;
  cursor: not-allowed;
}

.button-rows {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  background: #071a2e;
  border-top: 1px solid #1a2d44;
  flex-shrink: 0;
}

.action-tips {
  color: #e9c235;
  align-self: flex-end;
}

.action-btn:disabled:not(.active) {
  border-color: #527fb188;
  color: #bfbfc0c5;
  pointer-events: none;
  /* 半透明弱化视觉 */
  opacity: 0.4;
  cursor: not-allowed;
}

.terminal-bar-title {
  font-size: 11px;
  color: #8fb4d8;
  flex-shrink: 0;
  margin-right: 8px;
}

.terminal-bar-grid {
  display: flex;
  gap: 8px;
  align-items: center;
}

.terminal-bar-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.terminal-bar-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #5a7288;
}

.terminal-bar-dot.ok {
  background: #34d399;
  box-shadow: 0 0 4px rgba(52, 211, 153, 0.6);
}

.terminal-bar-dot.ng {
  background: #f87171;
  box-shadow: 0 0 4px rgba(248, 113, 113, 0.6);
}

.terminal-bar-name {
  font-size: 11px;
  color: #8a9fb0;
}

.terminal-bar-item.ok .terminal-bar-name {
  color: #34d399;
}

.terminal-bar-item.ng .terminal-bar-name {
  color: #f87171;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 28px;
  background: #071a2e;
  border-top: 1px solid #1a2d44;
  padding: 0 12px;
  flex-shrink: 0;
}

.status-text {
  font-size: 11px;
  color: #5a7288;
}

.status-message {
  font-size: 12px;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
}
.green {
  color: #34d399;
}
.orange {
  color: orange;
}
.red {
  color: red;
}
.action-light {
  align-self: center;
}

.light {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-block;
}
.light-green {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.6);
}
.light-yellow {
  background: #facc15;
  box-shadow: 0 0 6px rgba(250, 204, 21, 0.6);
}

/* 触点选择弹框 */
.contact-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.contact-dialog {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 12px;
  padding: 40px 48px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.contact-dialog-title {
  font-size: 20px;
  color: #e0e8f0;
  margin-bottom: 32px;
}

.contact-dialog-buttons {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.contact-dialog-btn {
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid #2a4a68;
  color: #c0d0e0;
  font-size: 18px;
  padding: 12px 36px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.contact-dialog-btn:hover {
  background: rgba(90, 146, 208, 0.25);
  border-color: #5a92d0;
  color: #fff;
}

.wire-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.wire-dialog {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 12px;
  padding: 40px 48px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.wire-dialog-title {
  font-size: 20px;
  color: #e0e8f0;
  margin-bottom: 32px;
}

.wire-dialog-buttons {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.wire-dialog-btn {
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid #2a4a68;
  color: #c0d0e0;
  font-size: 18px;
  padding: 12px 36px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.wire-dialog-btn:hover {
  background: rgba(90, 146, 208, 0.25);
  border-color: #5a92d0;
  color: #fff;
}
</style>
