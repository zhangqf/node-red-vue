<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import { useSocket } from "@/composables/useSocket";
import DeviceBar from "@/components/DeviceBar.vue";
import CurrentCurve from "@/components/CurrentCurve.vue";
import PowerCurve from "@/components/PowerCurve.vue";
import TestResults from "@/components/TestResults.vue";

import { WEBSOCKET_URL } from "@/config/config";

const ws = useSocket(WEBSOCKET_URL);
ws.connect();

// 原始websocket消息
const rawWsMsg = ref<string | null>(null);
// 分别缓存线圈、寄存器最新有效值
const lastCoilArr = ref<number[]>([]);
const lastRegisterArr = ref<number[]>([]);

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

// 单独定义类型接口
export interface TestItem {
  name: string;
  type: string;
  status: boolean | number;
}

const testResults = ref<TestItem[]>([]);

// 监听ws消息，自动更新对应缓存，另一个数组保留旧值
watch(
  () => ws.message.value,
  (newMsg) => {
    rawWsMsg.value = newMsg;
    const data = parseWsData(newMsg);
    if (!data) return;

    // 收到线圈数据 → 只更新线圈缓存，寄存器不动
    if (data.unitId === 2) {
      const rawCoil = Array.isArray(data.payload) ? data.payload : [];
      const coilArr = rawCoil.map((item: number) => (item ? 1 : 0));
      lastCoilArr.value = coilArr.slice(0, terminals.value.length);
    }
    // 收到寄存器数据 → 只更新寄存器缓存，线圈不动
    if (data.unitId === 1) {
      const rawReg = Array.isArray(data.payload) ? data.payload : [];
      lastRegisterArr.value = rawReg;
    }

    if (data.unitId === 3) {
      const tempList = [
        {
          name: "定位表示",
          type: "GreenLight",
          status: data.payload[6],
        },
        {
          name: "反位表示",
          type: "YellowLight",
          status: data.payload[7],
        },
        {
          name: "二级传动反位",
          type: "SecondaryTransmissionInReversePosition",
          status: data.payload[3],
        },
        {
          name: "二级传动定位",
          type: "SecondaryTransmissionPositioning",
          status: data.payload[2],
        },
        {
          name: "一级传动反位",
          type: "PrimaryTransmissionInReversePosition",
          status: data.payload[1],
        },
        {
          name: "一级传动定位",
          type: "PrimaryTransmissionPositioning",
          status: data.payload[0],
        },
      ];

      testResults.value = tempList;
    }
  },
  { immediate: true },
);

// 线圈计算属性：永远返回缓存的最新线圈数据，不会清空
const coilArr = computed(() => lastCoilArr.value);

// 寄存器计算属性：永远返回缓存的最新寄存器数据，不会清空
const registerArr = computed(() => lastRegisterArr.value);

// const wsArr = computed<number[] | undefined>(() => {
//   const rawMsg = ws.message.value;
//   // 空消息直接返回空数组兜底
//   if (!rawMsg) return [];

//   let data: any;
//   try {
//     // 只解析一次，全局复用
//     data = JSON.parse(rawMsg);
//   } catch (err) {
//     console.error("websocket json解析失败", err);
//     return [];
//   }

//   // 区分数据类型（统一小写匹配后端标记）
//   if (data.dataType === "CoilStatus") {
//     // 后端payload是布尔数组 [false, true, false]
//     const coilRaw = Array.isArray(data.payload) ? data.payload : [];
//     // 布尔转数字 0/1
//     let arr: number[] = coilRaw.map((item) => (item ? 1 : 0));
//     // 按端子数量截断多余数据
//     return arr.slice(0, terminals.value.length);
//   }

//   if (data.dataType === "RegisterValue") {
//     // 后端payload是数字寄存器数组 [0,482,434]
//     const regArr = Array.isArray(data.payload) ? data.payload : [];
//     return regArr.slice(0, terminals.value.length);
//   }

//   // 兜底：未知类型返回空数组，保证computed一定返回number[]
//   return [];
// });

const device = ref({
  name: "ZD6",
  driveMode: "1、3闭合",
  direction: "定位 反",
});

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
const itemConfig = ref([
  {
    name: "一动E机",
    type: "1E",
  },
  {
    name: "一动J机",
    type: "1J",
  },
  {
    name: "二动E机",
    type: "2E",
  },
  {
    name: "二动J机",
    type: "2J",
  },
]);

interface RelayItem {
  name: string;
  status: "ok" | "ng";
}

type RelayConfigMap = Record<"1E" | "1J" | "2E" | "2J", RelayItem[]>;

const relayConfig = ref({
  "1E": [
    {
      name: "KA1",
      status: "ng",
    },
    {
      name: "KA2",
      status: "ng",
    },
    {
      name: "KA3",
      status: "ng",
    },
    {
      name: "KA4",
      status: "ok",
    },
    {
      name: "KA5",
      status: "ng",
    },
    {
      name: "KA6",
      status: "ng",
    },
    {
      name: "KA7",
      status: "ng",
    },
    {
      name: "KA8",
      status: "ng",
    },
    {
      name: "KA9",
      status: "ng",
    },
    {
      name: "KA10",
      status: "ng",
    },
    {
      name: "KA11",
      status: "ng",
    },
    {
      name: "KA12",
      status: "ng",
    },
  ],
  "1J": [
    {
      name: "KA1",
      status: "ok",
    },
    {
      name: "KA2",
      status: "ok",
    },
    {
      name: "KA3",
      status: "ng",
    },
    {
      name: "KA4",
      status: "ok",
    },
    {
      name: "KA5",
      status: "ok",
    },
    {
      name: "KA6",
      status: "ok",
    },
    {
      name: "KA7",
      status: "ok",
    },
    {
      name: "KA8",
      status: "ok",
    },
    {
      name: "KA9",
      status: "ok",
    },
    {
      name: "KA10",
      status: "ok",
    },
    {
      name: "KA11",
      status: "ng",
    },
    {
      name: "KA12",
      status: "ng",
    },
  ],
  "2E": [
    {
      name: "KA1",
      status: "ng",
    },
    {
      name: "KA2",
      status: "ng",
    },
    {
      name: "KA3",
      status: "ng",
    },
    {
      name: "KA4",
      status: "ok",
    },
    {
      name: "KA5",
      status: "ng",
    },
    {
      name: "KA6",
      status: "ng",
    },
    {
      name: "KA7",
      status: "ng",
    },
    {
      name: "KA8",
      status: "ng",
    },
    {
      name: "KA9",
      status: "ng",
    },
    {
      name: "KA10",
      status: "ng",
    },

    {
      name: "KA11",
      status: "ng",
    },
    {
      name: "KA12",
      status: "ng",
    },
  ],
  "2J": [
    {
      name: "KA1",
      status: "ok",
    },
    {
      name: "KA2",
      status: "ok",
    },
    {
      name: "KA3",
      status: "ng",
    },
    {
      name: "KA4",
      status: "ok",
    },
    {
      name: "KA5",
      status: "ok",
    },
    {
      name: "KA6",
      status: "ok",
    },
    {
      name: "KA7",
      status: "ng",
    },
    {
      name: "KA8",
      status: "ng",
    },
    {
      name: "KA9",
      status: "ng",
    },
    {
      name: "KA10",
      status: "ng",
    },
    {
      name: "KA11",
      status: "ng",
    },
    {
      name: "KA12",
      status: "ng",
    },
  ],
});

const terminals = ref([
  { name: "X1", status: "ok" },
  { name: "X3", status: "ok" },
  { name: "X4", status: "ok" },
  { name: "X5", status: "ok" },
  { name: "X6", status: "ok" },
  { name: "X7", status: "ok" },
  { name: "X8", status: "ok" },
  { name: "X9", status: "ok" },
  { name: "X10", status: "ok" },
]);

const wsSendData = ref<number[] | null>(null);

export type RelayKey = "1E" | "1J" | "2E" | "2J";

const active = ref<RelayKey>("1E");

watch(
  active,
  (newkey) => {
    const list = relayConfig.value[newkey];
    butItemStatus.value = "";
    terminals.value = [...list];
    const result = list.map((item) => (item.status === "ok" ? 1 : 0));
    wsSendData.value = result;
  },
  { immediate: true },
);

const handleStart = (start: string) => {
  if (start === "start") {
    sendCmd(wsSendData.value);
  }
};

const findNode = (name: string, status: string) => {
  const targetTerminal = terminals.value.find((item) => item.name === name);
  if (targetTerminal) {
    targetTerminal.status = status;
  }
};

const handleDC = () => {
  findNode("KA11", "ok");
  handleDo();
  setTimeout(() => {
    findNode("KA11", "ng");
    handleDo();
  }, 6000);
};

const handleFC = () => {
  findNode("KA12", "ok");
  handleDo();
  setTimeout(() => {
    findNode("KA12", "ng");
    handleDo();
  }, 6000);
};

const handleDo = () => {
  updateConfigData();
  console.log(wsSendData.value);
  sendCmd(wsSendData.value);
};

function sendCmd(data: number[] | null) {
  ws.send({ value: data });
}

const buttonItemConfig = [
  {
    name: "定操",
    type: "DC",
  },
  {
    name: "反操",
    type: "FC",
  },
  {
    name: "传动",
    type: "CD",
  },
  {
    name: "混线",
    type: "HX",
  },
  {
    name: "接地",
    type: "JD",
  },
];

const updateConfigData = () => {
  const result = terminals.value.map((item) => (item.status === "ok" ? 1 : 0));
  wsSendData.value = result;
};

const butItemIsDisable = ref(false);

const nextDoTime = ref(15);
let timerId: number | null = null;
const handleOpe = (type: string) => {
  if (butItemIsDisable.value) return;

  butItemStatus.value = type;
  butItemIsDisable.value = true;

  switch (type) {
    case "DC":
      handleDC();
      break;
    case "FC":
      handleFC();
      break;
  }

  // 开启每秒递减
  timerId = window.setInterval(() => {
    nextDoTime.value--;
    // 倒计时到0，清除定时器、解锁按钮
    if (nextDoTime.value <= 0) {
      nextDoTime.value = 15;
      clearInterval(timerId!);
      timerId = null;
      butItemIsDisable.value = false;
    }
  }, 1000);
};
</script>

<template>
  <div class="dashboard">
    <DeviceBar
      :device-name="device.name"
      :drive-mode="device.driveMode"
      :item-config="itemConfig"
      :direction="device.direction"
      v-model:active="active" />

    <div class="main-content">
      <CurrentCurve
        :start-current="currentData.startCurrent"
        :convert-current="currentData.convertCurrent"
        :lock-current="currentData.lockCurrent"
        :register-arr="registerArr"
        @start="handleStart" />

      <!-- <PowerCurve
        :power-kw="powerData.powerKw"
        :power-value="powerData.powerValue"
        :start-power="powerData.startPower"
        :convert-power="powerData.convertPower"
        :lock-power="powerData.lockPower" /> -->

      <TestResults :tests="testResults" />
    </div>
    <div class="terminal-button">
      <!-- <div class="terminal-bar-header">
        <span class="terminal-bar-title">期望端子</span>
        <span class="terminal-bar-title">状态</span>
      </div> -->
      <div class="action-buttons">
        <!-- {{ butItemIsDisable }} -->
        <span class="action-light">
          <span v-if="butItemStatus === 'DC'" class="light light-green"></span>
          <span v-if="butItemStatus === 'FC'" class="light light-yellow"></span>
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
    <div class="terminal-bar">
      <div class="terminal-bar-header">
        <span class="terminal-bar-title">期望端子</span>
        <span class="terminal-bar-title">状态</span>
      </div>
      <div class="terminal-bar-grid">
        <div
          v-for="t in terminals"
          :key="t.name"
          class="terminal-bar-item"
          :class="t.status">
          <span class="terminal-bar-dot" :class="t.status"></span>
          <span class="terminal-bar-name">{{ t.name }}</span>
        </div>
      </div>
    </div>
    <div class="terminal-bar">
      <div class="terminal-bar-header">
        <span class="terminal-bar-title">端子实时</span>
        <span class="terminal-bar-title">状态</span>
      </div>
      <!-- {{ ws.message.value }} -->
      <div
        v-for="(t, index) in coilArr"
        :key="index"
        class="terminal-bar-item"
        :class="{ ok: t, ng: !t }">
        <span class="terminal-bar-dot" :class="{ ok: t, ng: !t }"></span>
        <span class="terminal-bar-name">{{ terminals[index]?.name }}</span>
      </div>
    </div>
    <div class="status-bar">
      <span class="status-text">{{ ws.status }}</span>
      <!-- <span class="status-message" v-if="ws.message">{{ ws.message }}</span> -->
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #051424;
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

.terminal-button {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100px;
  background: #0b1d33;
  border-top: 1px solid #1a2d44;
  border-bottom: 1px solid #1a2d44;
  margin: 0 10px;
  padding: 0 20px;
  flex-shrink: 0;
}

.terminal-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  background: #0b1d33;
  border-top: 1px solid #1a2d44;
  border-bottom: 1px solid #1a2d44;
  padding: 0 20px;
  flex-shrink: 0;
}

.action-buttons {
  display: flex;
  gap: 20px;
  margin-top: 4px;
}

.action-btn {
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid #2a4a68;
  color: #7a8fa0;
  font-size: 40px;
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
.terminal-bar-header {
  display: flex;
  gap: 16px;
  margin-right: 8px;
}

.terminal-bar-title {
  font-size: 11px;
  color: #5a7288;
}

.terminal-bar-title:first-child {
  color: #8fb4d8;
}

.terminal-bar-grid {
  display: flex;
  gap: 12px;
  align-items: center;
}

.terminal-bar-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.terminal-bar-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5a7288;
}

.terminal-bar-dot.ok {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.6);
}

.terminal-bar-dot.ng {
  background: #f87171;
  box-shadow: 0 0 6px rgba(248, 113, 113, 0.6);
}

.terminal-bar-name {
  font-size: 12px;
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
  font-size: 10px;
  color: #34d399;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
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
