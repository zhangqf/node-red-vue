<script setup lang="ts">
import { computed, onMounted, ref, toRef, watch } from "vue";
import { useSocket } from "@/composables/useSocket";
import DeviceBar from "@/components/DeviceBar.vue";
import CurrentCurve from "@/components/CurrentCurve.vue";
import PowerCurve from "@/components/PowerCurve.vue";
import TestResults from "@/components/TestResults.vue";

import { HTTP_URL, WEBSOCKET_URL } from "@/config/config";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";

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

interface ActionRelays {
  DC: string[];
  FC: string[];
  DWBS: string[];
  EJCDDWBS: string[];
  EJCDFWBS: string[];
  FWBS: string[];
  YJCDDWBS: string[];
  YJCDFWBS: string[];
}

const configActionRelays = ref<ActionRelays | null>(null);

interface WSSTATUS {
  color: string;
  connected: boolean;
  lastTime: string;
  msg: string;
  type: string;
}

const wsStatus = ref<WSSTATUS>();

// 公共解析函数
function parseWsData(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("WS解析异常", e);
    return null;
  }
}

export interface TestItem {
  name: string;
  type: string;
  status: boolean | number | string;
}

const testResults = ref<TestItem[]>([]);

const funWsRealData = (data) => {
  // 收到线圈数据 → 只更新线圈缓存，寄存器不动
  if (data.unitId === 2) {
    const rawCoil = Array.isArray(data.data) ? data.data : [];
    const coilArr = rawCoil.map((item: number) => (item ? 1 : 0));
    lastCoilArr.value = coilArr.slice(0, terminals.value.length);
  }
  // 收到寄存器数据 → 只更新寄存器缓存，线圈不动
  if (data.unitId === 1) {
    const rawReg = Array.isArray(data.data) ? data.data : [];
    // lastRegisterArr.value = rawReg;
    if (isAction.value) {
      lastRegisterArr.value = rawReg;
    }
  }
  if (data.unitId === 3) {
    const relayData = configActionRelays.value;
    if (!relayData) {
      testResults.value = [];
      return;
    }
    // 表示寄存器数据 indicationRelay
    if (indicationRelay.value.length < 1) return;
    const { DWBS, FWBS, EJCDFWBS, EJCDDWBS, YJCDFWBS, YJCDDWBS } = relayData;

    const tempList = [
      {
        name: "定位表示",
        type: "GreenLight",
        status: DWBS[0],
      },
      {
        name: "反位表示",
        type: "YellowLight",
        status: FWBS[0],
      },
      {
        name: "二级传动反位",
        type: "SecondaryTransmissionInReversePosition",
        status: EJCDFWBS[0],
      },
      {
        name: "二级传动定位",
        type: "SecondaryTransmissionPositioning",
        status: EJCDDWBS[0],
      },
      {
        name: "一级传动反位",
        type: "PrimaryTransmissionInReversePosition",
        status: YJCDFWBS[0],
      },
      {
        name: "一级传动定位",
        type: "PrimaryTransmissionPositioning",
        status: YJCDDWBS[0],
      },
    ];

    testResults.value = tempList;
  }
};

const modbusStatus = ref();

const funWsStatus = (data) => {
  if (!data.connected) {
    lastCoilArr.value = [];
  }
  modbusStatus.value = data;
};

const temperature = ref(0);
const phaseAVoltage = ref(0);
const phaseBVoltage = ref(0);
const phaseCVoltage = ref(0);

const phaseACurrent = ref(0);
const phaseBCurrent = ref(0);
const phaseCCurrent = ref(0);

const handleCauculate = (data: number, params: number) => {
  return data / params;
};

const funThreePhaseACCollector = (data) => {
  temperature.value = handleCauculate(data[4], 100);
  phaseAVoltage.value = handleCauculate(data[5], 100);
  phaseBVoltage.value = handleCauculate(data[6], 100);
  phaseCVoltage.value = handleCauculate(data[7], 100);
  phaseACurrent.value = handleCauculate(data[8], 1000);
  phaseBCurrent.value = handleCauculate(data[9], 1000);
  phaseCCurrent.value = handleCauculate(data[10], 1000);
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
        case "ThreePhaseACCollector":
          funThreePhaseACCollector(data.sendData.value);
      }
    }
  },
  { immediate: true },
);

// 线圈计算属性：永远返回缓存的最新线圈数据，不会清空
const coilArr = computed(() => lastCoilArr.value);

// 寄存器计算属性：永远返回缓存的最新寄存器数据，不会清空
const registerArr = computed(() => lastRegisterArr.value);

const device = ref({
  name: "",
});
const combinationName = ref("");
const configName = ref("");

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
const contact13Closed = ref<ActionRelays>({
  DC: [],
  FC: [],
  DWBS: [],
  EJCDDWBS: [],
  EJCDFWBS: [],
  FWBS: [],
  YJCDDWBS: [],
  YJCDFWBS: [],
});
const contact24Closed = ref<ActionRelays>({
  DC: [],
  FC: [],
  DWBS: [],
  EJCDDWBS: [],
  EJCDFWBS: [],
  FWBS: [],
  YJCDDWBS: [],
  YJCDFWBS: [],
});
const itemConfig = ref<any[]>([]);

export type RelayKey = string;

const terminals = ref<any[]>([]);

const wsSendData = ref<number[] | null>(null);

const active = ref<string>("");
const deviceId = route.params.deviceId as string;
const combinationId = route.params.combinationId as string;
const configId = route.params.configId as string;
const indicationRelay = ref<any[]>([]);

async function getConfig(itemType: string) {
  try {
    const response = await fetch(HTTP_URL + "/getConfigRelays/" + itemType, {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    const { indicationRelays, relays } = await response.json();
    console.log(relays);
    console.log(indicationRelays);
    terminals.value = relays;
    indicationRelay.value = indicationRelays;
  } catch {
    terminals.value = [];
  }
}

watch(active, (newkey) => {
  if (!newkey) return;
  getConfig(newkey);
});

const handleStart = (start: string) => {
  if (start === "start") {
    handleDo();
  }
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

const batchUpdateTerminal = (nameList: string[], status: number) => {
  console.log(nameList);
  terminals.value
    .filter((item) => nameList.includes(item.relay_name))
    .forEach((item) => {
      item.default_status = status;
    });
};

const handleContact13Closed = () => {
  configActionRelays.value = contact13Closed.value;
};

const handleContact24Closed = () => {
  configActionRelays.value = contact24Closed.value;
};
const handleContactConfigClick = (type: string) => {
  switch (type) {
    case "contact13Closed":
      handleContact13Closed();
      break;
    case "contact24Closed":
      handleContact24Closed();
      break;
  }
};

const isAction = ref(false);

const startRecord = () => {
  isAction.value = true;
};
const stopRecord = () => {
  isAction.value = false;
};

const currentCurveRef = ref<InstanceType<typeof CurrentCurve>>();

const saveRecord = async (relay: keyof ActionRelays) => {
  const exposed = currentCurveRef.value;
  const valley = exposed?.valley_current;
  const peak = exposed?.peak_current;
  const history = exposed?.currentHistory;
  const xLabels = exposed?.xLabels;
  const tempData = {
    device_name: device.value.name,
    combination_name: combinationName.value,
    config_name: configName.value,
    op_type: relay,
    status: "success",
    peak_current: peak,
    valley_current: valley,
    curve_data: history,
    time_data: xLabels,
  };

  try {
    const response = await fetch(HTTP_URL + "/saveRecord", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tempData),
    });
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
};

const handleRelayAction = (key: keyof ActionRelays) => {
  console.log(configActionRelays);
  const relay = configActionRelays.value![key];
  console.log(key);
  batchUpdateTerminal(relay, 1);
  handleDo();
  startRecord();
  setTimeout(async () => {
    batchUpdateTerminal(relay, 0);
    handleDo();
    stopRecord();
    saveRecord(key);
  }, 6000);
};

const handleDC = () => {
  const key = butItemStatus.value as keyof ActionRelays;
  handleRelayAction(key);
};

const handleFC = () => {
  const key = butItemStatus.value as keyof ActionRelays;
  handleRelayAction(key);
};

const handleCD = () => {
  // const key = butItemStatus.value as keyof ActionRelays;
  // handleRelayAction(key);
  const data = [1, 0, 0, 0, 0];
  sendCmd(data, "collect");
};

const handleDo = () => {
  updateConfigData();
  console.log(wsSendData.value);
  sendCmd(wsSendData.value, "relays");
};

function sendCmd(data: number[] | null, type: string) {
  ws.send({ type: type, value: data });
}

const buttonItemConfig = [
  { name: "定操", type: "DC" },
  { name: "反操", type: "FC" },
  { name: "传动", type: "CD" },
  // { name: "混线", type: "HX" },
  // { name: "接地", type: "JD" },
];

const updateConfigData = () => {
  const result = terminals.value.map((item) =>
    item.default_status === 1 || item.default_status === "ok" ? 1 : 0,
  );
  wsSendData.value = result;
};

const butItemIsDisable = ref(false);

const nextDoTime = ref(10);
let timerId: number | null = null;
const handleOpe = (type: string) => {
  console.log(configActionRelays.value);
  if (!configActionRelays.value) {
    return showToast("请先选择闭合方式", "error");
  }
  if (butItemIsDisable.value) return;

  const exposed = currentCurveRef.value;
  exposed?.resetData();
  butItemStatus.value = type;
  butItemIsDisable.value = true;

  switch (type) {
    case "DC":
      handleDC();
      break;
    case "FC":
      handleFC();
      break;
    case "CD":
      handleCD();
      break;
  }

  // 开启每秒递减
  timerId = window.setInterval(() => {
    nextDoTime.value--;
    // 倒计时到0，清除定时器、解锁按钮
    if (nextDoTime.value <= 0) {
      nextDoTime.value = 10;
      clearInterval(timerId!);
      timerId = null;
      butItemIsDisable.value = false;
      butItemStatus.value = "";
    }
  }, 1000);
};

async function getList() {
  try {
    const [itemRes, deviceRes, comboRes, configRes] = await Promise.all([
      fetch(HTTP_URL + "/getConfig/" + deviceId + "/" + combinationId),
      fetch(HTTP_URL + "/getDevice/" + deviceId),
      fetch(HTTP_URL + "/getCombination/" + combinationId),
      fetch(HTTP_URL + "/getConfigList/" + configId),
    ]);

    itemConfig.value = await itemRes.json();

    if (itemConfig.value.length > 0) {
      active.value = itemConfig.value.filter((v) => v.id === configId)[0].id;
    }

    const deviceData = await deviceRes.json();
    device.value.name = deviceData.name || "";

    const comboData = await comboRes.json();
    combinationName.value = comboData.name || "";

    const configData = await configRes.json();
    // configActionRelays.value = configData.actionRelays || {};
    contact13Closed.value = configData.contact13Closed || {};
    contact24Closed.value = configData.contact24Closed || {};
    configName.value = configData.name || "";
  } catch {}
}

onMounted(async () => {
  await withLoading(async () => {
    await getList();
  });
});
</script>

<template>
  <div class="dashboard">
    <DeviceBar
      :device-name="device.name"
      :combination-name="combinationName"
      :config-name="configName"
      :item-config="itemConfig"
      v-model:active="active"
      @contactConfigClick="handleContactConfigClick"
      @back="router.back()" />

    <div class="main-content">
      <CurrentCurve
        :start-current="currentData.startCurrent"
        :convert-current="currentData.convertCurrent"
        :lock-current="currentData.lockCurrent"
        :register-arr="registerArr"
        ref="currentCurveRef"
        @start="handleStart" />

      <!-- <PowerCurve
        :power-kw="powerData.powerKw"
        :power-value="powerData.powerValue"
        :start-power="powerData.startPower"
        :convert-power="powerData.convertPower"
        :lock-power="powerData.lockPower" /> -->

      <div class="right-panel">
        <TestResults :tests="testResults" />
        <div class="action-buttons">
          <span class="action-light">
            <span
              v-if="butItemStatus === 'DC'"
              class="light light-green"></span>
            <span
              v-if="butItemStatus === 'FC'"
              class="light light-yellow"></span>
          </span>
          <button
            v-for="item in buttonItemConfig"
            class="action-btn"
            :disabled="butItemIsDisable"
            :class="butItemStatus === item.type ? 'active' : ''"
            @click="handleOpe(item.type)">
            {{ item.name }}
          </button>
          <span class="action-tips" v-if="butItemIsDisable">
            {{ nextDoTime }}s后可以再次操作</span
          >
        </div>
      </div>
    </div>
    <div class="terminal-bar">
      <span class="terminal-bar-title">期望端子状态</span>
      <!-- <div class="terminal-bar-grid"> -->
      <div
        v-for="t in terminals"
        :key="t.id"
        class="terminal-bar-item"
        :class="[t.default_status ? 'ok' : 'ng']">
        <span class="terminal-bar-name">{{ t.relay_name }}</span>
        <span
          class="terminal-bar-dot"
          :class="[t.default_status ? 'ok' : 'ng']"></span>
        <!-- </div> -->
      </div>
    </div>
    <div class="terminal-bar">
      <span class="terminal-bar-title">端子实时状态</span>
      <!-- <div class="terminal-bar-grid"> -->
      <div
        v-for="(t, index) in coilArr"
        :key="index"
        class="terminal-bar-item"
        :class="{ ok: t, ng: !t }">
        <span class="terminal-bar-name">{{
          terminals[index]?.relay_name
        }}</span>
        <span class="terminal-bar-dot" :class="{ ok: t, ng: !t }"></span>
        <!-- </div> -->
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
      <span v-if="temperature">{{ temperature }}℃</span>
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
</style>
