<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
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
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(15);

const searchDevice = ref("");
const searchCombination = ref("");
const searchConfig = ref("");
const searchOpType = ref("");
const searchStatus = ref("");

const detailVisible = ref(false);
const currentRecord = ref<RecordItem | null>(null);
const curveData = ref<{ t: number; v: number }[]>([]);
const chartContainer = ref<HTMLElement | null>(null);
const chartSize = ref({ width: 0, height: 0 });

let sizeObserver: ResizeObserver | null = null;

watch(chartContainer, (el) => {
  if (sizeObserver) {
    sizeObserver.disconnect();
    sizeObserver = null;
  }
  if (!el) return;
  const update = () => {
    chartSize.value = { width: el.clientWidth, height: el.clientHeight };
  };
  update();
  sizeObserver = new ResizeObserver(update);
  sizeObserver.observe(el);
});

onUnmounted(() => {
  if (sizeObserver) sizeObserver.disconnect();
});

const opTypeLabels: Record<string, string> = {
  DC: "定操",
  FC: "反操",
  CD: "传动",
  HX: "混线",
  JD: "接地",
};

async function getList() {
  const params = new URLSearchParams();
  params.set("page", String(currentPage.value));
  params.set("pageSize", String(pageSize.value));
  if (searchDevice.value) params.set("device_name", searchDevice.value);
  if (searchCombination.value) params.set("combination_name", searchCombination.value);
  if (searchConfig.value) params.set("config_name", searchConfig.value);
  if (searchOpType.value) params.set("op_type", searchOpType.value);
  if (searchStatus.value) params.set("status", searchStatus.value);

  const res = await fetch(HTTP_URL + "/operationRecords?" + params.toString());
  const json = await res.json();
  if (json.data) {
    records.value = json.data;
    total.value = json.total || json.data.length;
  } else {
    records.value = json;
    total.value = json.length;
  }
}

function handleSearch() {
  currentPage.value = 1;
  getList();
}

function handleReset() {
  searchDevice.value = "";
  searchCombination.value = "";
  searchConfig.value = "";
  searchOpType.value = "";
  searchStatus.value = "";
  currentPage.value = 1;
  getList();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  getList();
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

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

const COLORS = {
  parabolic: "#f04b4b",
  flat: "#4dabf7",
  square: "#51cf66",
};

const LEGEND_RECORD = {
  data: ["启动电流", "工作电流", "摩擦电流"],
  bottom: 0,
  left: 55,
  orient: "horizontal",
  textStyle: { color: "#8fb4d8", fontSize: 11 },
  icon: "roundRect",
} as const;

function gradient(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeSeries(
  data: number[],
  labels: string[],
  name: string,
  key: "parabolic" | "flat" | "square",
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
  return {
    name,
    type: "line",
    data: result,
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

const chartOpt = computed(() => {
  const data: number[] = curveData.value.data || [];
  const timeLabels: string[] = curveData.value.time || [];
  const hasData = data.length > 0;

  const maxVal = hasData ? Math.max(...data, 0.01) : 10;
  const minVal = hasData ? Math.min(...data, 0) : 0;
  const padding = (maxVal - minVal) * 0.15 || 0.5;

  let paraEnd = 0;
  let flatEnd = data.length;
  let labels: string[] = [];

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
      for (let j = 1; j < win.length; j++) diffs.push(win[j] - win[j - 1]);
      const dd: number[] = [];
      for (let j = 1; j < diffs.length; j++) dd.push(diffs[j] - diffs[j - 1]);
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

    labels = rawLabels.map((_, i) => {
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
  }

  const seriesArr = [
    makeSeries(data, labels, "启动电流", "parabolic", (l) => l === "parabolic"),
    makeSeries(data, labels, "工作电流", "flat", (l) => l === "flat"),
    makeSeries(data, labels, "摩擦电流", "square", (l) => l === "square"),
  ];

  const graphic: any[] = [];
  if (hasData && data.length > 1 && chartSize.value.width > 0) {
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

    [
      { idx: maxIdx, val: maxV, label: "最大值", color: COLORS.parabolic },
      { idx: minIdx, val: minV, label: "最小值", color: COLORS.flat },
    ].forEach((m) => {
      graphic.push({
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
      graphic.push({
        type: "circle",
        shape: { cx: toX(m.idx), cy: toY(m.val), r: 5 },
        style: { fill: m.color, stroke: "#fff", lineWidth: 2 },
        z: 100,
      });
    });
  }

  return {
    graphic,
    animationDuration: 0,
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
      data: timeLabels,
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
    legend: hasData ? LEGEND_RECORD : undefined,
    series: seriesArr,
  };
});

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
    total.value--;
    return res;
  }, "正在删除...");
  try {
    await delAction();
    if (records.value.length === 0 && currentPage.value > 1) {
      currentPage.value--;
      getList();
    }
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
        <span class="record-count">{{ total }} 条记录</span>
      </div>
    </div>

    <div class="search-bar">
      <div class="search-fields">
        <input
          v-model="searchDevice"
          class="search-input"
          placeholder="设备名称"
          @keyup.enter="handleSearch"
        />
        <input
          v-model="searchCombination"
          class="search-input"
          placeholder="组合方式"
          @keyup.enter="handleSearch"
        />
        <input
          v-model="searchConfig"
          class="search-input"
          placeholder="测试机型"
          @keyup.enter="handleSearch"
        />
        <select v-model="searchOpType" class="search-select">
          <option value="">操作类型</option>
          <option v-for="(label, key) in opTypeLabels" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
        <select v-model="searchStatus" class="search-select">
          <option value="">状态</option>
          <option value="success">成功</option>
          <option value="fail">失败</option>
        </select>
      </div>
      <div class="search-actions">
        <button class="search-btn" @click="handleSearch">查询</button>
        <button class="reset-btn" @click="handleReset">重置</button>
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
              <span
                class="status-tag"
                :class="r.status === 'success' ? 'success' : 'fail'">
                <span
                  class="status-dot"
                  :class="r.status === 'success' ? 'success' : 'fail'"></span>
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
            <td class="col-time time-cell">{{ formatDate(r.created_at) }}</td>
            <td class="col-action">
              <div class="action-group">
                <button class="action-btn view" @click="openDetail(r)">
                  <svg viewBox="0 0 14 14" fill="none" class="btn-icon">
                    <path
                      d="M2 13L12 13"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round" />
                    <path
                      d="M2 1L2 13L7 9L12 13L12 1Z"
                      stroke="currentColor"
                      stroke-width="1.3"
                      stroke-linejoin="round"
                      fill="none" />
                  </svg>
                  曲线
                </button>
                <button class="action-btn delete" @click="handleDelete(r)">
                  <svg viewBox="0 0 14 14" fill="none" class="btn-icon">
                    <path
                      d="M3 4H11"
                      stroke="currentColor"
                      stroke-width="1.3"
                      stroke-linecap="round" />
                    <path
                      d="M5.5 4V3C5.5 2.45 5.95 2 6.5 2H7.5C8.05 2 8.5 2.45 8.5 3V4"
                      stroke="currentColor"
                      stroke-width="1.3" />
                    <path
                      d="M11 4V11.5C11 12.05 10.55 12.5 10 12.5H4C3.45 12.5 3 12.05 3 11.5V4"
                      stroke="currentColor"
                      stroke-width="1.3" />
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
                  <rect
                    x="8"
                    y="10"
                    width="32"
                    height="28"
                    rx="4"
                    stroke="#1a3350"
                    stroke-width="2" />
                  <line
                    x1="14"
                    y1="18"
                    x2="34"
                    y2="18"
                    stroke="#1a3350"
                    stroke-width="1.5"
                    opacity="0.5" />
                  <line
                    x1="14"
                    y1="24"
                    x2="28"
                    y2="24"
                    stroke="#1a3350"
                    stroke-width="1.5"
                    opacity="0.3" />
                  <line
                    x1="14"
                    y1="30"
                    x2="22"
                    y2="30"
                    stroke="#1a3350"
                    stroke-width="1.5"
                    opacity="0.2" />
                </svg>
                <p>暂无历史记录</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination" v-if="totalPages > 1">
      <button
        class="page-btn"
        :disabled="currentPage <= 1"
        @click="handlePageChange(currentPage - 1)">
        上一页
      </button>
      <template v-for="p in totalPages" :key="p">
        <button
          v-if="p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2"
          class="page-btn"
          :class="{ active: p === currentPage }"
          @click="handlePageChange(p)">
          {{ p }}
        </button>
        <span
          v-else-if="Math.abs(p - currentPage) === 3"
          class="page-ellipsis">
          …
        </span>
      </template>
      <button
        class="page-btn"
        :disabled="currentPage >= totalPages"
        @click="handlePageChange(currentPage + 1)">
        下一页
      </button>
      <span class="page-info">共 {{ total }} 条</span>
    </div>

    <!-- 曲线弹窗 -->
    <Teleport to="body">
      <div
        v-if="detailVisible"
        class="modal-overlay"
        @click.self="detailVisible = false">
          <div class="modal-card">
            <div class="modal-header">
              <div class="modal-header-left">
                <h3 class="modal-title">电流曲线</h3>
                <span class="modal-subtitle">
                  {{ currentRecord?.device_name }} ·
                  {{ opTypeLabels[currentRecord?.op_type || ""] }}
                </span>
              </div>
              <button class="modal-close" @click="detailVisible = false">
                <svg viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4L12 12M12 4L4 12"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <div class="modal-stats">
              <div class="stat-block">
                <span class="stat-label">峰值电流</span>
                <span class="stat-value peak"
                  >{{ currentRecord?.peak_current }}<small>A</small></span
                >
              </div>
              <div class="stat-block">
                <span class="stat-label">谷值电流</span>
                <span class="stat-value valley"
                  >{{ currentRecord?.valley_current }}<small>A</small></span
                >
              </div>
              <div class="stat-block">
                <span class="stat-label">测试时间</span>
                <span class="stat-value time">{{
                  formatDate(currentRecord?.created_at || "")
                }}</span>
              </div>
            </div>
            <div
              class="modal-result"
              v-if="
                currentRecord?.result &&
                JSON.parse(currentRecord.result).length > 0
              ">
              <span class="result-section-label">检测项</span>
              <div class="result-tags">
                <span
                  v-for="(item, idx) in JSON.parse(currentRecord.result)"
                  :key="idx"
                  class="result-tag"
                  :class="item.status ? 'pass' : 'fail'">
                  <span class="result-check">{{
                    item.status ? "✓" : "✗"
                  }}</span>
                  {{ item.name }}
                  <span class="relay-name" v-if="item.relayName?.length">
                    ({{ item.relayName.join(", ") }})
                  </span>
                </span>
              </div>
            </div>
            <div v-else class="modal-result">
              <span class="result-tag fail">未检测</span>
            </div>
            <div ref="chartContainer" class="modal-chart">
              <v-chart :option="chartOpt" autoresize />
            </div>
          </div>
        </div>
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

/* ---- Search Bar ---- */
.search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 16px;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
  flex-shrink: 0;
}

.search-fields {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
}

.search-input {
  width: 130px;
  padding: 6px 10px;
  background: #051424;
  border: 1px solid #1a2d44;
  border-radius: 5px;
  color: #c0d0e0;
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input::placeholder {
  color: #4a6078;
}

.search-input:focus {
  border-color: #2d5280;
}

.search-select {
  width: 110px;
  padding: 6px 10px;
  background: #051424;
  border: 1px solid #1a2d44;
  border-radius: 5px;
  color: #c0d0e0;
  font-size: 12px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}

.search-select:focus {
  border-color: #2d5280;
}

.search-select option {
  background: #0b1d33;
  color: #c0d0e0;
}

.search-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.search-btn {
  padding: 6px 16px;
  background: rgba(90, 146, 208, 0.2);
  border: 1px solid #2d5280;
  border-radius: 5px;
  color: #8fb4d8;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.search-btn:hover {
  background: rgba(90, 146, 208, 0.35);
  color: #fff;
}

.reset-btn {
  padding: 6px 16px;
  background: transparent;
  border: 1px solid #1a2d44;
  border-radius: 5px;
  color: #5a7288;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  border-color: #2d5280;
  color: #8fb4d8;
}

/* ---- Pagination ---- */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 0;
  flex-shrink: 0;
}

.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 5px;
  color: #8fb4d8;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: #2d5280;
  background: rgba(90, 146, 208, 0.15);
}

.page-btn.active {
  background: rgba(90, 146, 208, 0.25);
  border-color: #5a92d0;
  color: #fff;
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-ellipsis {
  width: 32px;
  text-align: center;
  color: #5a7288;
  font-size: 14px;
}

.page-info {
  margin-left: 8px;
  color: #5a7288;
  font-size: 12px;
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
.col-idx {
  width: 40px;
  text-align: center;
}
.col-device {
  min-width: 150px;
}
.col-combo {
  min-width: 120px;
}
.col-config {
  min-width: 120px;
}
.col-op {
  width: 80px;
}
.col-status {
  width: 90px;
}
.col-result {
  min-width: 160px;
}
.col-num {
  width: 70px;
  text-align: right;
}
.col-time {
  min-width: 150px;
}
.col-action {
  width: 150px;
}

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

</style>
