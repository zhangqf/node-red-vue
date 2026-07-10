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

const COLORS_SINGLE = {
  parabolic: "#f04b4b",
  flat: "#4dabf7",
  square: "#51cf66",
};

const COLORS_A = {
  parabolic: "#f04b4b",
  flat: "#e88b8b",
  square: "#c0392b",
};

const COLORS_B = {
  parabolic: "#4dabf7",
  flat: "#74c0fc",
  square: "#1c7ed6",
};

const COLORS_C = {
  parabolic: "#51cf66",
  flat: "#8ce99a",
  square: "#2f9e44",
};

type PhaseColors = typeof COLORS_SINGLE;

// 稳定的 legend 配置引用，避免每次新建对象导致 ECharts 重置选中状态
const LEGEND_SINGLE = {
  data: ["启动电流", "工作电流", "摩擦电流"],
  bottom: 0,
  left: 55,
  textStyle: { color: "#8fb4d8", fontSize: 11 },
  icon: "roundRect",
} as const;

const LEGEND_THREE = {
  data: [
    "A-启动电流", "A-工作电流", "A-摩擦电流",
    "B-启动电流", "B-工作电流", "B-摩擦电流",
    "C-启动电流", "C-工作电流", "C-摩擦电流",
  ],
  bottom: 0,
  left: 55,
  type: "scroll",
  textStyle: { color: "#8fb4d8", fontSize: 10 },
  icon: "roundRect",
  itemWidth: 14,
  itemHeight: 8,
} as const;

function gradient(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---- 共享：电流曲线分类 ---- */
function classifyData(data: number[]): string[] {
  const HALF_WIN = 12;
  const rawLabels = data.map((_, i) => {
    const ws = Math.max(0, i - HALF_WIN);
    const we = Math.min(data.length - 1, i + HALF_WIN);
    const win = data.slice(ws, we + 1);
    if (win.length < 6) return "flat";

    const wRange = Math.max(...win) - Math.min(...win);

    let largeJumps = 0;
    let signChanges = 0;
    let lastSign = 0;
    for (let j = 1; j < win.length; j++) {
      const d = win[j] - win[j - 1];
      if (d > 1.0) {
        largeJumps++;
        if (lastSign < 0) signChanges++;
        lastSign = 1;
      } else if (d < -1.0) {
        largeJumps++;
        if (lastSign > 0) signChanges++;
        lastSign = -1;
      }
    }
    if (largeJumps >= 2 && signChanges >= 1 && signChanges / largeJumps >= 0.4)
      return "square";
    if (wRange < 0.2) return "flat";

    const diffs: number[] = [];
    for (let j = 1; j < win.length; j++) diffs.push(win[j] - win[j - 1]);
    const dd: number[] = [];
    for (let j = 1; j < diffs.length; j++) dd.push(diffs[j] - diffs[j - 1]);
    const pos = dd.filter((d) => d > 0).length;
    const neg = dd.filter((d) => d < 0).length;
    if (Math.max(pos, neg) >= dd.length * 0.45 && wRange > 1)
      return "parabolic";
    return "flat";
  });

  // 二次修正：低波动的 parabolic → flat
  for (let i = 0; i < rawLabels.length; i++) {
    if (rawLabels[i] === "parabolic") {
      const ls = Math.max(0, i - 2);
      const le = Math.min(data.length - 1, i + 2);
      let maxLocalDiff = 0;
      for (let j = ls; j < le; j++)
        maxLocalDiff = Math.max(maxLocalDiff, Math.abs(data[j + 1] - data[j]));
      if (maxLocalDiff < 0.2) rawLabels[i] = "flat";
    }
  }

  // 投票平滑
  return rawLabels.map((_, i) => {
    const votes: Record<string, number> = { parabolic: 0, flat: 0, square: 0 };
    for (let j = Math.max(0, i - 2); j <= Math.min(data.length - 1, i + 2); j++)
      votes[rawLabels[j]]++;
    return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  });
}

/* ---- 共享：按分类分段 ---- */
function buildSegments(
  data: number[],
  labels: string[],
  match: (l: string) => boolean,
) {
  const result = new Array(data.length).fill(null);
  let i = 0;
  while (i < data.length) {
    if (match(labels[i])) {
      if (i > 0) result[i - 1] = data[i - 1];
      while (i < data.length && match(labels[i])) {
        result[i] = data[i];
        i++;
      }
      if (i < data.length) result[i] = data[i];
    } else {
      i++;
    }
  }
  return result;
}

/* ---- 共享：构建一个系列的 option ---- */
function makeSeries(
  name: string,
  data: number[],
  labels: string[],
  key: keyof PhaseColors,
  colors: PhaseColors,
  lineWidth: number,
) {
  return {
    name,
    type: "line",
    data: buildSegments(data, labels, (l) => l === key),
    smooth: false,
    symbol: "none",
    color: colors[key],
    itemStyle: { color: colors[key] },
    lineStyle: {
      color: colors[key],
      width: lineWidth,
      shadowBlur: lineWidth >= 2 ? 6 : 4,
      shadowColor: gradient(colors[key], 0.35),
    },
    areaStyle: {
      color: {
        type: "linear",
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: gradient(colors[key], 0.18) },
          { offset: 1, color: gradient(colors[key], 0.01) },
        ],
      },
    },
    connectNulls: false,
  };
}

/* ---- 共享：构建坐标轴、grid 等公共 option ---- */
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
  colors: PhaseColors,
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
    legend: hasData ? LEGEND_SINGLE : undefined,
    series: [],
    graphic: [],
  };

  if (hasData) {
    const labels = classifyData(data);
    option.series = [
      makeSeries("启动电流", data, labels, "parabolic", colors, 2),
      makeSeries("工作电流", data, labels, "flat", colors, 2),
      makeSeries("摩擦电流", data, labels, "square", colors, 2),
    ];

    if (data.length > 1 && chartWidth > 0) {
      addMarkers(
        option,
        data,
        labels,
        minVal,
        maxVal,
        padding,
        chartWidth,
        chartHeight,
        55,
        20,
        50,
        colors,
        11,
      );
    }
  }

  return { option, peak, valley };
}

/* ---- 共享：在 graphic 中添加 max/min 标记 ---- */
function addMarkers(
  option: any,
  data: number[],
  _labels: string[],
  yMin: number,
  yMax: number,
  padding: number,
  chartWidth: number,
  chartHeight: number,
  gridLeft: number,
  gridTop: number,
  gridBottom: number,
  colors: PhaseColors,
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

  const mk = (idx: number, val: number, label: string, color: string) => {
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
        style: { fill: color, stroke: "#fff", lineWidth: 2 },
        z: 100,
      },
    );
  };

  mk(maxIdx, maxV, "最大值", colors.parabolic);
  mk(minIdx, minV, "最小值", colors.flat);
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

  let peakA = 0,
    valleyA = 0,
    peakB = 0,
    valleyB = 0,
    peakC = 0,
    valleyC = 0;
  if (dataA.length > 0) {
    peakA = Math.max(...dataA);
    valleyA = Math.min(...dataA);
  }
  if (dataB.length > 0) {
    peakB = Math.max(...dataB);
    valleyB = Math.min(...dataB);
  }
  if (dataC.length > 0) {
    peakC = Math.max(...dataC);
    valleyC = Math.min(...dataC);
  }

  const maxVal = hasData ? Math.max(...allData, 0.01) : 10;
  const minVal = hasData ? Math.min(...allData, 0) : 0;
  const padding = (maxVal - minVal) * 0.15 || 0.5;

  const option: any = {
    ...baseOption(xLabels, hasData, minVal, maxVal, padding, 12),
    legend: hasData ? LEGEND_THREE : undefined,
    series: [],
    graphic: [],
  };

  if (hasData) {
    const labelsA = classifyData(dataA);
    const labelsB = classifyData(dataB);
    const labelsC = classifyData(dataC);

    option.series = [
      makeSeries("A-启动电流", dataA, labelsA, "parabolic", COLORS_A, 1.5),
      makeSeries("A-工作电流", dataA, labelsA, "flat", COLORS_A, 1.5),
      makeSeries("A-摩擦电流", dataA, labelsA, "square", COLORS_A, 1.5),
      makeSeries("B-启动电流", dataB, labelsB, "parabolic", COLORS_B, 1.5),
      makeSeries("B-工作电流", dataB, labelsB, "flat", COLORS_B, 1.5),
      makeSeries("B-摩擦电流", dataB, labelsB, "square", COLORS_B, 1.5),
      makeSeries("C-启动电流", dataC, labelsC, "parabolic", COLORS_C, 1.5),
      makeSeries("C-工作电流", dataC, labelsC, "flat", COLORS_C, 1.5),
      makeSeries("C-摩擦电流", dataC, labelsC, "square", COLORS_C, 1.5),
    ];

    if (chartWidth > 0) {
      const G = { left: 55, right: 20, top: 12, bottom: 50 };
      const gw = chartWidth - G.left - G.right;
      const gh = chartHeight - G.top - G.bottom;
      const yRange = maxVal + padding - Math.max(0, minVal - padding) || 1;
      const yBase = Math.max(0, minVal - padding);
      const toX = (i: number, len: number) =>
        G.left + (len > 1 ? i / (len - 1) : 0) * gw;
      const toY = (v: number) => G.top + (1 - (v - yBase) / yRange) * gh;

      const mk = (
        idx: number,
        val: number,
        label: string,
        color: string,
        len: number,
      ) => {
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
            style: { fill: color, stroke: "#fff", lineWidth: 1.5 },
            z: 100,
          },
        );
      };

      mk(
        dataA.indexOf(peakA),
        peakA,
        "A max",
        COLORS_A.parabolic,
        dataA.length,
      );
      mk(dataA.indexOf(valleyA), valleyA, "A min", COLORS_A.flat, dataA.length);
      mk(
        dataB.indexOf(peakB),
        peakB,
        "B max",
        COLORS_B.parabolic,
        dataB.length,
      );
      mk(dataB.indexOf(valleyB), valleyB, "B min", COLORS_B.flat, dataB.length);
      mk(
        dataC.indexOf(peakC),
        peakC,
        "C max",
        COLORS_C.parabolic,
        dataC.length,
      );
      mk(dataC.indexOf(valleyC), valleyC, "C min", COLORS_C.flat, dataC.length);
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
        COLORS_SINGLE,
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
        peakA: pa, valleyA: va,
        peakB: pb, valleyB: vb,
        peakC: pc, valleyC: vc,
      } = buildThreePhaseChartOpt(
        historyA.value, historyB.value, historyC.value,
        xLabels3.value,
        sizeThree.value.width, sizeThree.value.height,
      );
      peakA.value = pa; valleyA.value = va;
      peakB.value = pb; valleyB.value = vb;
      peakC.value = pc; valleyC.value = vc;
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
        if (obs) {
          obs.disconnect();
          obs = null;
        }
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

/* ---- 操作 ---- */
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
  peakA,
  valleyA,
  peakB,
  valleyB,
  peakC,
  valleyC,
  peakSingle,
  valleySingle,
  isThreePhase,
  resetSingle,
  resetThree,
  resetData,
  currentHistory: history,
  xLabels: xLabels,
  currentHistoryA: historyA,
  currentHistoryB: historyB,
  currentHistoryC: historyC,
  xLabels3: xLabels3,
});
</script>

<template>
  <div class="curve-panel">
    <div class="panel-header">
      <span class="panel-title">{{ title || "电流曲线" }}</span>
    </div>

    <!-- 单相 -->
    <div v-if="!isThreePhase" ref="containerSingle" class="chart-container">
      <v-chart :option="chartOptSingle" autoresize />
    </div>

    <!-- 三相合一 -->
    <div v-else ref="containerThree" class="chart-container">
      <v-chart :option="chartOptThree" autoresize />
    </div>

    <!-- 底部参数 -->
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

    <div class="power-btn-section">
      <button class="power-btn" @click="handleStart">同步继电器状态</button>
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

.param-value.a {
  color: #f04b4b;
}
.param-value.b {
  color: #4dabf7;
}
.param-value.c {
  color: #51cf66;
}

.power-btn-section {
  padding: 8px 16px;
  border-top: 1px solid #1a2d44;
}

.power-btn {
  width: 100%;
  background: rgba(90, 146, 208, 0.15);
  border: 1px solid #2a4a68;
  color: #8fb4d8;
  font-size: 14px;
  padding: 6px 0;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.power-btn:hover {
  background: rgba(90, 146, 208, 0.25);
  border-color: #5a92d0;
  color: #fff;
}
</style>
