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
  /**
   * 曲线采集开关。
   *
   * 与 isAction 分开：isAction 要等动作电源指令回读确认才置位，而曲线要
   * 覆盖上电爬升那段，两者之间隔着一次 Modbus 往返。
   */
  isRecording: Ref<boolean>;
  /**
   * 三相机型的归零判定器：由调用方按三相读数判定是否归零。
   *
   * 注意这里不是 useOperation 的 checkZeroCurrent(isZero)——那个接收布尔
   * 判据，本模块拿不到三相读数，只能委托给包装函数。
   */
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
    isRecording,
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
    let module = data.module;
    switch (module) {
      case "relay":
        handleActionRelays(data);
        break;
      case "expressRelays":
        // 表示
        handleExpressRelays(data);
        break;
      case "‌DCCurrentSampling":
        // 采集220曲线
        handleCollectDCCurve(data);
        break;
      case "resistance":
        handleStartBeforeTestExpress(data);
        break;
      case "variableFrequencyDrive":
        break;
      default:
        console.warn("未知 module:", module);
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

    // 曲线采集用 isRecording：它比 isAction 早，曲线才能覆盖上电爬升段
    if (isRecording.value) {
      registerArrA.value = [phaseACurrent.value];
      registerArrB.value = [phaseBCurrent.value];
      registerArrC.value = [phaseCCurrent.value];
      powerArr.value = [phasePower.value];
    }
    // 归零检测用 isAction：电源未确认前不算一次操动，不参与收尾判定
    if (isAction.value) {
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
