<script setup lang="ts">
import { onMounted, ref } from "vue";
import { HTTP_URL } from "@/config/config";
import { useToast } from "@/composables/useToast";

const { withLoading } = useToast();

interface CurveThresholdRow {
  device_type: string;
  current_peak_min: number;
  current_peak_max: number;
  current_zero_max: number;
  min_points: number;
  power_peak_min: number;
  power_peak_max: number;
  power_zero_max: number;
}

const rows = ref<CurveThresholdRow[]>([]);

const showModal = ref(false);
const isEdit = ref(false);
const editKey = ref("");

const form = ref({
  device_type: "",
  current_peak_min: 0.5,
  current_peak_max: 20,
  current_zero_max: 0.3,
  min_points: 10,
  power_peak_min: 0.05,
  power_peak_max: 50,
  power_zero_max: 0.5,
});

function openAdd() {
  isEdit.value = false;
  editKey.value = "";
  form.value = {
    device_type: "",
    current_peak_min: 0.5,
    current_peak_max: 20,
    current_zero_max: 0.3,
    min_points: 10,
    power_peak_min: 0.05,
    power_peak_max: 50,
    power_zero_max: 0.5,
  };
  showModal.value = true;
}

function openEdit(row: CurveThresholdRow) {
  isEdit.value = true;
  editKey.value = row.device_type;
  form.value = {
    device_type: row.device_type,
    current_peak_min: row.current_peak_min,
    current_peak_max: row.current_peak_max,
    current_zero_max: row.current_zero_max,
    min_points: row.min_points,
    power_peak_min: row.power_peak_min,
    power_peak_max: row.power_peak_max,
    power_zero_max: row.power_zero_max,
  };
  showModal.value = true;
}

async function getList() {
  const response = await fetch(HTTP_URL + "/getCurveThresholds", {
    method: "get",
    headers: { "Content-Type": "application/json" },
  });
  rows.value = await response.json();
}

async function save() {
  if (!form.value.device_type.trim()) {
    return;
  }
  const payload = {
    device_type: form.value.device_type.trim(),
    current_peak_min: Number(form.value.current_peak_min),
    current_peak_max: Number(form.value.current_peak_max),
    current_zero_max: Number(form.value.current_zero_max),
    min_points: Number(form.value.min_points),
    power_peak_min: Number(form.value.power_peak_min),
    power_peak_max: Number(form.value.power_peak_max),
    power_zero_max: Number(form.value.power_zero_max),
  };
  await withLoading(async () => {
    const response = await fetch(HTTP_URL + "/saveCurveThreshold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("Node-RED回应:", data);
  }, "保存成功");
  showModal.value = false;
  getList();
}

async function remove(device_type: string) {
  await withLoading(async () => {
    const response = await fetch(
      `${HTTP_URL}/deleteCurveThreshold/${device_type}`,
      { method: "DELETE", headers: { "Content-Type": "application/json" } },
    );
    const data = await response.json();
    console.log("删除接口返回：", data);
  }, "删除成功");
  getList();
}

onMounted(async () => {
  await withLoading(async () => {
    getList();
  }, "数据加载成功");
});
</script>

<template>
  <div class="manager-page">
    <div class="page-header">
      <h2 class="page-title">曲线判定阈值配置</h2>
      <button class="add-btn" @click="openAdd">+ 添加机型阈值</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>机型</th>
          <th>电流峰值下限 (A)</th>
          <th>电流峰值上限 (A)</th>
          <th>电流归零上限 (A)</th>
          <th>最少采样点数</th>
          <th>功率峰值下限 (KW)</th>
          <th>功率峰值上限 (KW)</th>
          <th>功率归零上限 (KW)</th>
          <th style="width: 160px; text-align: center">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.device_type">
          <td>{{ row.device_type }}</td>
          <td>{{ row.current_peak_min }}</td>
          <td>{{ row.current_peak_max }}</td>
          <td>{{ row.current_zero_max }}</td>
          <td>{{ row.min_points }}</td>
          <td>{{ row.power_peak_min }}</td>
          <td>{{ row.power_peak_max }}</td>
          <td>{{ row.power_zero_max }}</td>
          <td class="actions">
            <button class="action-btn edit" @click="openEdit(row)">编辑</button>
            <button class="action-btn delete" @click="remove(row.device_type)">
              删除
            </button>
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="9" class="empty-row">
            暂无曲线阈值配置（未配置机型将使用默认值：电流峰值 0.5~20A / 归零 ≤0.3A
            / 最少 10 点；功率峰值 0.05~50KW / 归零 ≤0.5KW）
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-card">
        <h3 class="modal-title">{{ isEdit ? "编辑曲线阈值" : "添加曲线阈值" }}</h3>
        <div class="modal-body">
          <div class="form-row">
            <label>机型</label>
            <input
              v-model="form.device_type"
              class="modal-input"
              placeholder="ZD6 / ZD9 / ZYJ7 / ZDJ9"
              :disabled="isEdit" />
          </div>

          <div class="threshold-grid">
            <label>
              电流峰值下限 (A)
              <input
                v-model.number="form.current_peak_min"
                type="number"
                step="0.1"
                class="modal-input" />
            </label>
            <label>
              电流峰值上限 (A)
              <input
                v-model.number="form.current_peak_max"
                type="number"
                step="0.1"
                class="modal-input" />
            </label>
            <label>
              电流归零上限 (A)
              <input
                v-model.number="form.current_zero_max"
                type="number"
                step="0.1"
                class="modal-input" />
            </label>
            <label>
              最少采样点数
              <input
                v-model.number="form.min_points"
                type="number"
                step="1"
                class="modal-input" />
            </label>
            <label>
              功率峰值下限 (KW)
              <input
                v-model.number="form.power_peak_min"
                type="number"
                step="0.01"
                class="modal-input" />
            </label>
            <label>
              功率峰值上限 (KW)
              <input
                v-model.number="form.power_peak_max"
                type="number"
                step="0.01"
                class="modal-input" />
            </label>
            <label>
              功率归零上限 (KW)
              <input
                v-model.number="form.power_zero_max"
                type="number"
                step="0.01"
                class="modal-input" />
            </label>
          </div>

          <p class="hint">
            判定规则：电流峰值落在 min~max 区间、末段电流 ≤ 归零上限、采样点数足够，三者同时满足即判电流曲线正常；
            三相机型额外要求功率峰值落在区间且末段功率归零。综合表示继电器结果后得出最终成功/失败。
          </p>
        </div>
        <div class="modal-footer">
          <button class="action-btn cancel" @click="showModal = false">取消</button>
          <button class="action-btn save" @click="save">保存</button>
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

.add-btn {
  background: #1a6b3c;
  color: #fff;
  border: none;
  font-size: 13px;
  padding: 7px 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.add-btn:hover {
  background: #21884b;
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

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  border: none;
  font-size: 13px;
  padding: 7px 16px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.2s;
  min-height: 34px;
}

.action-btn.edit {
  background: #1a3350;
  color: #8fb4d8;
}

.action-btn.edit:hover {
  background: #254670;
}

.action-btn.delete {
  background: rgba(217, 48, 37, 0.2);
  color: #f87171;
}

.action-btn.delete:hover {
  background: rgba(217, 48, 37, 0.4);
}

.action-btn.save {
  background: #1a6b3c;
  color: #fff;
}

.action-btn.save:hover {
  background: #21884b;
}

.action-btn.cancel {
  background: #1a2d44;
  color: #8a9fb0;
}

.empty-row {
  text-align: center;
  color: #5a7288;
  padding: 40px 0;
  font-size: 12px;
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
  width: 680px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-title {
  font-size: 16px;
  color: #e0e8f0;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row label {
  font-size: 12px;
  color: #5a7288;
}

.modal-input {
  background: #051424;
  border: 1px solid #1a2d44;
  color: #e0e8f0;
  padding: 9px 12px;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  width: 100%;
}

.modal-input:focus {
  border-color: #2d5280;
}

.modal-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.threshold-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
}

.threshold-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #5a7288;
}

.hint {
  font-size: 11px;
  color: #5a7288;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}
</style>
