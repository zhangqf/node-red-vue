<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  powerKw?: number;
  powerValue?: number;
  startPower?: string;
  convertPower?: string;
  lockPower?: string;
  curveData?: { action: number[]; convert: number[]; reference: number[] };
}>();

const actionCurve = computed(
  () => props.curveData?.action || generateMockCurve(0.3, 4.2, 1.5),
);
const convertCurve = computed(
  () => props.curveData?.convert || generateMockCurve(0.4, 3.8, 1.2),
);
const referenceCurve = computed(
  () => props.curveData?.reference || generateMockCurve(0.35, 4.0, 1.4),
);

function generateMockCurve(
  startRatio: number,
  peak: number,
  endVal: number,
): number[] {
  const points: number[] = [];
  for (let i = 0; i < 60; i++) {
    const x = i / 59;
    if (x < 0.1) points.push((x / 0.1) * startRatio * peak);
    else if (x < 0.3)
      points.push(
        startRatio * peak +
          Math.sin(((x - 0.1) / 0.2) * Math.PI) * (peak - startRatio * peak),
      );
    else if (x < 0.65)
      points.push(
        peak + Math.sin(((x - 0.3) / 0.35) * Math.PI) * (peak * 0.15),
      );
    else
      points.push(peak * 0.25 + (endVal - peak * 0.25) * ((x - 0.65) / 0.35));
  }
  return points;
}

function renderCurve(points: number[], color: string): string {
  const maxVal = Math.max(...points, 0.1);
  const w = 320;
  const h = 100;
  return points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (v / maxVal) * h;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

const gridLines = (() => {
  const lines: string[] = [];
  for (let i = 1; i < 4; i++) lines.push(`M0,${i * 25} L320,${i * 25}`);
  for (let i = 1; i < 8; i++) lines.push(`M${i * 40},0 L${i * 40},100`);
  return lines.join(" ");
})();
</script>

<template>
  <div class="curve-panel">
    <div class="panel-header">
      <span class="panel-title">功率曲线</span>
    </div>

    <div class="reading-row">
      <span class="reading-value"
        >{{ powerKw || "4.19" }}<span class="reading-unit">千瓦</span></span
      >
      <span class="reading-sub">{{ powerValue?.toFixed(2) || "3.14" }}</span>
    </div>

    <div class="params-row">
      <div class="param">
        <span class="param-label">启动功率</span>
        <span class="param-value">{{ startPower || "09" }}</span>
      </div>
      <div class="param">
        <span class="param-label">转换功率</span>
        <span class="param-value">{{ convertPower || "000" }}</span>
      </div>
      <div class="param">
        <span class="param-label">锁闭功率</span>
        <span class="param-value">{{ lockPower || "0" }}</span>
      </div>
    </div>

    <div class="curves">
      <div class="curve-row">
        <span class="curve-label">一动作曲线</span>
        <svg viewBox="0 0 320 100" class="curve-svg">
          <path
            :d="gridLines"
            fill="none"
            stroke="rgba(90,146,208,0.08)"
            stroke-width="0.5" />
          <path
            :d="renderCurve(actionCurve, '#5a92d0')"
            fill="none"
            stroke="#5a92d0"
            stroke-width="1.5" />
        </svg>
      </div>
      <div class="curve-row">
        <span class="curve-label">一条换曲级</span>
        <svg viewBox="0 0 320 100" class="curve-svg">
          <path
            :d="gridLines"
            fill="none"
            stroke="rgba(90,146,208,0.08)"
            stroke-width="0.5" />
          <path
            :d="renderCurve(convertCurve, '#ffd93d')"
            fill="none"
            stroke="#ffd93d"
            stroke-width="1.5" />
        </svg>
      </div>
      <div class="curve-row">
        <span class="curve-label">—参老曲级</span>
        <svg viewBox="0 0 320 100" class="curve-svg">
          <path
            :d="gridLines"
            fill="none"
            stroke="rgba(90,146,208,0.08)"
            stroke-width="0.5" />
          <path
            :d="renderCurve(referenceCurve, '#6bcb77')"
            fill="none"
            stroke="#6bcb77"
            stroke-width="1.5" />
        </svg>
      </div>
    </div>

    <!-- <div class="action-section">
      <div class="action-header">
        <span class="action-title">当前</span>
        <span class="action-title">状态</span>
      </div>
      <div class="action-buttons">
        <button class="action-btn active">定操</button>
        <button class="action-btn">反操</button>
      </div>
    </div> -->
  </div>
</template>

<style scoped>
.curve-panel {
  flex: 1;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
}

.reading-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.reading-value {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.reading-unit {
  font-size: 12px;
  font-weight: 400;
  color: #7a8fa0;
  margin-left: 2px;
}

.reading-sub {
  font-size: 14px;
  color: #7a8fa0;
}

.params-row {
  display: flex;
  gap: 12px;
}

.param {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.param-label {
  font-size: 10px;
  color: #5a7288;
}

.param-value {
  font-size: 14px;
  font-weight: 600;
  color: #bccfde;
}

.curves {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.curve-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.curve-label {
  font-size: 10px;
  color: #5a7288;
  white-space: nowrap;
  width: 80px;
}

.curve-svg {
  flex: 1;
  height: 36px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.action-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  padding: 8px;
}

.action-header {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
}

.action-title {
  font-size: 12px;
  color: #e0e8f0;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.action-btn {
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid #2a4a68;
  color: #7a8fa0;
  font-size: 16px;
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

.action-btn:hover:not(.active) {
  border-color: #5a92d0;
  color: #bccfde;
}
</style>
