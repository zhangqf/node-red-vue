<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { HTTP_URL } from "@/config/config";
import { useToast } from "@/composables/useToast";

const { withLoading, showToast } = useToast();

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
  result?: string;
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
  const res = await fetch(HTTP_URL + "/operationRecords");
  records.value = await res.json();
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
  const data = curveData.value.data || [];
  const hasData = data.length > 0;

  if (hasData) {
    const maxVal = Math.max(...data, 0.01);
    const minVal = Math.min(...data, 0);
    const padding = (maxVal - minVal) * 0.15 || 0.5;
    return fullChartOpt(data, maxVal, minVal, padding);
  }
  return fullChartOpt(data, 10, 0, 0.5);
});

function fullChartOpt(
  data: number[],
  maxVal: number,
  minVal: number,
  padding: number,
) {
  const hasData = data.length > 0;
  return {
    tooltip: hasData
      ? {
          trigger: "axis",
          axisPointer: { type: "cross" },
          backgroundColor: "#0b1d33",
          borderColor: "#2d5280",
          textStyle: { color: "#e0e8f0", fontSize: 12 },
        }
      : undefined,
    backgroundColor: "transparent",
    grid: {
      left: 55,
      right: 20,
      top: 15,
      bottom: 30,
    },
    xAxis: {
      type: "category",
      data: curveData.value.time || [],
      axisLine: { lineStyle: { color: "#1a2d44" } },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: "#1a2d44", type: "dashed" as const },
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
        lineStyle: { color: "#1a2d44", type: "dashed" as const },
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
        lineStyle: { color: "#e8473b", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(232,71,59,0.2)" },
              { offset: 1, color: "rgba(232,71,59,0.02)" },
            ],
          },
        },
      },
    ],
  };
}

async function deleteList(id: string, curve_file: string) {
  const response = await fetch(`${HTTP_URL}/deleteRecord/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: curve_file }),
  });

  if (!response.ok) {
    throw new Error(`请求失败，状态码：${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200 && data.code !== 0) {
    throw new Error(data.msg || "删除失败");
  }
  return data;
}

async function handleDelete(item: RecordItem) {
  const id = item.id;
  const curve_file = item.curve_file;

  const delAction = withLoading(async () => {
    const res = await deleteList(String(id), curve_file);
    records.value = records.value.filter((c) => c.id !== id);
    return res;
  }, "正在删除...");
  try {
    await delAction();
  } catch (error: any) {
    console.error("删除操作异常：", error);
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  return dateStr.replace("T", " ").substring(0, 19);
}

onMounted(async () => {
  await withLoading(async () => {
    await getList();
  }, "数据加载成功");
});
</script>

<template>
  <div class="record-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">历史记录</h2>
        <span class="record-count">{{ records.length }} 条记录</span>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-idx">#</th>
            <th class="col-device">设备名称</th>
            <th class="col-combo">组合方式</th>
            <th class="col-config">测试机型</th>
            <th class="col-op">操作类型</th>
            <th class="col-status">状态</th>
            <th class="col-result">检测结果</th>
            <th class="col-num">峰值(A)</th>
            <th class="col-num">谷值(A)</th>
            <th class="col-time">测试时间</th>
            <th class="col-action">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in records" :key="r.id">
            <td class="col-idx idx-cell">{{ i + 1 }}</td>
            <td class="col-device">
              <span class="device-name-cell">{{ r.device_name }}</span>
            </td>
            <td class="col-combo">{{ r.combination_name }}</td>
            <td class="col-config">{{ r.config_name }}</td>
            <td class="col-op">
              <span class="op-type-tag" :class="r.op_type.toLowerCase()">
                {{ opTypeLabels[r.op_type] || r.op_type }}
              </span>
            </td>
            <td class="col-status">
              <span class="status-tag" :class="r.status === 'success' ? 'success' : 'fail'">
                <span class="status-dot" :class="r.status === 'success' ? 'success' : 'fail'"></span>
                {{ r.status === "success" ? "成功" : "失败" }}
              </span>
            </td>
            <td class="col-result">
              <div class="result-cell" v-if="r.result">
                <span
                  v-for="(item, idx) in JSON.parse(r.result)"
                  :key="idx"
                  class="result-tag"
                  :class="item.status ? 'pass' : 'fail'">
                  {{ item.name }}
                </span>
              </div>
              <span v-else class="no-data">-</span>
            </td>
            <td class="col-num num-cell">{{ r.peak_current }}</td>
            <td class="col-num num-cell">{{ r.valley_current }}</td>
            <td class="col-time time-cell">{{ formatDate(r.created_at) }}</td>
            <td class="col-action">
              <div class="action-group">
                <button class="action-btn view" @click="openDetail(r)">
                  <svg viewBox="0 0 14 14" fill="none" class="btn-icon">
                    <path d="M2 13L12 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    <path d="M2 1L2 13L7 9L12 13L12 1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/>
                  </svg>
                  曲线
                </button>
                <button class="action-btn delete" @click="handleDelete(r)">
                  <svg viewBox="0 0 14 14" fill="none" class="btn-icon">
                    <path d="M3 4H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    <path d="M5.5 4V3C5.5 2.45 5.95 2 6.5 2H7.5C8.05 2 8.5 2.45 8.5 3V4" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M11 4V11.5C11 12.05 10.55 12.5 10 12.5H4C3.45 12.5 3 12.05 3 11.5V4" stroke="currentColor" stroke-width="1.3"/>
                  </svg>
                  删除
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="records.length === 0">
            <td colspan="11" class="empty-row">
              <div class="empty-state">
                <svg viewBox="0 0 48 48" fill="none" class="empty-icon">
                  <rect x="8" y="10" width="32" height="28" rx="4" stroke="#1a3350" stroke-width="2"/>
                  <line x1="14" y1="18" x2="34" y2="18" stroke="#1a3350" stroke-width="1.5" opacity="0.5"/>
                  <line x1="14" y1="24" x2="28" y2="24" stroke="#1a3350" stroke-width="1.5" opacity="0.3"/>
                  <line x1="14" y1="30" x2="22" y2="30" stroke="#1a3350" stroke-width="1.5" opacity="0.2"/>
                </svg>
                <p>暂无历史记录</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 曲线弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="detailVisible"
          class="modal-overlay"
          @click.self="detailVisible = false">
          <div class="modal-card">
            <div class="modal-header">
              <div class="modal-header-left">
                <h3 class="modal-title">电流曲线</h3>
                <span class="modal-subtitle">
                  {{ currentRecord?.device_name }} · {{ opTypeLabels[currentRecord?.op_type || ""] }}
                </span>
              </div>
              <button class="modal-close" @click="detailVisible = false">
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <div class="modal-stats">
              <div class="stat-block">
                <span class="stat-label">峰值电流</span>
                <span class="stat-value peak">{{ currentRecord?.peak_current }}<small>A</small></span>
              </div>
              <div class="stat-block">
                <span class="stat-label">谷值电流</span>
                <span class="stat-value valley">{{ currentRecord?.valley_current }}<small>A</small></span>
              </div>
              <div class="stat-block">
                <span class="stat-label">测试时间</span>
                <span class="stat-value time">{{ formatDate(currentRecord?.created_at || "") }}</span>
              </div>
            </div>

            <div class="modal-result" v-if="currentRecord?.result">
              <span class="result-section-label">检测项</span>
              <div class="result-tags">
                <span
                  v-for="(item, idx) in JSON.parse(currentRecord.result)"
                  :key="idx"
                  class="result-tag"
                  :class="item.status ? 'pass' : 'fail'">
                  <span class="result-check">{{ item.status ? "✓" : "✗" }}</span>
                  {{ item.name }}
                  <span class="relay-name" v-if="item.relayName?.length">
                    ({{ item.relayName.join(", ") }})
                  </span>
                </span>
              </div>
            </div>

            <div class="modal-chart">
              <v-chart :option="chartOpt" autoresize />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.record-page {
  padding: 20px 28px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ---- Header ---- */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e8f0;
}

.record-count {
  font-size: 12px;
  color: #5a7288;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 20px;
  padding: 4px 14px;
}

/* ---- Table container ---- */
.table-container {
  flex: 1;
  overflow: auto;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 10px;
  scrollbar-width: thin;
  scrollbar-color: #1a2d44 transparent;
}

.table-container::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.table-container::-webkit-scrollbar-track {
  background: transparent;
}

.table-container::-webkit-scrollbar-thumb {
  background: #1a2d44;
  border-radius: 2px;
}

/* ---- Table ---- */
.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1100px;
}

.data-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table th {
  text-align: left;
  padding: 12px 14px;
  background: #0a1628;
  color: #5a7288;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #152238;
  white-space: nowrap;
}

.data-table td {
  padding: 13px 14px;
  color: #c0d0e0;
  font-size: 13px;
  border-bottom: 1px solid #111f33;
  vertical-align: middle;
}

.data-table tbody tr {
  transition: background 0.15s;
}

.data-table tbody tr:hover {
  background: rgba(90, 146, 208, 0.03);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

/* Column widths */
.col-idx { width: 40px; text-align: center; }
.col-device { min-width: 150px; }
.col-combo { min-width: 120px; }
.col-config { min-width: 120px; }
.col-op { width: 80px; }
.col-status { width: 90px; }
.col-result { min-width: 160px; }
.col-num { width: 70px; text-align: right; }
.col-time { min-width: 150px; }
.col-action { width: 150px; }

.idx-cell {
  color: #5a7288;
  font-size: 12px;
  text-align: center;
}

.device-name-cell {
  color: #e0e8f0;
  font-weight: 500;
}

.num-cell {
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
  font-size: 13px;
  text-align: right;
  color: #8fb4d8;
}

.time-cell {
  color: #6a8a9f;
  font-size: 12px;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
}

/* ---- Tags ---- */
.op-type-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #e0e8f0;
  background: rgba(90, 146, 208, 0.2);
  letter-spacing: 0.5px;
}

.op-type-tag.dc {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}
.op-type-tag.fc {
  background: rgba(250, 204, 21, 0.15);
  color: #facc15;
}
.op-type-tag.cd {
  background: rgba(52, 163, 211, 0.15);
  color: #34a3d3;
}
.op-type-tag.hx {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}
.op-type-tag.jd {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.status-tag.success {
  color: #34d399;
  background: rgba(52, 211, 153, 0.08);
}

.status-tag.fail {
  color: #f87171;
  background: rgba(248, 113, 113, 0.08);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.success {
  background: #34d399;
  box-shadow: 0 0 4px rgba(52, 211, 153, 0.4);
}

.status-dot.fail {
  background: #f87171;
  box-shadow: 0 0 4px rgba(248, 113, 113, 0.4);
}

/* ---- Result tags ---- */
.result-cell {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.result-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}

.result-tag.pass {
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
}

.result-tag.fail {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

.no-data {
  color: #4a6078;
}

/* ---- Actions ---- */
.action-group {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid transparent;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-icon {
  width: 12px;
  height: 12px;
}

.action-btn.view {
  background: rgba(90, 146, 208, 0.1);
  border-color: rgba(90, 146, 208, 0.2);
  color: #8fb4d8;
}

.action-btn.view:hover {
  background: rgba(90, 146, 208, 0.2);
  border-color: rgba(90, 146, 208, 0.35);
}

.action-btn.delete {
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.action-btn.delete:hover {
  background: rgba(248, 113, 113, 0.18);
  border-color: rgba(248, 113, 113, 0.3);
}

/* ---- Empty state ---- */
.empty-row {
  text-align: center !important;
  padding: 0 !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 64px 20px;
  color: #5a7288;
  font-size: 14px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  opacity: 0.35;
}

/* ---- Modal ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 14px;
  width: 860px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 28px 0;
}

.modal-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e8f0;
}

.modal-subtitle {
  font-size: 13px;
  color: #5a7288;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid #1a2d44;
  border-radius: 6px;
  color: #5a7288;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.modal-close:hover {
  color: #e0e8f0;
  border-color: #2d5280;
  background: rgba(90, 146, 208, 0.08);
}

/* Modal stats */
.modal-stats {
  display: flex;
  gap: 12px;
  padding: 20px 28px;
}

.stat-block {
  flex: 1;
  background: #051424;
  border: 1px solid #152238;
  border-radius: 8px;
  padding: 14px 18px;
}

.stat-label {
  display: block;
  font-size: 11px;
  color: #5a7288;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #e0e8f0;
}

.stat-value small {
  font-size: 12px;
  font-weight: 400;
  color: #5a7288;
  margin-left: 2px;
}

.stat-value.time {
  font-size: 13px;
  font-weight: 500;
  color: #8fb4d8;
}

.stat-value.peak {
  color: #e8473b;
}

.stat-value.valley {
  color: #34a3d3;
}

/* Modal result */
.modal-result {
  padding: 0 28px 16px;
}

.result-section-label {
  font-size: 11px;
  color: #5a7288;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-bottom: 8px;
}

.result-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.result-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.result-tag.pass {
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
}

.result-tag.fail {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

.result-check {
  font-size: 11px;
  font-weight: 700;
}

.relay-name {
  color: #5a7288;
  font-size: 11px;
  font-weight: 400;
}

/* Modal chart */
.modal-chart {
  height: 360px;
  padding: 0 20px 28px;
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card {
  transform: scale(0.96);
}

.modal-leave-to .modal-card {
  transform: scale(0.96);
}
</style>
