<script setup lang="ts">
import { computed, ref, watch } from "vue";

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

watch(
  () => props.registerArr,
  (arr) => {
    if (!arr || arr.length < 1) return;
    const current = arr[0];
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    currentHistory.value = [
      ...currentHistory.value.slice(-MAX_POINTS + 1),
      current,
    ];
    xLabels.value = [...xLabels.value.slice(-MAX_POINTS + 1), time];
  },
);

const chartOpt = computed(() => {
  const data = currentHistory.value;
  if (data.length === 0) {
    return {
      xAxis: { type: "category", data: [] },
      yAxis: { type: "value" },
      series: [],
    };
  }

  const maxVal = Math.max(...data, 0.01);
  const minVal = Math.min(...data, 0);
  const padding = (maxVal - minVal) * 0.15 || 0.5;

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
    },
    backgroundColor: "transparent",
    grid: {
      left: 55,
      right: 20,
      top: 15,
      bottom: 30,
    },
    xAxis: {
      type: "category",
      data: xLabels.value,
      axisLine: { lineStyle: { color: "#1a2d44" } },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: "#1a2d44", type: "dashed" },
      },
      axisLabel: {
        color: "#5a7288",
        fontSize: 10,
        interval: Math.max(Math.floor(data.length / 6), 0),
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
        lineStyle: { color: "#1a2d44", type: "dashed" },
      },
      axisLabel: {
        color: "#5a7288",
        fontSize: 11,
        formatter: (v: number) => v.toFixed(1),
      },
    },
    series: [
      {
        type: "line",
        data: data,
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#d03131", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(208,49,49,0.2)" },
              { offset: 1, color: "rgba(208,49,49,0.02)" },
            ],
          },
        },
      },
    ],
  };
});

const handleStart = () => {
  emit("start", "start");
};
</script>

<template>
  <div class="curve-panel">
    <div class="panel-header">
      <span class="panel-title">{{ title || "电流曲线" }}</span>
    </div>

    <div class="chart-container">
      <v-chart :option="chartOpt" autoresize />
    </div>

    <div class="params-row">
      <div class="param">
        <span class="param-label">启动电流</span>
        <span class="param-value">{{ startCurrent?.toFixed(1) || "1.0" }}</span>
      </div>
      <div class="param">
        <span class="param-label">转换电流</span>
        <span class="param-value">{{ convertCurrent?.toFixed(1) || "0" }}</span>
      </div>
      <div class="param">
        <span class="param-label">锁闭电流</span>
        <span class="param-value">{{ lockCurrent?.toFixed(1) || "0" }}</span>
      </div>
    </div>

    <div class="power-btn-section">
      <button class="power-btn" @click="handleStart">开始</button>
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
