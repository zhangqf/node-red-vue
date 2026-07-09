<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  title?: string;
  startCurrent?: number;
  convertCurrent?: number;
  lockCurrent?: number;
  registerArr?: number[];
}>();

const emit = defineEmits<{ start: [type: string] }>();

const MAX_POINTS = 300;
const currentHistory = ref<number[]>([]);
const xLabels = ref<string[]>([]);
const peak_current = ref<number>(0);
const valley_current = ref<number>(0);
const startTime = ref<number>(0);
const chartContainer = ref<HTMLElement | null>(null);
const chartSize = ref({ width: 0, height: 0 });

onMounted(() => {
  const el = chartContainer.value;
  if (!el) return;
  const update = () => {
    chartSize.value = { width: el.clientWidth, height: el.clientHeight };
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(el);
  onUnmounted(() => observer.disconnect());
});

watch(
  () => props.registerArr,
  (arr) => {
    if (!arr || arr.length < 1) return;
    const current = arr[0];
    const now = performance.now();
    if (!startTime.value) startTime.value = now;
    const elapsed = ((now - startTime.value) / 1000).toFixed(1);

    currentHistory.value = [
      ...currentHistory.value.slice(-MAX_POINTS + 1),
      current,
    ];
    xLabels.value = [...xLabels.value.slice(-MAX_POINTS + 1), elapsed];
  },
);

const COLORS = {
  parabolic: "#f04b4b",
  flat: "#4dabf7",
  square: "#51cf66",
};

function gradient(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const chartOpt = computed(() => {
  const data = currentHistory.value;
  const hasData = data.length > 0;

  if (hasData) {
    peak_current.value = Math.max(...data);
    valley_current.value = Math.min(...data);
  }

  const maxVal = hasData ? Math.max(...data, 0.01) : 10;
  const minVal = hasData ? Math.min(...data, 0) : 0;
  const padding = (maxVal - minVal) * 0.15 || 0.5;

  let paraEnd = 0;
  let flatEnd = data.length;
  if (hasData && data.length > 10) {
    for (let i = Math.floor(data.length * 0.15); i < data.length - 2; i++) {
      const d1 = Math.abs(data[i] - data[i - 1]);
      const d2 = Math.abs(data[i + 1] - data[i]);
      if (d1 < 0.15 && d2 < 0.15 && data[i] > 1) {
        paraEnd = i;
        break;
      }
    }
    for (let i = paraEnd + 1; i < data.length - 1; i++) {
      if (Math.abs(data[i] - data[i - 1]) > 1.0) {
        flatEnd = i;
        break;
      }
    }
  }

  return {
    animationDuration: 400,
    animationEasing: "cubicOut",
    tooltip: hasData
      ? {
          trigger: "axis",
          axisPointer: {
            type: "cross",
            crossStyle: { color: "#3a5670" },
            label: {
              backgroundColor: "#0b1d33",
              color: "#e0e8f0",
            },
          },
          backgroundColor: "rgba(11,29,51,0.96)",
          borderColor: "#2d5280",
          textStyle: { color: "#e0e8f0", fontSize: 12 },
          extraCssText:
            "box-shadow: 0 4px 16px rgba(0,0,0,0.4); border-radius: 6px;",
        }
      : undefined,
    backgroundColor: "transparent",
    grid: {
      left: 55,
      right: 20,
      top: 20,
      bottom: 50,
    },
    xAxis: {
      type: "category",
      data: hasData ? xLabels.value : [],
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
        interval: hasData ? Math.max(Math.floor(data.length / 6), 0) : 0,
      },
    },
    yAxis: {
      type: "value",
      min: Math.max(0, minVal - padding),
      max: maxVal + padding,
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
    colors: [COLORS.parabolic, COLORS.flat, COLORS.square],
    legend: hasData
      ? {
          data: ["启动电流", "工作电流", "摩擦电流"],
          bottom: 0,

          left: 55,
          orient: "horizontal",
          textStyle: { color: "#8fb4d8", fontSize: 11 },
          icon: "roundRect",
        }
      : undefined,
    series: hasData
      ? (() => {
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
            if (
              largeJumps >= 2 &&
              signChanges >= 1 &&
              signChanges / largeJumps >= 0.4
            )
              return "square";

            if (wRange < 0.2) return "flat";

            const diffs: number[] = [];
            for (let j = 1; j < win.length; j++)
              diffs.push(win[j] - win[j - 1]);
            const dd: number[] = [];
            for (let j = 1; j < diffs.length; j++)
              dd.push(diffs[j] - diffs[j - 1]);
            const pos = dd.filter((d) => d > 0).length;
            const neg = dd.filter((d) => d < 0).length;
            if (Math.max(pos, neg) >= dd.length * 0.45 && wRange > 1)
              return "parabolic";

            return "flat";
          });

          for (let i = 0; i < rawLabels.length; i++) {
            if (rawLabels[i] === "parabolic") {
              const ls = Math.max(0, i - 2);
              const le = Math.min(data.length - 1, i + 2);
              let maxLocalDiff = 0;
              for (let j = ls; j < le; j++) {
                maxLocalDiff = Math.max(
                  maxLocalDiff,
                  Math.abs(data[j + 1] - data[j]),
                );
              }
              if (maxLocalDiff < 0.2) rawLabels[i] = "flat";
            }
          }

          const labels = rawLabels.map((_, i) => {
            const votes: Record<string, number> = {
              parabolic: 0,
              flat: 0,
              square: 0,
            };
            for (
              let j = Math.max(0, i - 2);
              j <= Math.min(data.length - 1, i + 2);
              j++
            )
              votes[rawLabels[j]]++;
            return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
          });

          const buildSegments = (
            arr: number[],
            match: (label: string) => boolean,
          ) => {
            const result = new Array(arr.length).fill(null);
            let i = 0;
            while (i < arr.length) {
              if (match(labels[i])) {
                if (i > 0) result[i - 1] = arr[i - 1];
                while (i < arr.length && match(labels[i])) {
                  result[i] = arr[i];
                  i++;
                }
                if (i < arr.length) result[i] = arr[i];
              } else {
                i++;
              }
            }
            return result;
          };

          function makeSeries(
            name: string,
            key: "parabolic" | "flat" | "square",
          ) {
            return {
              name,
              type: "line",
              data: buildSegments(data, (l) => l === key),
              smooth: false,
              symbol: "none",
              color: COLORS[key],
              itemStyle: { color: COLORS[key] },
              lineStyle: {
                color: COLORS[key],
                width: 2,
                shadowBlur: 6,
                shadowColor: gradient(COLORS[key], 0.35),
              },
              areaStyle: {
                color: {
                  type: "linear",
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: gradient(COLORS[key], 0.18) },
                    { offset: 1, color: gradient(COLORS[key], 0.01) },
                  ],
                },
              },
              connectNulls: false,
            };
          }

          return [
            makeSeries("启动电流", "parabolic"),
            makeSeries("工作电流", "flat"),
            makeSeries("摩擦电流", "square"),
          ];
        })()
      : [],
    graphic: (() => {
      if (!hasData || data.length < 2 || !chartSize.value.width) return [];
      const GRID = { left: 55, right: 20, top: 20, bottom: 50 };
      const gw = chartSize.value.width - GRID.left - GRID.right;
      const gh = chartSize.value.height - GRID.top - GRID.bottom;
      const yMin = Math.max(0, minVal - padding);
      const yMax = maxVal + padding;
      const yRange = yMax - yMin || 1;

      const maxV = Math.max(...data);
      const minV = Math.min(...data);
      const maxIdx = data.indexOf(maxV);
      const minIdx = data.indexOf(minV);

      const toX = (i: number) => GRID.left + (i / (data.length - 1)) * gw;
      const toY = (v: number) => GRID.top + (1 - (v - yMin) / yRange) * gh;

      const elements: any[] = [];
      [  { idx: maxIdx, val: maxV, label: "最大值", color: COLORS.parabolic },
        { idx: minIdx, val: minV, label: "最小值", color: COLORS.flat },
      ].forEach((m) => {
          elements.push({
            type: "text",
            left: toX(m.idx) - 24,
            top: toY(m.val) - 22,
            style: {
              text: `${m.label} ${m.val.toFixed(1)}A`,
              fill: "#fff",
              fontSize: 11,
              fontWeight: 600,
              textAlign: "center",
              textShadowBlur: 4,
              textShadowColor: "rgba(0,0,0,0.7)",
            },
            z: 100,
          });
          elements.push({
            type: "circle",
            shape: { cx: toX(m.idx), cy: toY(m.val), r: 5 },
            style: { fill: m.color, stroke: "#fff", lineWidth: 2 },
            z: 100,
          });
        });
      return elements;
    })(),
  };
});

const resetData = () => {
  valley_current.value = 0;
  peak_current.value = 0;
  xLabels.value = [];
  currentHistory.value = [];
  startTime.value = 0;
};

const handleStart = () => {
  resetData();
  emit("start", "start");
};

defineExpose({
  valley_current,
  peak_current,
  xLabels,
  currentHistory,
  resetData,
});
</script>

<template>
  <div class="curve-panel">
    <div class="panel-header">
      <span class="panel-title">{{ title || "电流曲线" }}</span>
    </div>

    <div ref="chartContainer" class="chart-container">
      <v-chart :option="chartOpt" autoresize />
    </div>

    <div class="params-row">
      <div class="param">
        <span class="param-label">电流峰值</span>
        <span class="param-value">{{ peak_current }}</span>
      </div>
      <div class="param">
        <span class="param-label">电流谷值</span>
        <span class="param-value">{{ valley_current }}</span>
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
