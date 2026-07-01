<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { HTTP_URL } from "@/config/config";
import { useToast } from "@/composables/useToast";

const { withLoading } = useToast();

interface RecordItem {
  id: number;
  device_name: string;
  combination_name: string;
  config_name: string;
  op_type: string;
  status: string;
  peak_current: number;
  valley_current: number;
  curve_file: string;
  created_at: string;
}

const records = ref<RecordItem[]>([]);
const detailVisible = ref(false);
const currentRecord = ref<RecordItem | null>(null);
const curveData = ref<{ t: number; v: number }[]>([]);

const opTypeLabels: Record<string, string> = {
  DC: "定操",
  FC: "反操",
  CD: "传动",
  HX: "混线",
  JD: "接地",
};

async function getList() {
  try {
    const res = await fetch(HTTP_URL + "/operationRecords");
    records.value = await res.json();
  } catch {}
}

async function openDetail(record: RecordItem) {
  currentRecord.value = record;
  try {
    const res = await fetch(HTTP_URL + "/" + record.curve_file);
    curveData.value = await res.json();
  } catch {
    curveData.value = [];
  }
  detailVisible.value = true;
}
const chartOpt = computed(() => {
  const data = curveData.value.data;
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
      data: curveData.value.time,
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
onMounted(async () => {
  await withLoading(async () => {
    await getList();
  });
});
</script>

<template>
  <div class="manager-page">
    <div class="page-header">
      <h2 class="page-title">操作记录</h2>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>序号</th>
          <th>设备</th>
          <th>组合</th>
          <th>配置</th>
          <th>操作类型</th>
          <th>状态</th>
          <th>峰值电流</th>
          <th>谷值电流</th>
          <th>时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in records" :key="r.id">
          <td>{{ i + 1 }}</td>
          <td>{{ r.device_name }}</td>
          <td>{{ r.combination_name }}</td>
          <td>{{ r.config_name }}</td>
          <td>
            <span class="op-type-tag" :class="r.op_type.toLowerCase()">
              {{ opTypeLabels[r.op_type] || r.op_type }}
            </span>
          </td>
          <td>
            <span
              class="status-tag"
              :class="r.status === 'success' ? 'online' : 'offline'">
              {{ r.status === "success" ? "成功" : "失败" }}
            </span>
          </td>
          <td>{{ r.peak_current }}A</td>
          <td>{{ r.valley_current }}A</td>
          <td>{{ r.created_at }}</td>
          <td>
            <button class="action-btn edit" @click="openDetail(r)">曲线</button>
          </td>
        </tr>
        <tr v-if="records.length === 0">
          <td colspan="10" class="empty-row">暂无记录</td>
        </tr>
      </tbody>
    </table>

    <!-- 曲线弹窗 -->
    <div
      v-if="detailVisible"
      class="modal-overlay"
      @click.self="detailVisible = false">
      <div class="modal-card detail-card">
        <div class="modal-header">
          <h3 class="modal-title">
            {{ currentRecord?.device_name }} -
            {{ opTypeLabels[currentRecord?.op_type || ""] }}
          </h3>
          <button class="close-btn" @click="detailVisible = false">✕</button>
        </div>
        <div class="detail-info">
          <span>峰值: {{ currentRecord?.peak_current }}A</span>
          <span>谷值: {{ currentRecord?.valley_current }}A</span>
          <span>{{ currentRecord?.created_at }}</span>
        </div>
        <div class="curve-table-wrap">
          <!-- <table class="curve-table">
            <thead>
              <tr>
                <th>时间偏移(s)</th>
                <th>电流(A)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, i) in curveData" :key="i">
                <td>{{ p.t }}</td>
                <td>{{ p.v }}</td>
              </tr>
              <tr v-if="curveData.length === 0">
                <td colspan="2" class="empty-row">无曲线数据</td>
              </tr>
            </tbody>
          </table> -->

          <div class="chart-container">
            <v-chart :option="chartOpt" autoresize />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manager-page {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 18px;
  color: #8fb4d8;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid #1a2d44;
}

.data-table th {
  color: #5a7288;
  font-size: 12px;
  font-weight: 500;
}

.data-table td {
  color: #c0d0e0;
  font-size: 13px;
}

.op-type-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #e0e8f0;
  background: rgba(90, 146, 208, 0.2);
}

.op-type-tag.dc {
  background: rgba(52, 211, 153, 0.2);
  color: #34d399;
}
.op-type-tag.fc {
  background: rgba(250, 204, 21, 0.2);
  color: #facc15;
}
.op-type-tag.cd {
  background: rgba(52, 163, 211, 0.2);
  color: #34a3d3;
}
.op-type-tag.hx {
  background: rgba(168, 85, 247, 0.2);
  color: #a855f7;
}
.op-type-tag.jd {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
}

.status-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.status-tag.online {
  color: #34d399;
  background: rgba(52, 211, 153, 0.12);
}

.status-tag.offline {
  color: #f87171;
  background: rgba(248, 113, 113, 0.12);
}

.empty-row {
  text-align: center;
  color: #5a7288;
  padding: 40px 0;
}

.action-btn {
  border: none;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn.edit {
  background: #1a3350;
  color: #8fb4d8;
}

.action-btn.edit:hover {
  background: #254670;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-card {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
  padding: 24px;
  max-height: 80vh;
  overflow-y: auto;
}

.detail-card {
  width: 820px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.modal-title {
  font-size: 16px;
  color: #e0e8f0;
}

.close-btn {
  background: none;
  border: none;
  color: #5a7288;
  font-size: 18px;
  cursor: pointer;
}

.close-btn:hover {
  color: #e0e8f0;
}

.detail-info {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  font-size: 12px;
  color: #5a7288;
}

.curve-table-wrap {
  max-height: 400px;
  overflow-y: auto;
}

.curve-table {
  width: 100%;
  border-collapse: collapse;
}

.curve-table th,
.curve-table td {
  text-align: center;
  padding: 6px 10px;
  border-bottom: 1px solid #1a2d44;
  font-size: 12px;
}

.curve-table th {
  color: #5a7288;
  position: sticky;
  top: 0;
  background: #0b1d33;
}

.curve-table td {
  color: #8a9fb0;
}

.chart-container {
  width: 100%;
  height: 400px;
}
</style>
