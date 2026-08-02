<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  title?: string;
  registerArr?: number[];
  registerArrA?: number[];
  registerArrB?: number[];
  registerArrC?: number[];
}>();

const emit = defineEmits<{ start: [type: string] }>();

const MAX_POINTS = 300;

const COLOR_SINGLE = "#4dabf7";
const COLOR_A = "#f04b4b";
const COLOR_B = "#4dabf7";
const COLOR_C = "#51cf66";

function gradient(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeLineSeries(
  name: string,
  data: number[],
  color: string,
  lineWidth: number,
) {
  return {
    name,
    type: "line",
    data,
    smooth: false,
    symbol: "none",
    itemStyle: { color },
    lineStyle: {
      color,
      width: lineWidth,
      shadowBlur: lineWidth >= 2 ? 6 : 4,
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
          { offset: 0, color: gradient(color, 0.18) },
          { offset: 1, color: gradient(color, 0.01) },
        ],
      },
    },
    connectNulls: false,
  };
}

function baseOption(
  xLabels: string[],
  hasData: boolean,
  yMin: number,
  yMax: number,
  padding: number,
  gridTop: number,
) {
  return {
    animationDuration: 0,
    animationEasing: "cubicOut",
    tooltip: hasData
      ? {
          trigger: "axis",
          axisPointer: {
            type: "cross",
            crossStyle: { color: "#3a5670" },
            label: { backgroundColor: "#0b1d33", color: "#e0e8f0" },
          },
          backgroundColor: "rgba(11,29,51,0.96)",
          borderColor: "#2d5280",
          textStyle: { color: "#e0e8f0", fontSize: 12 },
          extraCssText:
            "box-shadow: 0 4px 16px rgba(0,0,0,0.4); border-radius: 6px;",
        }
      : undefined,
    backgroundColor: "transparent",
    grid: { left: 55, right: 20, top: gridTop, bottom: 50 },
    xAxis: {
      type: "category",
      data: hasData ? xLabels : [],
      name: "s",
      nameTextStyle: { color: "#5a7288", fontSize: 10 },
      axisLine: { lineStyle: { color: "#1a2d44" } },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: "rgba(26,45,68,0.5)", type: "dashed" },
      },
      axisLabel: {
        color: "#5a7288",
        fontSize: 10,
        interval: hasData
          ? Math.max(Math.floor((xLabels.length || 1) / 6), 0)
          : 0,
      },
    },
    yAxis: {
      type: "value",
      min: Math.max(0, yMin - padding),
      max: yMax + padding,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: "rgba(26,45,68,0.5)", type: "dashed" },
      },
      axisLabel: {
        color: "#5a7288",
        fontSize: 11,
        formatter: (v: number) => v.toFixed(1),
      },
    },
  };
}

/* ---- 单相图表 ---- */
function buildChartOpt(
  data: number[],
  xLabels: string[],
  chartWidth: number,
  chartHeight: number,
) {
  const hasData = data.length > 0;
  let peak = 0,
    valley = 0;
  if (hasData) {
    peak = Math.max(...data);
    valley = Math.min(...data);
  }

  const maxVal = hasData ? Math.max(...data, 0.01) : 10;
  const minVal = hasData ? Math.min(...data, 0) : 0;
  const padding = (maxVal - minVal) * 0.15 || 0.5;

  const option: any = {
    ...baseOption(xLabels, hasData, minVal, maxVal, padding, 20),
    series: [],
    graphic: [],
  };

  if (hasData) {
    option.series = [makeLineSeries("电流", data, COLOR_SINGLE, 2)];

    if (data.length > 1 && chartWidth > 0) {
      addMarkers(option, data, minVal, maxVal, padding, chartWidth, chartHeight, 55, 20, 50, COLOR_SINGLE, 11);
    }
  }

  return { option, peak, valley };
}

function addMarkers(
  option: any,
  data: number[],
  yMin: number,
  yMax: number,
  padding: number,
  chartWidth: number,
  chartHeight: number,
  gridLeft: number,
  gridTop: number,
  gridBottom: number,
  color: string,
  fontSize: number,
) {
  const G = { left: gridLeft, right: 20, top: gridTop, bottom: gridBottom };
  const gw = chartWidth - G.left - G.right;
  const gh = chartHeight - G.top - G.bottom;
  const yRange = yMax + padding - Math.max(0, yMin - padding) || 1;
  const yBase = Math.max(0, yMin - padding);

  const toX = (i: number) => G.left + (i / (data.length - 1)) * gw;
  const toY = (v: number) => G.top + (1 - (v - yBase) / yRange) * gh;

  const maxV = Math.max(...data);
  const minV = Math.min(...data);
  const maxIdx = data.indexOf(maxV);
  const minIdx = data.indexOf(minV);

  const mk = (idx: number, val: number, label: string, mkColor: string) => {
    option.graphic.push(
      {
        type: "text",
        left: toX(idx) - 24,
        top: toY(val) - 20,
        style: {
          text: `${label} ${val.toFixed(1)}A`,
          fill: "#fff",
          fontSize,
          fontWeight: 600,
          textAlign: "center",
          textShadowBlur: 4,
          textShadowColor: "rgba(0,0,0,0.7)",
        },
        z: 100,
      },
      {
        type: "circle",
        shape: { cx: toX(idx), cy: toY(val), r: 4 },
        style: { fill: mkColor, stroke: "#fff", lineWidth: 2 },
        z: 100,
      },
    );
  };

  mk(maxIdx, maxV, "最大值", color);
  mk(minIdx, minV, "最小值", color);
}

/* ---- 三相合一图表 ---- */
function buildThreePhaseChartOpt(
  dataA: number[],
  dataB: number[],
  dataC: number[],
  xLabels: string[],
  chartWidth: number,
  chartHeight: number,
) {
  const allData = [...dataA, ...dataB, ...dataC];
  const hasData = allData.length > 0;

  let peakA = 0, valleyA = 0, peakB = 0, valleyB = 0, peakC = 0, valleyC = 0;
  if (dataA.length > 0) { peakA = Math.max(...dataA); valleyA = Math.min(...dataA); }
  if (dataB.length > 0) { peakB = Math.max(...dataB); valleyB = Math.min(...dataB); }
  if (dataC.length > 0) { peakC = Math.max(...dataC); valleyC = Math.min(...dataC); }

  const maxVal = hasData ? Math.max(...allData, 0.01) : 10;
  const minVal = hasData ? Math.min(...allData, 0) : 0;
  const padding = (maxVal - minVal) * 0.15 || 0.5;

  const option: any = {
    ...baseOption(xLabels, hasData, minVal, maxVal, padding, 12),
    series: [],
    graphic: [],
  };

  if (hasData) {
    option.series = [
      makeLineSeries("A相电流", dataA, COLOR_A, 1.5),
      makeLineSeries("B相电流", dataB, COLOR_B, 1.5),
      makeLineSeries("C相电流", dataC, COLOR_C, 1.5),
    ];

    if (chartWidth > 0) {
      const G = { left: 55, right: 20, top: 12, bottom: 50 };
      const gw = chartWidth - G.left - G.right;
      const gh = chartHeight - G.top - G.bottom;
      const yRange = maxVal + padding - Math.max(0, minVal - padding) || 1;
      const yBase = Math.max(0, minVal - padding);
      const toX = (i: number, len: number) => G.left + (len > 1 ? i / (len - 1) : 0) * gw;
      const toY = (v: number) => G.top + (1 - (v - yBase) / yRange) * gh;

      const mk = (idx: number, val: number, label: string, mkColor: string, len: number) => {
        if (len < 2) return;
        option.graphic.push(
          {
            type: "text",
            left: toX(idx, len) - 20,
            top: toY(val) - 18,
            style: {
              text: `${label} ${val.toFixed(1)}A`,
              fill: "#fff",
              fontSize: 9,
              fontWeight: 600,
              textAlign: "center",
              textShadowBlur: 4,
              textShadowColor: "rgba(0,0,0,0.7)",
            },
            z: 100,
          },
          {
            type: "circle",
            shape: { cx: toX(idx, len), cy: toY(val), r: 3 },
            style: { fill: mkColor, stroke: "#fff", lineWidth: 1.5 },
            z: 100,
          },
        );
      };

      mk(dataA.indexOf(peakA), peakA, "A max", COLOR_A, dataA.length);
      mk(dataA.indexOf(valleyA), valleyA, "A min", COLOR_A, dataA.length);
      mk(dataB.indexOf(peakB), peakB, "B max", COLOR_B, dataB.length);
      mk(dataB.indexOf(valleyB), valleyB, "B min", COLOR_B, dataB.length);
      mk(dataC.indexOf(peakC), peakC, "C max", COLOR_C, dataC.length);
      mk(dataC.indexOf(valleyC), valleyC, "C min", COLOR_C, dataC.length);
    }
  }

  return { option, peakA, valleyA, peakB, valleyB, peakC, valleyC };
}

/* ---- 单相模式 ---- */
const isThreePhase = computed(
  () =>
    props.registerArrA != null ||
    props.registerArrB != null ||
    props.registerArrC != null,
);

const history = ref<number[]>([]);
const xLabels = ref<string[]>([]);
const startTime = ref<number>(0);
const peakSingle = ref(0);
const valleySingle = ref(0);
const containerSingle = ref<HTMLElement | null>(null);
const sizeSingle = ref({ width: 0, height: 0 });

watch(
  () => props.registerArr,
  (arr) => {
    if (!arr || arr.length < 1) return;
    const current = arr[0];
    const now = performance.now();
    if (!startTime.value) startTime.value = now;
    const elapsed = ((now - startTime.value) / 1000).toFixed(1);
    history.value = [...history.value.slice(-MAX_POINTS + 1), current];
    xLabels.value = [...xLabels.value.slice(-MAX_POINTS + 1), elapsed];
  },
);

const chartOptSingle = ref<any>({});
let singleTimer: number | null = null;
watch(
  [history, xLabels, sizeSingle],
  () => {
    if (singleTimer != null) return;
    singleTimer = window.setTimeout(() => {
      const { option, peak, valley } = buildChartOpt(
        history.value,
        xLabels.value,
        sizeSingle.value.width,
        sizeSingle.value.height,
      );
      peakSingle.value = peak;
      valleySingle.value = valley;
      chartOptSingle.value = option;
      singleTimer = null;
    }, 150);
  },
  { deep: false },
);

/* ---- 三相模式 ---- */
const historyA = ref<number[]>([]);
const historyB = ref<number[]>([]);
const historyC = ref<number[]>([]);
const xLabels3 = ref<string[]>([]);
const startTime3 = ref<number>(0);

const peakA = ref(0);
const valleyA = ref(0);
const peakB = ref(0);
const valleyB = ref(0);
const peakC = ref(0);
const valleyC = ref(0);

const containerThree = ref<HTMLElement | null>(null);
const sizeThree = ref({ width: 0, height: 0 });

watch(
  () => [props.registerArrA, props.registerArrB, props.registerArrC],
  (arrs) => {
    const [a, b, c] = arrs;
    if (!a || a.length < 1) return;
    const now = performance.now();
    if (!startTime3.value) startTime3.value = now;
    const elapsed = ((now - startTime3.value) / 1000).toFixed(1);
    historyA.value = [...historyA.value.slice(-MAX_POINTS + 1), a[0]];
    historyB.value = [...historyB.value.slice(-MAX_POINTS + 1), b?.[0] ?? 0];
    historyC.value = [...historyC.value.slice(-MAX_POINTS + 1), c?.[0] ?? 0];
    xLabels3.value = [...xLabels3.value.slice(-MAX_POINTS + 1), elapsed];
  },
);

const chartOptThree = ref<any>({});
let threeTimer: number | null = null;
watch(
  [historyA, historyB, historyC, xLabels3, sizeThree],
  () => {
    if (threeTimer != null) return;
    threeTimer = window.setTimeout(() => {
      const {
        option,
        peakA: pa,
        valleyA: va,
        peakB: pb,
        valleyB: vb,
        peakC: pc,
        valleyC: vc,
      } = buildThreePhaseChartOpt(
        historyA.value,
        historyB.value,
        historyC.value,
        xLabels3.value,
        sizeThree.value.width,
        sizeThree.value.height,
      );
      peakA.value = pa;
      valleyA.value = va;
      peakB.value = pb;
      valleyB.value = vb;
      peakC.value = pc;
      valleyC.value = vc;
      chartOptThree.value = option;
      threeTimer = null;
    }, 150);
  },
  { deep: false },
);

/* ---- ResizeObserver ---- */
function useChartSize(
  container: typeof containerSingle,
  sizeRef: { value: { width: number; height: number } },
) {
  let obs: ResizeObserver | null = null;
  onMounted(() => {
    watch(
      container,
      (el) => {
        if (obs) { obs.disconnect(); obs = null; }
        if (!el) return;
        const fn = () => {
          sizeRef.value = { width: el.clientWidth, height: el.clientHeight };
        };
        fn();
        obs = new ResizeObserver(fn);
        obs.observe(el);
      },
      { immediate: true },
    );
  });
  onUnmounted(() => obs?.disconnect());
}

useChartSize(containerSingle, sizeSingle);
useChartSize(containerThree, sizeThree);

function resetSingle() {
  valleySingle.value = 0;
  peakSingle.value = 0;
  xLabels.value = [];
  history.value = [];
  startTime.value = 0;
}

function resetThree() {
  valleyA.value = valleyB.value = valleyC.value = 0;
  peakA.value = peakB.value = peakC.value = 0;
  xLabels3.value = [];
  historyA.value = historyB.value = historyC.value = [];
  startTime3.value = 0;
}

const handleStart = () => {
  if (isThreePhase.value) resetThree();
  else resetSingle();
  emit("start", "start");
};

const resetData = () => {
  if (isThreePhase.value) resetThree();
  else resetSingle();
};

defineExpose({
  peakA, valleyA, peakB, valleyB, peakC, valleyC,
  peakSingle, valleySingle,
  isThreePhase,
  resetSingle, resetThree, resetData,
  currentHistory: history, xLabels,
  currentHistoryA: historyA, currentHistoryB: historyB, currentHistoryC: historyC,
  xLabels3,
});
</script>

<template>
  <div class="curve-panel">
    <div class="panel-header">
      <span class="panel-title">{{ title || "电流曲线" }}</span>
    </div>

    <div v-if="!isThreePhase" ref="containerSingle" class="chart-container">
      <v-chart :option="chartOptSingle" autoresize />
    </div>

    <div v-else ref="containerThree" class="chart-container">
      <v-chart :option="chartOptThree" autoresize />
    </div>

    <div class="params-row" v-if="!isThreePhase">
      <div class="param">
        <span class="param-label">电流峰值</span>
        <span class="param-value">{{ peakSingle }}</span>
      </div>
      <div class="param">
        <span class="param-label">电流谷值</span>
        <span class="param-value">{{ valleySingle }}</span>
      </div>
    </div>

    <div class="params-row three-phase-params" v-else>
      <div class="param">
        <span class="param-label">A峰值</span>
        <span class="param-value a">{{ peakA }}</span>
      </div>
      <div class="param">
        <span class="param-label">A谷值</span>
        <span class="param-value a">{{ valleyA }}</span>
      </div>
      <div class="param">
        <span class="param-label">B峰值</span>
        <span class="param-value b">{{ peakB }}</span>
      </div>
      <div class="param">
        <span class="param-label">B谷值</span>
        <span class="param-value b">{{ valleyB }}</span>
      </div>
      <div class="param">
        <span class="param-label">C峰值</span>
        <span class="param-value c">{{ peakC }}</span>
      </div>
      <div class="param">
        <span class="param-label">C谷值</span>
        <span class="param-value c">{{ valleyC }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.curve-panel {
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

.params-row {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid #1a2d44;
  flex-wrap: wrap;
}

.three-phase-params {
  gap: 8px 14px;
}

.param {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.param-label {
  font-size: 11px;
  color: #5a7288;
}

.param-value {
  font-size: 15px;
  font-weight: 600;
  color: #bccfde;
}

.param-value.a { color: #f04b4b; }
.param-value.b { color: #4dabf7; }
.param-value.c { color: #51cf66; }
</style>
