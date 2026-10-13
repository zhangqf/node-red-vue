import { computed, type Ref } from "vue";
import { DEFAULT_CURVE_THRESHOLD, type CurveThreshold } from "@/utils/config";

/**
 * 曲线判定：按 deviceType 取阈值，判定峰值是否落在区间内、末段是否归零。
 * 三相机型取 A/B/C 三路中的最差值作为整体结论。
 */

export interface CurrentJudgeResult {
  ok: boolean;
  peak: number;
  end: number;
  points: number;
}

export interface PowerJudgeResult {
  ok: boolean;
  peak: number;
  end: number;
}

export function useCurveJudge(
  deviceType: Ref<string>,
  curveThresholds: Ref<any[]>,
) {
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

  /** 电流曲线：采样点数达标 + 峰值在区间内 + 末值归零 */
  function judgeCurrentCurve(
    peak: any,
    history: any,
    th: CurveThreshold,
  ): CurrentJudgeResult {
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

  /** 功率曲线：峰值在区间内 + 末值归零 */
  function judgePowerCurve(
    history: number[],
    th: CurveThreshold,
  ): PowerJudgeResult {
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

  return { currentCurveThreshold, judgeCurrentCurve, judgePowerCurve };
}