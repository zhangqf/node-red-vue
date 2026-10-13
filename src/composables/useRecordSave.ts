import { toRaw, type Ref } from "vue";
import { HTTP_URL } from "@/config/config";
import { fetchWithTimeout as fetch } from "@/utils/http";
import { DC_RECORD_TYPES, FC_RECORD_TYPES } from "@/utils/config";
import { useToast } from "./useToast";
import type { useCurveJudge } from "./useCurveJudge";

/** CurrentCurve 通过 defineExpose 暴露的读数（节选） */
export interface CurveExpose {
  isThreePhase: boolean;
  peakSingle: number;
  valleySingle: number;
  currentHistory: number[];
  xLabels: string[];
  peakA: number;
  valleyA: number;
  peakB: number;
  valleyB: number;
  peakC: number;
  valleyC: number;
  currentHistoryA: number[];
  currentHistoryB: number[];
  currentHistoryC: number[];
  xLabels3: string[];
}

/** PowerCurve 通过 defineExpose 暴露的读数 */
export interface PowerExpose {
  history: number[];
  xLabels: string[];
}

interface UseRecordSaveOptions {
  device: Ref<{ name: string }>;
  combinationName: Ref<string>;
  configName: Ref<string>;
  testResults: Ref<any[]>;
  /** 启动前测试结果。用取值函数传入，避免与 useStartBeforeTest 形成声明顺序依赖 */
  getStartBeforeTestTips: () => any;
  isThreePhase: Ref<boolean>;
  currentCurveRef: Ref<CurveExpose | undefined>;
  powerCurveRef: Ref<PowerExpose | undefined>;
  judge: ReturnType<typeof useCurveJudge>;
  /** 操作日志快照，搭 saveRecord 请求一起落库，不额外发请求 */
  snapshotLog: () => any[];
}

/**
 * 测试记录构建与落库：
 * 把「表示继电器结果 + 电流曲线 + 功率曲线」综合成一个 success/error 结论，
 * 并生成人可读的失败原因，随 /saveRecord 一并提交。
 */
export function useRecordSave(options: UseRecordSaveOptions) {
  const { showToast } = useToast();
  const {
    device,
    combinationName,
    configName,
    testResults,
    getStartBeforeTestTips,
    isThreePhase,
    currentCurveRef,
    powerCurveRef,
    judge,
    snapshotLog,
  } = options;
  const { currentCurveThreshold, judgeCurrentCurve, judgePowerCurve } = judge;

  /** 构建待保存数据（不发请求） */
  const buildRecordData = (relay: "DC" | "FC"): Record<string, any> => {
    const result = toRaw(testResults.value).map((item) => ({
      status: item.status,
      name: item.name,
      relayName: item.relayName,
    }));

    const exposed = currentCurveRef.value;
    let peak: any;
    let valley: any;
    let history: any;
    let xLabels: string[] | undefined;
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

    const pw = powerCurveRef.value;
    const powerJudge =
      isThreePhase.value && pw ? judgePowerCurve(pw.history, th) : null;
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

    const tempData: Record<string, any> = {
      device_name: device.value.name,
      combination_name: combinationName.value,
      config_name: configName.value,
      op_type: relay,
      status,
      fail_reason: reasons.join("；"),
      peak_current: typeof peak === "object" ? JSON.stringify(peak) : peak,
      valley_current:
        typeof valley === "object" ? JSON.stringify(valley) : valley,
      curve_data: history,
      time_data: xLabels,
      result,
    };

    const tips = getStartBeforeTestTips();
    if (tips) {
      tempData.pre_test = {
        direction: tips.direction,
        channels: tips.dcResult.map((r: any) => ({
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
        // 操作日志搭现有这次写入库，不新增接口调用
        body: JSON.stringify({ ...tempData, operationLog: snapshotLog() }),
      });
    } catch (error) {
      console.error(error);
      showToast("保存记录失败", "error");
    }
  };

  /** 保存记录，返回本次操动判定结果 success/error */
  const saveRecord = async (relay: "DC" | "FC") => {
    const tempData = buildRecordData(relay);
    await postRecord(tempData);
    return tempData.status as string;
  };

  return { buildRecordData, saveRecord };
}