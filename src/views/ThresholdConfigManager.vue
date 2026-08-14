<script setup lang="ts">
import { onMounted, ref } from "vue";
import { HTTP_URL } from "@/config/config";
import { useToast } from "@/composables/useToast";

const { withLoading } = useToast();

interface ThresholdRow {
  device_type: string;
  normal_min: number;
  normal_max: number;
  open_min: number;
  short_max: number;
}

const rows = ref<ThresholdRow[]>([]);

const showModal = ref(false);
const isEdit = ref(false);
const editKey = ref("");

const form = ref({
  device_type: "",
  normal_min: 1,
  normal_max: 40,
  open_min: 10000,
  short_max: 0.5,
});

function openAdd() {
  isEdit.value = false;
  editKey.value = "";
  form.value = { device_type: "", normal_min: 1, normal_max: 40, open_min: 10000, short_max: 0.5 };
  showModal.value = true;
}

function openEdit(row: ThresholdRow) {
  isEdit.value = true;
  editKey.value = row.device_type;
  form.value = {
    device_type: row.device_type,
    normal_min: row.normal_min,
    normal_max: row.normal_max,
    open_min: row.open_min,
    short_max: row.short_max,
  };
  showModal.value = true;
}

async function getList() {
  const response = await fetch(HTTP_URL + "/getResistanceThresholds", {
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
    normal_min: Number(form.value.normal_min),
    normal_max: Number(form.value.normal_max),
    open_min: Number(form.value.open_min),
    short_max: Number(form.value.short_max),
  };
  await withLoading(async () => {
    const response = await fetch(HTTP_URL + "/saveResistanceThreshold", {
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
      `${HTTP_URL}/deleteResistanceThreshold/${device_type}`,
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
      <h2 class="page-title">阻值阈值配置</h2>
      <button class="add-btn" @click="openAdd">+ 添加机型阈值</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>机型</th>
          <th>正常下限 normalMin (Ω)</th>
          <th>正常上限 normalMax (Ω)</th>
          <th>开路下限 openMin (Ω)</th>
          <th>混线上限 shortMax (Ω)</th>
          <th style="width: 160px; text-align: center">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.device_type">
          <td>{{ row.device_type }}</td>
          <td>{{ row.normal_min }}</td>
          <td>{{ row.normal_max }}</td>
          <td>{{ row.open_min }}</td>
          <td>{{ row.short_max }}</td>
          <td class="actions">
            <button class="action-btn edit" @click="openEdit(row)">编辑</button>
            <button class="action-btn delete" @click="remove(row.device_type)">
              删除
            </button>
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="6" class="empty-row">
            暂无阈值配置（未配置机型将使用默认值：normalMin=1 / normalMax=40 /
            openMin=10000 / shortMax=0.5）
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-card">
        <h3 class="modal-title">{{ isEdit ? "编辑阻值阈值" : "添加阻值阈值" }}</h3>
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
              正常下限 normalMin
              <input
                v-model.number="form.normal_min"
                type="number"
                step="0.1"
                class="modal-input"
                placeholder="1" />
            </label>
            <label>
              正常上限 normalMax
              <input
                v-model.number="form.normal_max"
                type="number"
                step="0.1"
                class="modal-input"
                placeholder="40" />
            </label>
            <label>
              开路下限 openMin
              <input
                v-model.number="form.open_min"
                type="number"
                step="0.1"
                class="modal-input"
                placeholder="10000" />
            </label>
            <label>
              混线上限 shortMax
              <input
                v-model.number="form.short_max"
                type="number"
                step="0.1"
                class="modal-input"
                placeholder="0.5" />
            </label>
          </div>

          <p class="hint">
            判定规则：阻值 ≤ shortMax 判为混线；≥ openMin 判为开路；normalMin ~
            normalMax 判为正常；其余区间判为无法判定。
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
  width: 560px;
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
