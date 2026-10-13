<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import DeviceBar from "@/components/DeviceBar.vue";
import CurrentCurve from "@/components/CurrentCurve.vue";
import PowerCurve from "@/components/PowerCurve.vue";
import TestResults from "@/components/TestResults.vue";

import { HTTP_URL, WEBSOCKET_URL } from "@/config/config";
import { anctionTips, buttonTips, buttonTitle } from "@/utils/button";
import {
  DC_GROUP_TYPES,
  FC_GROUP_TYPES,
  DEFAULT_THRESHOLD,
} from "@/utils/config";
import type { ChannelExpect, ResistanceThreshold } from "@/utils/config";
import { fetchWithTimeout as fetch } from "@/utils/http";
import {
  gen32BitArray,
  getCircuits,
  handleCalculate,
  mergeResistance,
  sleep,
} from "@/utils/utils";
import type { ActionRelays } from "@/utils/interface";

import { useButton } from "@/composables/useButton";
import { useCurveJudge } from "@/composables/useCurveJudge";
import { useDeviceLoad } from "@/composables/useDeviceLoad";
import { useExpressRelay } from "@/composables/useExpressRelay";
import { useIndication } from "@/composables/useIndication";
import { useMessageHandler } from "@/composables/useMessageHandler";
import { useOperationLog } from "@/composables/useOperationLog";
import { useModbus } from "@/composables/useModbus";
import { useOperation } from "@/composables/useOperation";
import { useOperationLogPanel } from "@/composables/useOperationLogPanel";
import { useRecordSave } from "@/composables/useRecordSave";
import { useSocket } from "@/composables/useSocket";
import { useStartBeforeTest } from "@/composables/useStartBeforeTest";
import { useTestFlow } from "@/composables/useTestFlow";
import { useToast } from "@/composables/useToast";

const route = useRoute();
const router = useRouter();
const { withLoading, showToast, showLoading, hideLoading } = useToast();

/* ============================================================
 * 数据加载
 * ========================================================== */
const ws = useSocket(WEBSOCKET_URL);
const {
  active,
  device,
  combinationName,
  deviceType,
  configName,
  contact13Closed,
  contact24Closed,
  channelConfigs,
  resistanceThresholds,
  curveThresholds,
  itemConfig,
  getCodeDeviceList,
  getList,
  deviceId,
  combinationId,
  configId,
  codeName,
  routeCloseType,
} = useDeviceLoad(ws);

deviceId.value = route.params.deviceId as string;
combinationId.value = route.params.combinationId as string;
configId.value = route.params.configId as string;

const opeModel = route.query.opeModel as string;
codeName.value = route.query.name as string;
const isUniversalMode = route.query.universal === "true";
routeCloseType.value = route.query.closeType as string;

const terminals = ref<any[]>([]);
const indicationRelay = ref<any[]>([]);
const wsSendData = ref<number[] | null>(null);
/** 初始化时快照下来的继电器期望状态 */
const initResult = ref<any[]>([]);
const selectedContactType = ref("");

/* ============================================================
 * 流程状态机 + 指令层
 * ========================================================== */
const flow = useTestFlow(ws);

const {
  msgError,
  msgErrorText,
  loading,
  loadingText,
  coilUnitId,
  handleCheckType,
} = useButton(flow);

/* ============================================================
 * 操作日志抽屉
 * ========================================================== */
const {
  entries: logEntries,
  logDrawerOpen,
  logDisplay,
  operationLogErrors,
  bitClass,
  diffText,
  formatLogTime,
  logStatusText,
  clearLog,
} = useOperationLogPanel();

/** 记录落库时要附带的操作日志快照 */
const { snapshot: snapshotLog } = useOperationLog();

/* ============================================================
 * 电路图查找（表示判定与启动前测试共用）
 * ========================================================== */
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

/* ============================================================
 * 表示继电器判定
 * ========================================================== */
const configActionRelays = ref<ActionRelays | null>(null);

const {
  testResults,
  positioningTrue,
  reverseTrue,
  initTestResults,
  handleWsRelayData,
  resetAllLock,
  displayedTestResults,
} = useIndication({
  configActionRelays,
  indicationRelay,
  deviceType,
  configName,
  handleFindCollect,
});

/* ============================================================
 * 表示继电器（与电阻回路共用线圈，开合时机受流程约束）
 * ========================================================== */
const {
  isOn: expressIsOn,
  turnOn: turnExpressOn,
  turnOff: turnExpressOff,
  stripExpress: stripExpressBits,
  applyOnValue,
} = useExpressRelay({
  flow,
  deviceType,
  terminals,
  coilUnitId,
  onError: (msg) => showToast(msg, "error"),
});

/* ============================================================
 * 曲线判定 + 测试记录
 * ========================================================== */
const currentCurveRef = ref<InstanceType<typeof CurrentCurve>>();
const powerCurveRef = ref<InstanceType<typeof PowerCurve>>();

const judge = useCurveJudge(deviceType, curveThresholds);

const resetCurves = () => {
  currentCurveRef.value?.resetData();
  powerCurveRef.value?.resetData();
};

/** 三相机型标识：由 useModbus 收到三相采集数据后置 true，决定走三相曲线与功率判定 */
const isThreePhase = ref(false);

/* ============================================================
 * 测试记录
 * ========================================================== */
const { saveRecord } = useRecordSave({
  device,
  combinationName,
  configName,
  testResults,
  getStartBeforeTestTips: () => startBeforeTestTips.value,
  isThreePhase,
  currentCurveRef,
  powerCurveRef,
  judge,
  snapshotLog,
});

/* ============================================================
 * 操动流程
 * ========================================================== */
const {
  isAction,
  butItemIsDisable,
  butItemStatus,
  operationWarningVisible,
  operationCountdown,
  checkZeroCurrent,
  handleOpe,
  cancelPendingOperation,
  stopRecord,
  batchUpdateTerminal,
  dispose: disposeOperation,
} = useOperation({
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
});

onUnmounted(() => disposeOperation());

/* ============================================================
 * 启动前测试
 * ========================================================== */
const availableDirections = ref<{ DC: boolean; FC: boolean }>({
  DC: false,
  FC: false,
});

/** 把全部继电器恢复到 default_status 并等待线圈读回确认 */
async function restoreInitialRelayState(): Promise<boolean> {
  const initialValue = gen32BitArray(
    terminals.value.map((item) => item.default_status),
    [],
  );
  const ok = await flow.sendCommand(
    "relays",
    { value: initialValue, deviceType: deviceType.value },
    {
      label: "恢复初始化继电器状态",
      expect: { unitId: coilUnitId(deviceType.value), value: initialValue },
    },
  );
  if (!ok) {
    showToast("恢复初始化继电器状态指令未确认，请重试", "error");
  }
  return ok;
}

/**
 * 表示测试：合上表示继电器后读回各项状态，推断定操/反操两个方向是否可用。
 * 电阻与表示是交叉对应关系：定操电阻对应反位表示与反操项，反操电阻对应定位表示与定操项。
 */
async function runExpressTest(): Promise<{
  DC: boolean;
  FC: boolean;
  diagnosis: string[];
}> {
  initTestResults();
  // 表示继电器在此合上，采样窗口内保持带电以便读取各项状态
  const ok = await applyOnValue("表示测试");
  if (!ok) {
    return { DC: false, FC: false, diagnosis: ["表示测试指令未确认"] };
  }

  await sleep(2000);
  const findItem = (type: string) =>
    testResults.value.find((item) => item.type === type);
  const dcItems = testResults.value.filter((item) =>
    FC_GROUP_TYPES.has(item.type),
  );
  const fcItems = testResults.value.filter((item) =>
    DC_GROUP_TYPES.has(item.type),
  );
  const green = findItem("GreenLight");
  const yellow = findItem("YellowLight");
  const physicalDcPassed =
    yellow?.status === true && dcItems.every((item) => item.status === true);
  const physicalFcPassed =
    green?.status === true && fcItems.every((item) => item.status === true);
  const swap = selectedContactType.value === "contact24Closed";
  return {
    DC: swap ? physicalFcPassed : physicalDcPassed,
    FC: swap ? physicalDcPassed : physicalFcPassed,
    diagnosis: [],
  };
}

const {
  startBeforeLoading,
  startBeforeTestTips,
  diagnosisMessages,
  handleStartBeforeTest,
  handleStartBeforeTestExpress,
} = useStartBeforeTest({
  flow,
  deviceType,
  channelConfigs,
  resistanceThresholds,
  availableDirections,
  selectedContactType,
  restoreInitialRelayState,
  runExpressTest,
  turnExpressOff,
  handleFindCollect,
});

const stepPrompt = computed(() => {
  if (loading.value) {
    return buttonTips[flow.currentStep.value] ?? loadingText.value;
  }
  if (startBeforeLoading.value)
    return buttonTips.START_BEFORE_TEST ?? "";
  return anctionTips[flow.currentStep.value] ?? "";
});

/** 启动前测试是否完成：由状态机当前步骤推导，越过该步即视为已完成 */
const startBeforeTestFinshed = computed(() => {
  const s = flow.currentStep.value;
  return s !== "SETUP" && s !== "START_BEFORE_TEST";
});

/* ============================================================
 * 实时采样：线圈 / 表示 / 电流曲线 / 三相
 * ========================================================== */
const lastRegisterArr = ref<number[]>([]);
const registerArr = computed(() => lastRegisterArr.value);

/** 动作继电器线圈状态 */
const handleActionRelays = (data: Record<string, any>) => {
  const rawCoil = Array.isArray(data.data) ? data.data : [];
  lastCoilArr.value = rawCoil
    .map((item: number) => (item ? 1 : 0))
    .slice(0, terminals.value.length);
};

/** 表示继电器采样：useModbus 传整个包，这里只取 data 数组 */
const handleExpressRelays = (data: Record<string, any>) => {
  handleWsRelayData(Array.isArray(data.data) ? data.data : []);
};

/** 采集直流电流曲线，动作中顺带做归零检测（单相机型走这里） */
const handleCollectDCCurve = (data: Record<string, any>) => {
  const rawReg: number[] = Array.isArray(data.data) ? data.data : [];
  if (!isAction.value) return;

  lastRegisterArr.value = rawReg;
  checkZeroCurrent((rawReg[0] ?? 0) === 0);
};

/** 三相机型的归零判定：三路电流同时为 0 才算归零 */
const checkThreePhaseZero = () => {
  if (!isAction.value) return;
  checkZeroCurrent(
    phaseACurrent.value === 0 &&
      phaseBCurrent.value === 0 &&
      phaseCCurrent.value === 0,
  );
};

const {
  modbusStatus,
  phaseACurrent,
  phaseBCurrent,
  phaseCCurrent,
  phasePower,
  powerArr,
  registerArrA,
  registerArrB,
  registerArrC,
  lastCoilArr,
  funThreePhaseACCollector,
  funWsRealData,
  funWsStatus,
} = useModbus({
  deviceType,
  isAction,
  isThreePhase,
  checkZeroCurrent: checkThreePhaseZero,
  handleActionRelays,
  handleExpressRelays,
  handleCollectDCCurve,
  handleStartBeforeTestExpress,
  speak: () => {},
  handleCalculate,
});

const totalPower = computed(() => phasePower.value);

/* ============================================================
 * WS 事件注册
 * ========================================================== */
const { registerEvent } = useMessageHandler({ ws, maxHistory: 400 });

registerEvent("cmdAck", (data: any) => flow.handleAck(data));
registerEvent("modbusStatus", (data: Record<string, string>) =>
  funWsStatus(data),
);
registerEvent("modbusRealData", (data: Record<string, any>) => {
  flow.handleModbusRealData(data as any);
  funWsRealData(data);
});
registerEvent("ThreePhaseACCollector", (data: Record<string, number[]>) =>
  funThreePhaseACCollector(data.value as number[]),
);

/* ============================================================
 * 界面派生状态
 * ========================================================== */
const showDCGroup = computed(() => true);
const showFCGroup = computed(() => true);

/** 诊断提示按当前视角过滤：定操视角只显示定操项，反操视角只显示反操项，通用提示始终显示 */
const displayDiagnosisMessages = computed(() => {
  return diagnosisMessages.value.filter((msg) => {
    if (msg.startsWith("定操-")) return showDCGroup.value;
    if (msg.startsWith("反操-")) return showFCGroup.value;
    return true;
  });
});

const currentData = ref({
  currentValue: 3.8,
  startCurrent: 1.0,
  convertCurrent: 0,
  lockCurrent: 0,
});

/** 通讯连接正常才允许下发指令 */
const isShowButtons = computed(() => {
  return modbusStatus.value && modbusStatus.value.connected;
});
const isActionStep = computed(
  () =>
    flow.currentStep.value === "READY" ||
    flow.currentStep.value === "OPERATING",
);
const statusDesc = computed(() => {
  if (!startBeforeTestFinshed.value) return "请先进行启动前测试";
  return "";
});

const showContactDialog = ref(
  route.query.opeModel !== "code" && route.query.universal !== "true",
);
const showWireDialog = ref(route.query.universal === "true");

/* ============================================================
 * 配置加载
 * ========================================================== */

/** terminals 是否已就绪：表示开合依赖 default_status，未就绪时不能下发 */
const terminalsReady = ref(false);
/** 选型完成时要求开表示；若配置尚未到位，就绪后补发 */
let pendingExpressOn = false;

/** 合上表示；配置未就绪时挂起到 getConfig 完成后补发 */
async function requestExpressOn() {
  if (!terminalsReady.value) {
    pendingExpressOn = true;
    return;
  }
  await turnExpressOn();
}

async function getConfig(itemType: string) {
  try {
    const response = await fetch(HTTP_URL + "/getConfigRelays/" + itemType, {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    const { indicationRelays, relays } = await response.json();
    terminals.value = relays;
    indicationRelay.value = indicationRelays;

    // WS 连上后先发端子默认状态，不自动开启动作电源。
    initResult.value = terminals.value.map((item) => item.default_status);
    wsSendData.value = gen32BitArray(initResult.value, []);
    terminalsReady.value = relays.length > 0;
    handleCheckType(wsSendData.value, deviceType.value);

    if (terminalsReady.value && pendingExpressOn) {
      pendingExpressOn = false;
      await requestExpressOn();
    }
  } catch (e) {
    console.error("加载配置失败:", e);
    terminals.value = [];
    terminalsReady.value = false;
  }
}

watch(active, (newkey) => {
  if (!newkey) return;
  getConfig(newkey);
});

/** 把某个闭合方式的表示项装载为当前判定基准 */
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

const handleContactConfigClick = (
  type: string,
  nonInitialPageTransition?: boolean,
) => {
  resetAllLock();
  selectedContactType.value = type;
  // 切换闭合方式后，原启动前测试结果失效，需重新测试
  startBeforeLoading.value = false;
  if (nonInitialPageTransition) {
    flow.transition("SETUP");
  }
  availableDirections.value = { DC: false, FC: false };
  diagnosisMessages.value = [];
  startBeforeTestTips.value = null;
  persistCloseType(type);

  configActionRelays.value =
    type === "contact13Closed" ? contact13Closed.value : contact24Closed.value;
  initTestResults();
  // 选型/切换闭合方式后立即合上表示，让操作员看到当前道岔位置
  requestExpressOn();
};

const handleContactDialogSelect = (type: string) => {
  handleContactConfigClick(type);
  showContactDialog.value = false;
};

/* ============================================================
 * 主按钮
 * ========================================================== */
const handleButtonAction = () => {
  switch (flow.currentStep.value) {
    case "SETUP":
      handleCheckType(wsSendData.value, deviceType.value);
      break;
    case "START_BEFORE_TEST":
      stopRecord();
      initTestResults();
      lastRegisterArr.value = [];
      resetCurves();
      handleStartBeforeTest(initResult.value);
      break;
  }
};

/* ============================================================
 * 离开页面前复位设备
 * ========================================================== */
let isReturning = false;
const handleBack = async () => {
  if (isReturning) return;
  isReturning = true;
  showLoading("正在返回，请稍候...");
  try {
    const result = terminals.value.map(() => 0);
    wsSendData.value = gen32BitArray(result, []);
    // 离开页面前尽力复位端子：等 ack 确认（最多 0.8s），不重发
    await flow.sendCommand(
      "relays",
      { value: wsSendData.value, deviceType: deviceType.value },
      { label: "复位端子状态", timeout: 800, retries: 0 },
    );
    await flow.sendCommand(
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
    ws.close();
    router.back();
  } catch (error) {
    console.error("返回页面前复位设备失败:", error);
    showToast("返回失败，请检查设备状态后重试", "error");
    isReturning = false;
  } finally {
    hideLoading();
  }
};

/* ============================================================
 * 通用模式：四线制 / 六线制
 * ========================================================== */
async function loadUniversalData() {
  await withLoading(async () => {
    await getList();
  }, "数据加载成功");
  showContactDialog.value = true;
}

/** 六线制：沿用进入时携带的双动双机 + 一动J机 */
function selectSixWire() {
  showWireDialog.value = false;
  loadUniversalData();
}

/** 四线制：单动单机 + ZD6-D */
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
        await getCodeDeviceList(handleContactConfigClick);
        break;
      default:
        await getList();
        break;
    }
    // setDeviceType 在 Node-RED 侧只是改 flow 变量，无 Modbus 读回，发一次即可不重试
    flow.sendCommand(
      "setDeviceType",
      { deviceType: deviceType.value },
      { timeout: 1000, retries: 0, label: "切换机型" },
    );
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
      :status-message="stepPrompt"
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
        ref="currentCurveRef" />

      <PowerCurve
        ref="powerCurveRef"
        v-if="isThreePhase"
        :total-power="totalPower"
        :power-arr="isThreePhase ? powerArr : undefined" />

      <TestResults
        :msgError="msgError"
        :msgErrorText="msgErrorText"
        :tests="displayedTestResults"
        :modbus-status="modbusStatus"
        :powerStatusIsRunning="false"
        :isAction="isAction"
        :test-result="startBeforeTestTips"
        :available-directions="availableDirections"
        :diagnosis-messages="displayDiagnosisMessages"
        :start-before-test-finshed="startBeforeTestFinshed"
        :show-d-c="showDCGroup"
        :show-f-c="showFCGroup"
        :device-type="deviceType" />
    </div>

    <div class="button-rows">
      <!-- 启动前测试 - 最先显示，不需要通电 -->
      <!-- <button
        v-if="!startBeforeLoading"
        class="action-btn test-btn"
        @click="handleCheckType(wsSendData, deviceType)">
        选型 {{ flow.currentStep }}
      </button> -->
      <div
        v-if="isShowButtons && !startBeforeTestFinshed"
        style="
          flex: 1;
          justify-content: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        ">
        <button
          v-if="!loading && !startBeforeLoading"
          class="action-btn test-btn"
          @click="handleButtonAction()">
          {{ buttonTitle[flow.currentStep.value] ?? "下一步" }}
        </button>
        <span v-if="loading || startBeforeLoading" class="action-tips">{{
          buttonTips[flow.currentStep.value]
        }}</span>
      </div>

      <!-- 测试完成后直接显示可用的定操/反操方向 -->
      <div
        class="action-buttons"
        style="flex: 1"
        v-if="isShowButtons && startBeforeTestFinshed && isActionStep">
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
          {{
            operationWarningVisible
              ? `请周围人员注意，${operationCountdown} 秒后开始供强电操动`
              : `正在执行${butItemStatus === "DC" ? "定操" : "反操"}，请勿操作`
          }}</span
        >
      </div>
      <div
        v-if="isShowButtons && operationLogErrors.length"
        class="start-before-error-message"
        role="alert">
        <div class="start-before-error-header">
          <span class="start-before-error-indicator" aria-hidden="true">!</span>
          <span>操作日志异常</span>
        </div>
        <div class="start-before-error-list">
          <div
            v-for="item in operationLogErrors"
            :key="item.e.id"
            class="start-before-error-item">
            <span class="start-before-error-label">{{ item.e.label }}</span>
            <span
              v-if="item.e.send === 'error'"
              class="start-before-error-status">
              发送失败
            </span>
            <span
              v-if="item.e.exec === 'error'"
              class="start-before-error-status">
              响应失败
            </span>
            <span
              v-if="item.diffIndices.length"
              class="start-before-error-diff">
              {{ diffText(item.diffIndices) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="operationWarningVisible"
      class="operation-warning-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="operation-warning-title">
      <div class="operation-warning-dialog">
        <h2 id="operation-warning-title">强电操动安全提示</h2>
        <p>
          即将进行{{
            butItemStatus === "DC" ? "定操" : "反操"
          }}。请通知周围人员注意安全， 确认现场安全并准备供强电。
        </p>
        <strong>{{ operationCountdown }} 秒后开始</strong>
        <button
          class="operation-warning-cancel"
          @click="cancelPendingOperation">
          取消操作
        </button>
      </div>
    </div>
    <!-- <div class="terminal-bar">
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
    </div> -->
    <div class="status-bar">
      <span class="status-text">{{ ws.status }}</span>
      <span
        v-if="modbusStatus"
        class="status-message"
        :class="modbusStatus.color"
        >{{ modbusStatus.msg }}</span
      >
      <span>{{ statusDesc }}</span>
      <span v-if="terminalsReady" class="status-express">
        表示{{ expressIsOn ? "ON" : "OFF" }}
      </span>
    </div>

    <button class="log-toggle" @click="logDrawerOpen = true">
      操作日志
      <span v-if="logEntries.length" class="log-toggle-count">{{
        logEntries.length
      }}</span>
    </button>

    <div
      v-if="logDrawerOpen"
      class="log-backdrop"
      @click="logDrawerOpen = false"></div>

    <div class="log-drawer" :class="{ open: logDrawerOpen }">
      <div class="log-drawer-header">
        <span>操作日志</span>
        <div class="log-drawer-actions">
          <button class="log-clear-btn" @click="clearLog()">清空</button>
          <button class="log-close-btn" @click="logDrawerOpen = false">
            ×
          </button>
        </div>
      </div>
      <div class="log-drawer-list">
        <div v-if="!logDisplay.length" class="log-empty">暂无操作记录</div>
        <div
          v-for="item in logDisplay"
          :key="item.e.id"
          class="log-item"
          :class="{
            'log-item-error':
              item.e.exec === 'error' || item.e.send === 'error',
          }">
          <div class="log-item-top">
            <span class="log-time">{{ formatLogTime(item.e.time) }}</span>
            <span class="log-label">{{ item.e.label }}</span>
            <span class="log-cmd">{{ item.e.cmd }}</span>
          </div>
          <div class="log-item-badges">
            <span class="log-badge" :class="'log-' + item.e.send"
              >发送:{{ logStatusText(item.e.send) }}</span
            >
            <span
              v-if="item.e.exec !== 'none'"
              class="log-badge"
              :class="'log-' + item.e.exec"
              >响应:{{ logStatusText(item.e.exec) }}</span
            >
            <span v-else class="log-badge log-none">无读回</span>
            <span v-if="item.diffIndices.length" class="log-badge log-diff">{{
              diffText(item.diffIndices)
            }}</span>
          </div>
          <div v-if="item.hasSend || item.hasRecv" class="log-bits">
            <div v-if="item.hasSend" class="log-bit-row">
              <span class="log-bit-row-label">发送</span>
              <span
                v-for="(b, i) in item.sendBits"
                :key="'s' + i"
                class="log-bit"
                :class="bitClass(b)"></span>
            </div>
            <div v-if="item.hasRecv" class="log-bit-row">
              <span class="log-bit-row-label">响应</span>
              <span
                v-for="(b, i) in item.recvBits"
                :key="'r' + i"
                class="log-bit"
                :class="bitClass(b)"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-toggle {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  writing-mode: vertical-rl;
  letter-spacing: 2px;
  background: #0b1d33;
  border: 1px solid #2a4a68;
  border-right: none;
  color: #7fb0e0;
  font-size: 12px;
  padding: 10px 6px;
  border-radius: 4px 0 0 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.log-toggle:hover {
  background: #16324f;
  color: #a9d0f5;
}

.log-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.45);
}

.log-toggle-count {
  display: inline-block;
  margin-top: 8px;
  background: #2a4a68;
  color: #cfe3f7;
  border-radius: 8px;
  padding: 0 4px;
  font-size: 10px;
  letter-spacing: 0;
}

.log-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 420px;
  background: #0b1d33;
  border-left: 1px solid #1a2d44;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.4);
}

.log-drawer.open {
  transform: translateX(0);
}

.log-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #1a2d44;
  color: #a9d0f5;
  font-size: 15px;
  flex-shrink: 0;
}

.log-drawer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-clear-btn,
.log-close-btn {
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid #2a4a68;
  color: #7a8fa0;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.log-clear-btn {
  font-size: 12px;
  padding: 2px 8px;
}

.log-close-btn {
  font-size: 16px;
  line-height: 1;
  padding: 2px 8px;
}

.log-clear-btn:hover,
.log-close-btn:hover {
  border-color: #3f6a95;
  color: #a9d0f5;
}

.log-drawer-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  scrollbar-width: thin;
  scrollbar-color: #1a3350 transparent;
}

.log-drawer-list::-webkit-scrollbar {
  width: 4px;
}

.log-drawer-list::-webkit-scrollbar-thumb {
  background: #1a3350;
  border-radius: 2px;
}

.log-empty {
  color: #4c637a;
  font-size: 13px;
  text-align: center;
  padding: 24px 0;
}

.log-item {
  background: #0e2138;
  border: 1px solid #1a2d44;
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 6px;
}

.log-item-error {
  border-color: rgba(255, 107, 107, 0.45);
}

.log-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.log-time {
  color: #4c637a;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.log-label {
  color: #cfe3f7;
  font-size: 13px;
}

.log-cmd {
  margin-left: auto;
  color: #4c637a;
  font-size: 11px;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
}

.log-item-badges {
  display: flex;
  gap: 6px;
}

.log-badge {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 3px;
  border: 1px solid transparent;
}

.log-success {
  color: #4fd18b;
  background: rgba(79, 209, 139, 0.12);
  border-color: rgba(79, 209, 139, 0.4);
}

.log-error {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.12);
  border-color: rgba(255, 107, 107, 0.4);
}

.log-pending {
  color: #e0b34f;
  background: rgba(224, 179, 79, 0.12);
  border-color: rgba(224, 179, 79, 0.4);
}

.log-none {
  color: #566b7f;
  background: rgba(86, 107, 127, 0.12);
  border-color: rgba(86, 107, 127, 0.35);
}

.log-diff {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.12);
  border-color: rgba(255, 107, 107, 0.4);
}

.log-bits {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}

.log-bit-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.log-bit-row-label {
  color: #4c637a;
  font-size: 10px;
  flex-shrink: 0;
  width: 26px;
  text-align: right;
  margin-right: 4px;
}

.log-bit {
  width: 7px;
  height: 7px;
  border-radius: 1px;
  background: #1c3350;
  flex-shrink: 0;
}

.log-bit-on {
  background: #34d399;
}

.log-bit-off {
  background: #2a4a68;
}

.log-bit-diff {
  background: #ff6b6b;
  box-shadow: 0 0 3px rgba(255, 107, 107, 0.8);
}

.log-bit-missing {
  background: #16263a;
}

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
  justify-content: center;
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
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  background: #071a2e;
  border-top: 1px solid #1a2d44;
  flex-shrink: 0;
}

.action-tips {
  color: #e9c235;
  align-self: center;
}

.start-before-error-message {
  flex: 1 0 100%;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  color: #ffd7d7;
  background: rgba(126, 35, 45, 0.2);
  border: 1px solid rgba(255, 107, 107, 0.38);
  border-radius: 6px;
  font-size: 12px;
}

.start-before-error-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  color: #ff8585;
  font-weight: 700;
}

.start-before-error-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 11px;
  line-height: 1;
}

.start-before-error-list {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px 14px;
  min-width: 0;
}

.start-before-error-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.start-before-error-label {
  color: #ffe2e2;
  font-weight: 600;
}

.start-before-error-status {
  color: #ff8585;
  white-space: nowrap;
}

.start-before-error-diff {
  color: #ffc078;
  font-size: 11px;
}

@media (max-width: 600px) {
  .start-before-error-message {
    flex-direction: column;
    gap: 6px;
  }
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

.status-express {
  font-size: 11px;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
  color: #7fb0e0;
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

.operation-warning-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(20, 8, 8, 0.82);
  backdrop-filter: blur(5px);
}

.operation-warning-dialog {
  width: min(560px, 100%);
  padding: 32px;
  border: 2px solid #ef4444;
  border-radius: 12px;
  background: #251014;
  color: #fff;
  text-align: center;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
}

.operation-warning-dialog h2 {
  margin: 0 0 16px;
  color: #fca5a5;
  font-size: 26px;
}

.operation-warning-dialog p {
  margin: 0 0 20px;
  color: #fee2e2;
  font-size: 18px;
  line-height: 1.6;
}

.operation-warning-dialog strong {
  display: block;
  margin-bottom: 24px;
  color: #fbbf24;
  font-size: 32px;
}

.operation-warning-cancel {
  padding: 10px 28px;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  background: #7f1d1d;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}
</style>
