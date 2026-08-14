<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  totalPower?: number;
  powerArr?: number[];
  powerKw?: number;
}>();

const MAX_POINTS = 300;

function gradient(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---- 功率历史 ---- */
const history = ref<number[]>([]);
const xLabels = ref<string[]>([]);
const startTime = ref(0);

watch(
  () => props.powerArr,
  (arr) => {
    if (!arr || arr.length < 1) return;
    const now = performance.now();
    if (!startTime.value) startTime.value = now;
    const elapsed = ((now - startTime.value) / 1000).toFixed(1);
    history.value = [...history.value.slice(-MAX_POINTS + 1), arr[0]];
    xLabels.value = [...xLabels.value.slice(-MAX_POINTS + 1), elapsed];
  },
);

/* ---- ResizeObserver ---- */
const container = ref<HTMLElement | null>(null);
const chartSize = ref({ width: 0, height: 0 });

onMounted(() => {
  watch(
    container,
    (el) => {
      if (!el) return;
      const fn = () => {
        chartSize.value = { width: el.clientWidth, height: el.clientHeight };
      };
      fn();
      const obs = new ResizeObserver(fn);
      obs.observe(el);
      onUnmounted(() => obs.disconnect());
    },
    { immediate: true },
  );
});

/* ---- ECharts option ---- */
const COLOR = "#4dabf7";
const chartOpt = ref<any>({});
let chartTimer: number | null = null;
watch(
  [history, xLabels, chartSize],
  () => {
    if (chartTimer != null) return;
    chartTimer = window.setTimeout(() => {
      const hasData = history.value.length > 0;

      const maxVal = hasData ? Math.max(...history.value, 0.01) : 100;
      const minVal = hasData ? Math.min(...history.value, 0) : 0;
      const padding = (maxVal - minVal) * 0.15 || 10;

      const makeLine = (name: string, data: number[], color: string) => ({
        name,
        type: "line",
        data,
        smooth: false,
        symbol: "none",
        color,
        lineStyle: {
          color,
          width: 2,
          shadowBlur: 6,
          shadowColor: gradient(color, 0.35),
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
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
        tooltip: hasData
          ? {
              trigger: "axis",
              backgroundColor: "rgba(11,29,51,0.96)",
              borderColor: "#2d5280",
              textStyle: { color: "#e0e8f0", fontSize: 11 },
              extraCssText:
                "box-shadow: 0 4px 16px rgba(0,0,0,0.4); border-radius: 6px;",
            }
          : undefined,
        backgroundColor: "transparent",
        grid: { left: 48, right: 16, top: 10, bottom: 24 },
        xAxis: {
          type: "category",
          data: hasData ? xLabels.value : [],
          axisLine: { lineStyle: { color: "#1a2d44" } },
          axisTick: { show: false },
          splitLine: {
            show: true,
            lineStyle: { color: "rgba(26,45,68,0.5)", type: "dashed" },
          },
          axisLabel: {
            color: "#5a7288",
            fontSize: 9,
            interval: hasData
              ? Math.max(Math.floor((xLabels.value.length || 1) / 5), 0)
              : 0,
          },
        },
        yAxis: {
          type: "value",
          min: Math.max(0, minVal - padding),
          max: maxVal + padding,
          splitNumber: 3,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: {
            show: true,
            lineStyle: { color: "rgba(26,45,68,0.5)", type: "dashed" },
          },
          axisLabel: {
            color: "#5a7288",
            fontSize: 10,
            formatter: (v: number) => v.toFixed(2) + "KW",
          },
        },
        series: hasData ? [makeLine("功率", history.value, COLOR)] : [],
        graphic: [],
      };

      // max/min 标记
      if (hasData && chartSize.value.width > 0) {
        const G = { left: 48, right: 16, top: 10, bottom: 24 };
        const gw = chartSize.value.width - G.left - G.right;
        const gh = chartSize.value.height - G.top - G.bottom;
        const yMin = Math.max(0, minVal - padding);
        const yRange = maxVal + padding - yMin || 1;
        const toX = (i: number, len: number) =>
          G.left + (len > 1 ? i / (len - 1) : 0) * gw;
        const toY = (v: number) => G.top + (1 - (v - yMin) / yRange) * gh;

        const maxV = Math.max(...history.value);
        const minV = Math.min(...history.value);
        const maxI = history.value.indexOf(maxV);
        const minI = history.value.indexOf(minV);

        opt.graphic.push(
          {
            type: "text",
            left: toX(maxI, history.value.length) - 18,
            top: toY(maxV) - 16,
            style: {
              text: `${maxV.toFixed(2)}KW`,
              fill: "#fff",
              fontSize: 9,
              fontWeight: 600,
              textShadowBlur: 3,
              textShadowColor: "rgba(0,0,0,0.7)",
            },
            z: 100,
          },
          {
            type: "circle",
            shape: { cx: toX(maxI, history.value.length), cy: toY(maxV), r: 3 },
            style: { fill: COLOR, stroke: "#fff", lineWidth: 1.5 },
            z: 100,
          },
          {
            type: "text",
            left: toX(minI, history.value.length) - 18,
            top: toY(minV) + 4,
            style: {
              text: `${minV.toFixed(2)}KW`,
              fill: "#fff",
              fontSize: 9,
              fontWeight: 600,
              textShadowBlur: 3,
              textShadowColor: "rgba(0,0,0,0.7)",
            },
            z: 100,
          },
          {
            type: "circle",
            shape: { cx: toX(minI, history.value.length), cy: toY(minV), r: 3 },
            style: { fill: COLOR, stroke: "#fff", lineWidth: 1.5 },
            z: 100,
          },
        );
      }

      chartOpt.value = opt;
      chartTimer = null;
    }, 150);
  },
  { deep: false },
);

function resetData() {
  history.value = [];
  xLabels.value = [];
  startTime.value = 0;
}

defineExpose({ resetData, history, xLabels });
</script>

<template>
  <div class="power-panel">
    <div class="panel-header">
      <span class="panel-title">功率</span>
    </div>
    <div ref="container" class="chart-container">
      <v-chart :option="chartOpt" autoresize />
    </div>
    <!-- <div class="power-readings">
      <div class="total-row">
        <span class="total-label">总功率</span>
        <span class="total-value">{{ totalPower }}W</span>
        <span class="total-kw"
          >({{ ((totalPower ?? 0) / 1000).toFixed(2) }}KW)</span
        >
      </div>
    </div> -->
  </div>
</template>

<style scoped>
.power-panel {
  flex: 1;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
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

.total-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
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
</style>
