import { ref, type Ref } from "vue";

interface useModbusOptions {
  deviceType: Ref<string>;
  // lastCoilArr: Ref<number[]>;
  isThreePhase: Ref<boolean>;
  // speakDelayTime: Ref<number>;
  // temperature: Ref<number>;
  // phaseACurrent: Ref<number>;
  // phaseBCurrent: Ref<number>;
  // phaseCCurrent: Ref<number>;
  // phasePower: Ref<number>;
  // registerArrA: Ref<number[]>;
  // registerArrB: Ref<number[]>;
  // registerArrC: Ref<number[]>;
  // powerArr: Ref<number[]>;
  isAction: Ref<boolean>;
  checkZeroCurrent: () => void;
  handleActionRelays: (data: Record<string, string | number>) => void;
  handleExpressRelays: (data: Record<string, string | number>) => void;
  handleCollectDCCurve: (data: Record<string, string | number>) => void;
  handleStartBeforeTestExpress: (data: Record<string, string | number>) => void;
  speak: (message: string) => void;
  handleCalculate: (value: number, divisor: number) => number;
}

export const useModbus = (option: useModbusOptions) => {
  const {
    deviceType,
    isAction,
    isThreePhase,
    checkZeroCurrent,
    handleActionRelays,
    handleExpressRelays,
    handleCollectDCCurve,
    handleStartBeforeTestExpress,
    speak,
    handleCalculate,
  } = option;

  const lastCoilArr = ref<number[]>([]);
  const speakDelayTime = ref<number>(0);
  const temperature = ref<number>(0);
  const phaseACurrent = ref<number>(0);
  const phaseBCurrent = ref<number>(0);
  const phaseCCurrent = ref<number>(0);
  const phasePower = ref<number>(0);
  // 三相电流寄存器数组（用 ref 而非 computed，确保每次赋值新数组引用，watch 才能检测到变化）
  const registerArrA = ref<number[]>([]);
  const registerArrB = ref<number[]>([]);
  const registerArrC = ref<number[]>([]);
  const powerArr = ref<number[]>([]);
  const modbusStatus = ref<Record<string, string>>({});

  const funWsStatus = (data: Record<string, string>) => {
    if (!data.connected) {
      lastCoilArr.value = [];
      isThreePhase.value = false;
    }
    if (!data.connected && speakDelayTime.value <= 0) {
      // speak("通讯异常，请检查通讯连接或设备状态");
    }
    speakDelayTime.value++;
    if (speakDelayTime.value >= 7) {
      speakDelayTime.value = 0;
    }
    modbusStatus.value = data;
  };
  const funWsRealData = (data: Record<string, string | number>) => {
    let unitId = data.unitId;
    switch (unitId) {
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
  return {
    lastCoilArr,
    modbusStatus,
    temperature,
    phaseACurrent,
    phaseBCurrent,
    phaseCCurrent,
    phasePower,
    registerArrA,
    registerArrB,
    registerArrC,
    powerArr,
    funWsStatus,
    funWsRealData,
    funThreePhaseACCollector,
  };
};
