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
import {gen32BitArray,handleCalculate,parseWsData,findRelayIndex, startBeforeTestExpress,powerStatusJudgmen,getCircuits} from "@/utils/utils";
import type {WSSTATUS,ActionRelays,TestItem} from "@/utils/interface"
import {relayConfigList,StartPowerConfig,StartBeforeTestConfig,contact24Closed,contact13Closed} from '@/utils/config'



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
const phaseAVoltage = ref(0);
const phaseBVoltage = ref(0);
const phaseCVoltage = ref(0);

const phaseACurrent = ref(0);
const phaseBCurrent = ref(0);
const phaseCCurrent = ref(0);

const phaseAPower = ref(0);
const phaseBPower = ref(0);
const phaseCPower = ref(0);


const testResults = ref<TestItem[]>([]);


const startBeforeLoading = ref(false)

let tempDate = [];

// 寄存器计算属性：永远返回缓存的最新寄存器数据，不会清空
const registerArr = computed(() => lastRegisterArr.value);

// 三相电流寄存器数组（用 ref 而非 computed，确保每次赋值新数组引用，watch 才能检测到变化）
const registerArrA = ref<number[]>([]);
const registerArrB = ref<number[]>([]);
const registerArrC = ref<number[]>([]);

// 三相功率数组
const powerArrA = ref<number[]>([]);
const powerArrB = ref<number[]>([]);
const powerArrC = ref<number[]>([]);



const device = ref({
  name: "",
});
const combinationName = ref("");
const configName = ref("");

const showContactDialog = ref(true);
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
const combinationId = route.params.combinationId as string;
const configId = route.params.configId as string;

const opeModel = route.query.opeModel as string;
const codeName = route.query.name as string;
const indicationRelay = ref<any[]>([]);


const startBeforeTestFinshed = ref(false)
const availableDirections = ref<{ DC: boolean; FC: boolean }>({ DC: false, FC: false })
const diagnosisMessages = ref<string[]>([])


const typeToFieldMap: Record<string, keyof ActionRelays> = {};
relayConfigList.forEach((item) => {
  typeToFieldMap[item.type] = item.field;
});



// 重置锁定
const resetAllLock = () => {
  testResults.value = [];
  Object.keys(lockStatus.value).forEach((key) => {
    lockStatus.value[key] = false;
  });
};

const handleFindCollect = (field:string) => {
  const cfg = configName.value.replace(/(【.+?】)$/,'') 
  return getCircuits(deviceType.value,combinationName.value,cfg,field )
}



/* 表示数据处理 */
const handleWsRelayData = (data: number[]) => {
  const relayData = configActionRelays.value;
  if (!relayData) return;

  const sampleData = indicationRelay.value;
  if (!Array.isArray(sampleData) || sampleData.length < 1) return;

  const realData = data;

  // 在已有的 testResults 基础上更新状态
  testResults.value = testResults.value.map((item) => {
    if (item.type === "empty") return item;

    const field = typeToFieldMap[item.type];
    if (!field) return item;
    const targetArr = relayData[field];
    if (targetArr.length < 1) return item;
   const resCollect = handleFindCollect(field)
   const relayTips = []
   if(item.relayName.length > 0) {
    item.relayName.forEach(v => {
      if(deviceType.value === "ZYJ7") {
         const cfg = configName.value.replace(/(【.+?】)$/,'') 
        switch(cfg) {
          case "SH6":
            if(item.type==="DCBX"){
              return  relayTips.push({[v]:"D7→43-44→D3"})
            }
            if(item.type==="DCCX"){
              return relayTips.push({[v]:"D8→23→13-14→44→D3"})
            }
            relayTips.push({[v]:resCollect[v]})
            break;
          default:
            relayTips.push({[v]:resCollect[v]})
        }
      } else {
        relayTips.push({[v]:resCollect[v]})
      }
    }) 
   }
    const res = findRelayIndex(targetArr, realData, sampleData);
    const img = resCollect.img[field] || ''
    if (!lockStatus.value[item.type] && res.allClosed) {
      lockStatus.value[item.type] = true;
    }
    return {
      ...item,
      relayTips,
      img,
      status: lockStatus.value[item.type] ? true : res.allClosed,
      realCheck: res.allClosed,
    };
  });
};


/* 电源状态 */
const powerStatus = ref({})

/* 动作继电器 */
const handleActionRelays = (data:Record<string, any>) => {
   const rawCoil = Array.isArray(data.data) ? data.data : [];
   const coilArr = rawCoil.map((item: number) => (item ? 1 : 0));
   let idxArr = StartPowerConfig[deviceType.value as keyof typeof StartPowerConfig];
  //  console.log(idxArr)
  
  // 模拟继电器状态
  const tempArr = new Array(32).fill(0)
  tempArr[31] = 1
  tempArr[30] = 1
  powerStatus.value = powerStatusJudgmen(coilArr,idxArr);
  lastCoilArr.value = coilArr.slice(0, terminals.value.length);
}


const startBeforeTestTips = ref<{
  dcResult: any[];
  fcResult: any[];
  allTrue: boolean;
  direction: { DC: boolean; FC: boolean; diagnosis: string[] };
} | null>(null)

/* 表示继电器 */
const handleExpressRelays = (data:Record<string,any>) => {
   if (isAction.value) {
    return  handleWsRelayData(data.data);
    }
}


/* 采集直流曲线 */
const handleCollectDCCurve = (data) => {
  const rawReg = Array.isArray(data.data) ? data.data : [];
    tempDate.unshift(rawReg);

    // 限制最大20条，超出截断
    if (tempDate.length > 20) {
      tempDate = tempDate.slice(0, 20);
    }
    if (isAction.value) {
      tempDate.forEach((element) => {
        lastRegisterArr.value = element;
      });
    }
}

  /*
  启动前测试表示
  */
const handleStartBeforeTestExpress = (data) => {
  const result = startBeforeTestExpress(data.data)
  startBeforeTestTips.value = result
  startBeforeLoading.value = false
  if (result.allTrue) {
    startBeforeTestFinshed.value = true
    availableDirections.value = { DC: result.direction.DC, FC: result.direction.FC }
    diagnosisMessages.value = result.direction.diagnosis
  } else {
    startBeforeTestFinshed.value = false
    availableDirections.value = { DC: false, FC: false }
    diagnosisMessages.value = result.direction.diagnosis
  }
}


const funWsRealData = (data) => {
  const unitId = data.unitId;
  switch (unitId) {
    case 1:
    case 2:
      handleActionRelays(data);
      break;
    case 3:
      // 表示
      handleExpressRelays(data);
      break;
    case 4:
      // 采集直流曲线
      handleCollectDCCurve(data);
      break;
    case 6:
      handleStartBeforeTestExpress(data)
      break;
    default:
      console.warn("未知 unitId:", unitId);
  }
};



const funWsStatus = (data) => {
  if (!data.connected) {
    lastCoilArr.value = [];
    isThreePhase.value = false;
  }
  modbusStatus.value = data;
};



/* 三相采集模块初级处理 */
const funThreePhaseACCollector = (data) => {
  isThreePhase.value = true;
  temperature.value = handleCalculate(data[4], 100);
  phaseAVoltage.value = handleCalculate(data[5], 100);
  phaseBVoltage.value = handleCalculate(data[6], 100);
  phaseCVoltage.value = handleCalculate(data[7], 100);
  phaseACurrent.value = handleCalculate(data[8], 1000);
  phaseBCurrent.value = handleCalculate(data[9], 1000);
  phaseCCurrent.value = handleCalculate(data[10], 1000);
  phaseAPower.value = handleCalculate(data[12], 10000);
  phaseBPower.value = handleCalculate(data[13], 10000);
  phaseCPower.value = handleCalculate(data[14], 10000);
  // 每次创建新数组赋值，确保引用变化，watch 才能检测
  registerArrA.value = [phaseACurrent.value];
  registerArrB.value = [phaseBCurrent.value];
  registerArrC.value = [phaseCCurrent.value];
  powerArrA.value = [phaseAPower.value];
  powerArrB.value = [phaseBPower.value];
  powerArrC.value = [phaseCPower.value];
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



// 三相功率（W = V × I）
const powerA = computed(
  () => +(phaseAVoltage.value * phaseACurrent.value).toFixed(1),
);
const powerB = computed(
  () => +(phaseBVoltage.value * phaseBCurrent.value).toFixed(1),
);
const powerC = computed(
  () => +(phaseCVoltage.value * phaseCCurrent.value).toFixed(1),
);
const totalPower = computed(
  () => +(powerA.value + powerB.value + powerC.value).toFixed(1),
);


const handleContactDialogSelect = (type: string) => {
  selectedContactType.value = type;
  handleContactConfigClick(type);
  showContactDialog.value = false;
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
  } catch (e) {
    console.error("加载配置失败:", e);
    terminals.value = [];
  }
}

watch(active, (newkey) => {
  if (!newkey) return;
  getConfig(newkey);
});


watch(powerStatus?.isRunning,(newKey) => {
  startBeforeTestFinshed.value = !newKey
  if (!newKey) {
    availableDirections.value = { DC: false, FC: false }
    diagnosisMessages.value = []
    startBeforeTestTips.value = null
  }
})

/* 开启电源 */
const handleStart = () => {
  handleDo();
};



/* 启动前测试 */
const handleStartBeforeTest = () => {
  // availableDirections.value = { DC: false, FC: false };
  // startBeforeTestTips.value = null
  testResults.value = []
  startBeforeLoading.value = true
  startBeforeTestTips.value = null;
  diagnosisMessages.value = [];

  availableDirections.value = { DC: false, FC: false };
  const idxArr = StartBeforeTestConfig[deviceType.value as keyof typeof StartBeforeTestConfig];
  
  const result = gen32BitArray([], idxArr);
  
  sendCmd(result, "startBeforeTestRelays");

  initTestResults()
}

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
function initTestResults() {
  const relayData = configActionRelays.value;
  if (!relayData) {
    testResults.value = [];
    return;
  }
  testResults.value = relayConfigList
    .filter((item) => relayData[item.field].length > 0)
    .map((item) => ({
      type: item.type,
      name: item.name,
      status: "NT" as const,
      realCheck: false,
      relayName: relayData[item.field],
    }));

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

const handleContactConfigClick = (type: string) => {
  resetAllLock();
  selectedContactType.value = type;
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




/* 处理继电器动作 */
const handleRelayAction = (key: keyof ActionRelays) => {
  const relay = configActionRelays.value![key];
  batchUpdateTerminal(relay, 1);
  handleDo();
  startRecord();
  setTimeout(async () => {
    batchUpdateTerminal(relay, 0);
    handleDo();
    stopRecord();
    saveRecord(key);
    // 操动结束，回到启动前测试状态
    if (timerId) { clearInterval(timerId); timerId = null }
    nextDoTime.value = 15;
    butItemIsDisable.value = false;
    butItemStatus.value = "";
    startBeforeTestFinshed.value = false;
    // availableDirections.value = { DC: false, FC: false };
    // startBeforeTestTips.value = null
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
  let result = terminals.value.map((item) =>
    item.default_status
  );
  
  let idxArr = StartPowerConfig[deviceType.value as keyof typeof StartPowerConfig];
  if(!powerStatus?.isRunning){
    idxArr = []
  }

  wsSendData.value = gen32BitArray(result,idxArr);
  sendCmd(wsSendData.value, "relays");
};

/* 发送命令 */
function sendCmd(data: number[] | null, type: string) {
  ws.send({ type: type, value: data });
}



const updateConfigData = () => {
  
  wsSendData.value = result;
};

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
  initTestResults();
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
      butItemStatus.value = "";
    }
  }, 1000);
};


/* 设备类型 */
const deviceType = ref("");

/* 获取列表数据 */
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
    deviceType.value = comboData.deviceType || "";
    const configData = await configRes.json();
    // configActionRelays.value = configData.actionRelays || {};
    contact13Closed.value = configData.contact13Closed || {};
    contact24Closed.value = configData.contact24Closed || {};
    configName.value = configData.name || "";
  } catch (e) {
    console.error("加载数据失败:", e);
    throw e;
  }
}

/* 获取代码设备列表 */
async function getCodeDeviceList() {
  try {
    const [comboRes, configRes] = await Promise.all([
      fetch(HTTP_URL + "/getCombination/" + combinationId),
      fetch(HTTP_URL + "/getConfigList/" + configId),
    ]);

    active.value = configId;
    device.value.name = codeName;
    const comboData = await comboRes.json();

    combinationName.value = comboData.name || "";
    deviceType.value = comboData.deviceType || "";

    const configData = await configRes.json();
    // configActionRelays.value = configData.actionRelays || {};
    contact13Closed.value = configData.contact13Closed || {};
    contact24Closed.value = configData.contact24Closed || {};
    configName.value = configData.name || "";
  } catch (e) {
    console.error("加载数据失败:", e);
    throw e;
  }
}

/* 保存记录 */
const saveRecord = async (relay: keyof ActionRelays) => {
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
  const tempData: Record<string, any> = {
    device_name: device.value.name,
    combination_name: combinationName.value,
    config_name: configName.value,
    op_type: relay,
    status: "success",
    peak_current: typeof peak === "object" ? JSON.stringify(peak) : peak,
    valley_current:
      typeof valley === "object" ? JSON.stringify(valley) : valley,
    curve_data: history,
    time_data: xLabels,
    result: data,
  };

  // 启动前测试结果
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

  // 保存功率曲线数据（仅三相时存在）
  if (isThreePhase.value) {
    const pw = powerCurveRef.value;
    if (pw) {
      tempData.power_A = pw.historyA;
      tempData.power_B = pw.historyB;
      tempData.power_C = pw.historyC;
      tempData.power_time = pw.xLabels;
    }
  }

  try {
    const response = await fetch(HTTP_URL + "/saveRecord", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tempData),
    });
    const data = await response.json();
  } catch (error) {
    console.error(error);
    showToast("保存记录失败", "error");
  }
};

onMounted(async () => {
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
      :combination-name="combinationName"
      :device-type="deviceType"
      :config-name="configName"
      :item-config="itemConfig"
      :contact-active="selectedContactType"
      v-model:active="active"
      @contactConfigClick="handleContactConfigClick"
      @back="router.back()" />
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
        :three-phase="isThreePhase"
        :voltage-a="phaseAVoltage"
        :voltage-b="phaseBVoltage"
        :voltage-c="phaseCVoltage"
        :current-a="phaseACurrent"
        :current-b="phaseBCurrent"
        :current-c="phaseCCurrent"
        :power-a="powerA"
        :power-b="powerB"
        :power-c="powerC"
        :total-power="totalPower"
        :power-arr-a="isThreePhase ? powerArrA : undefined"
        :power-arr-b="isThreePhase ? powerArrB : undefined"
        :power-arr-c="isThreePhase ? powerArrC : undefined" />

      <TestResults
        :tests="testResults"
        :modbus-status="modbusStatus"
        :powerStatusIsRunning="powerStatus?.isRunning"
        :isAction="isAction"
        :test-result="startBeforeTestTips"
        :start-before-loading = "startBeforeLoading"
        :available-directions="availableDirections"
        :diagnosis-messages="diagnosisMessages" />
    </div>

    <div class="button-rows">
      <div style="flex: 1; justify-content: center; display: flex; align-items: center"">
        <button class="emergency-btn" @click="handleStart()"  v-if="isShowButtons" >
          {{ powerStatus?.isRunning ? '紧急停止' : '开启电源' }}
        </button>
      </div>
      <div class="action-buttons" style="flex: 1" v-if="isShowButtons &&  powerStatus?.isRunning">
        <button class="action-btn" v-if="!startBeforeTestFinshed" @click="handleStartBeforeTest">启动前测试</button>
        <span class="action-light">
          <span v-if="butItemStatus === 'DC'" class="light light-green"></span>
          <span v-if="butItemStatus === 'FC'" class="light light-yellow"></span>
        </span>
        <button
          v-if="startBeforeTestFinshed && availableDirections.DC"
          class="action-btn"
          :disabled="butItemIsDisable"
          :class="butItemStatus === 'DC' ? 'active' : ''"
          @click="handleOpe('DC')">
          定操
        </button>
        <button
          v-if="startBeforeTestFinshed && availableDirections.FC"
          class="action-btn"
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
      <span>{{ powerStatus.desc }}</span>
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
</style>
