<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  threePhase?: boolean;
  voltageA?: number;
  voltageB?: number;
  voltageC?: number;
  currentA?: number;
  currentB?: number;
  currentC?: number;
  powerA?: number;
  powerB?: number;
  powerC?: number;
  totalPower?: number;
  powerArrA?: number[];
  powerArrB?: number[];
  powerArrC?: number[];
  powerKw?: number;
}>();

const MAX_POINTS = 300;

const COLORS = { A: "#f04b4b", B: "#4dabf7", C: "#51cf66" } as const;

const LEGEND_POWER = {
  data: ["A相功率", "B相功率", "C相功率"],
  bottom: 0, left: 48,
  textStyle: { color: "#8fb4d8", fontSize: 10 },
  icon: "roundRect",
  itemWidth: 14, itemHeight: 8,
} as const;

function gradient(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---- 功率历史 ---- */
const historyA = ref<number[]>([]);
const historyB = ref<number[]>([]);
const historyC = ref<number[]>([]);
const xLabels = ref<string[]>([]);
const startTime = ref(0);

watch(
  () => [props.powerArrA, props.powerArrB, props.powerArrC],
  (arrs) => {
    const [a, b, c] = arrs;
    if (!a || a.length < 1) return;
    const now = performance.now();
    if (!startTime.value) startTime.value = now;
    const elapsed = ((now - startTime.value) / 1000).toFixed(1);
    historyA.value = [...historyA.value.slice(-MAX_POINTS + 1), a[0]];
    historyB.value = [...historyB.value.slice(-MAX_POINTS + 1), b?.[0] ?? 0];
    historyC.value = [...historyC.value.slice(-MAX_POINTS + 1), c?.[0] ?? 0];
    xLabels.value = [...xLabels.value.slice(-MAX_POINTS + 1), elapsed];
  },
);

/* ---- ResizeObserver ---- */
const container = ref<HTMLElement | null>(null);
const chartSize = ref({ width: 0, height: 0 });

onMounted(() => {
  watch(container, (el) => {
    if (!el) return;
    const fn = () => { chartSize.value = { width: el.clientWidth, height: el.clientHeight }; };
    fn();
    const obs = new ResizeObserver(fn);
    obs.observe(el);
    onUnmounted(() => obs.disconnect());
  }, { immediate: true });
});

/* ---- ECharts option（节流更新，避免高频重绘阻塞交互） ---- */
const chartOpt = ref<any>({});
let chartTimer: number | null = null;
watch(
  [historyA, historyB, historyC, xLabels, chartSize],
  () => {
    if (chartTimer != null) return;
    chartTimer = window.setTimeout(() => {
  const allData = [...historyA.value, ...historyB.value, ...historyC.value];
  const hasData = allData.length > 0;

  const maxVal = hasData ? Math.max(...allData, 0.01) : 100;
  const minVal = hasData ? Math.min(...allData, 0) : 0;
  const padding = (maxVal - minVal) * 0.15 || 10;

  const makeLine = (name: string, data: number[], color: string) => ({
    name,
    type: "line",
    data,
    smooth: false,
    symbol: "none",
    color,
    lineStyle: { color, width: 1.5, shadowBlur: 4, shadowColor: gradient(color, 0.35) },
    areaStyle: {
      color: {
        type: "linear", x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: gradient(color, 0.15) },
          { offset: 1, color: gradient(color, 0.01) },
        ],
      },
    },
    connectNulls: false,
  });

  const opt: any = {
    animationDuration: 0,
    animationEasing: "cubicOut",
    tooltip: hasData ? {
      trigger: "axis",
      backgroundColor: "rgba(11,29,51,0.96)",
      borderColor: "#2d5280",
      textStyle: { color: "#e0e8f0", fontSize: 11 },
      extraCssText: "box-shadow: 0 4px 16px rgba(0,0,0,0.4); border-radius: 6px;",
    } : undefined,
    backgroundColor: "transparent",
    grid: { left: 48, right: 16, top: 10, bottom: 36 },
    xAxis: {
      type: "category",
      data: hasData ? xLabels.value : [],
      axisLine: { lineStyle: { color: "#1a2d44" } },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: "rgba(26,45,68,0.5)", type: "dashed" } },
      axisLabel: { color: "#5a7288", fontSize: 9, interval: hasData ? Math.max(Math.floor((xLabels.value.length || 1) / 5), 0) : 0 },
    },
    yAxis: {
      type: "value",
      min: Math.max(0, minVal - padding),
      max: maxVal + padding,
      splitNumber: 3,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: "rgba(26,45,68,0.5)", type: "dashed" } },
      axisLabel: { color: "#5a7288", fontSize: 10, formatter: (v: number) => v.toFixed(0) + "W" },
    },
    legend: hasData ? LEGEND_POWER : undefined,
    series: hasData ? [
      makeLine("A相功率", historyA.value, COLORS.A),
      makeLine("B相功率", historyB.value, COLORS.B),
      makeLine("C相功率", historyC.value, COLORS.C),
    ] : [],
    graphic: [],
  };

  // max/min 标记
  if (hasData && chartSize.value.width > 0) {
    const G = { left: 48, right: 16, top: 10, bottom: 36 };
    const gw = chartSize.value.width - G.left - G.right;
    const gh = chartSize.value.height - G.top - G.bottom;
    const yMin = Math.max(0, minVal - padding);
    const yRange = (maxVal + padding) - yMin || 1;
    const toX = (i: number, len: number) => G.left + (len > 1 ? i / (len - 1) : 0) * gw;
    const toY = (v: number) => G.top + (1 - (v - yMin) / yRange) * gh;

    const phases = [
      { data: historyA.value, color: COLORS.A, tag: "A" },
      { data: historyB.value, color: COLORS.B, tag: "B" },
      { data: historyC.value, color: COLORS.C, tag: "C" },
    ];

    for (const p of phases) {
      if (p.data.length < 2) continue;
      const maxV = Math.max(...p.data);
      const minV = Math.min(...p.data);
      const maxI = p.data.indexOf(maxV);
      const minI = p.data.indexOf(minV);

      opt.graphic.push(
        { type: "text", left: toX(maxI, p.data.length) - 18, top: toY(maxV) - 16,
          style: { text: `${p.tag}${maxV.toFixed(1)}W`, fill: "#fff", fontSize: 9, fontWeight: 600,
            textShadowBlur: 3, textShadowColor: "rgba(0,0,0,0.7)" }, z: 100 },
        { type: "circle", shape: { cx: toX(maxI, p.data.length), cy: toY(maxV), r: 3 },
          style: { fill: p.color, stroke: "#fff", lineWidth: 1.5 }, z: 100 },
        { type: "text", left: toX(minI, p.data.length) - 18, top: toY(minV) + 4,
          style: { text: `${p.tag}${minV.toFixed(1)}W`, fill: "#fff", fontSize: 9, fontWeight: 600,
            textShadowBlur: 3, textShadowColor: "rgba(0,0,0,0.7)" }, z: 100 },
        { type: "circle", shape: { cx: toX(minI, p.data.length), cy: toY(minV), r: 3 },
          style: { fill: p.color, stroke: "#fff", lineWidth: 1.5 }, z: 100 },
      );
    }
  }

  chartOpt.value = opt;
  chartTimer = null;
}, 150);
}, { deep: false });

function resetData() {
  historyA.value = historyB.value = historyC.value = [];
  xLabels.value = [];
  startTime.value = 0;
}

defineExpose({ resetData, historyA, historyB, historyC, xLabels });
</script>

<template>
  <div class="power-panel" :class="{ 'has-chart': threePhase }">
    <div class="panel-header">
      <span class="panel-title">功率</span>
    </div>

    <!-- 三相：曲线 + 读数 -->
    <template v-if="threePhase">
      <div ref="container" class="chart-container">
        <v-chart :option="chartOpt" autoresize />
      </div>
      <div class="power-readings">
        <div class="phase-power-row">
          <span class="phase-tag a">A相</span>
          <span class="phase-formula">{{ voltageA?.toFixed(1) }}V × {{ currentA?.toFixed(2) }}A</span>
          <span class="phase-result a">{{ powerA }}W</span>
        </div>
        <div class="phase-power-row">
          <span class="phase-tag b">B相</span>
          <span class="phase-formula">{{ voltageB?.toFixed(1) }}V × {{ currentB?.toFixed(2) }}A</span>
          <span class="phase-result b">{{ powerB }}W</span>
        </div>
        <div class="phase-power-row">
          <span class="phase-tag c">C相</span>
          <span class="phase-formula">{{ voltageC?.toFixed(1) }}V × {{ currentC?.toFixed(2) }}A</span>
          <span class="phase-result c">{{ powerC }}W</span>
        </div>
        <div class="total-row">
          <span class="total-label">总功率</span>
          <span class="total-value">{{ totalPower }}W</span>
          <span class="total-kw">({{ ((totalPower ?? 0) / 1000).toFixed(2) }}kW)</span>
        </div>
      </div>
    </template>

    <!-- 单相：无功率 -->
    <div v-else class="empty-state">
      <span class="empty-text">—</span>
    </div>
  </div>
</template>

<style scoped>
.power-panel {
  flex: 0 0 auto;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  min-width: 180px;
  overflow: hidden;
}

.power-panel.has-chart {
  flex: 1;
  min-width: 0;
}

.panel-header {
  padding: 10px 16px;
  border-bottom: 1px solid #1a2d44;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
}

.chart-container {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.power-readings {
  display: flex;
  flex-direction: column;
  padding: 6px 14px 10px;
  gap: 4px;
  border-top: 1px solid #1a2d44;
  flex-shrink: 0;
}

.phase-power-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.phase-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 3px;
  flex-shrink: 0;
}
.phase-tag.a { color: #f04b4b; background: rgba(240,75,75,0.12); }
.phase-tag.b { color: #4dabf7; background: rgba(77,171,247,0.12); }
.phase-tag.c { color: #51cf66; background: rgba(81,207,102,0.12); }

.phase-formula {
  font-size: 10px;
  color: #7a8fa0;
  flex: 1;
}

.phase-result {
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.phase-result.a { color: #f04b4b; }
.phase-result.b { color: #4dabf7; }
.phase-result.c { color: #51cf66; }

.total-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid #1a2d44;
  margin-top: 2px;
}

.total-label {
  font-size: 10px;
  color: #5a7288;
}

.total-value {
  font-size: 16px;
  font-weight: 700;
  color: #ffd93d;
}

.total-kw {
  font-size: 10px;
  color: #7a8fa0;
}

/* 单相空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.empty-text {
  font-size: 24px;
  color: #3a4a5a;
}
</style>
