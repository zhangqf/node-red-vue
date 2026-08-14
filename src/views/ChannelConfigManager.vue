<script setup lang="ts">
import { onMounted, ref } from "vue";
import { HTTP_URL } from "@/config/config";
import { useToast } from "@/composables/useToast";

const { withLoading } = useToast();

interface ChannelItem {
  name: string;
  dcExpect: "NORMAL" | "OPEN";
  fcExpect: "NORMAL" | "OPEN";
  dcShortTip: string;
  fcShortTip: string;
  openFaultTip: string;
  circuitField: string;
}

interface ChannelConfigRow {
  device_type: string;
  config: ChannelItem[];
}

const rows = ref<ChannelConfigRow[]>([]);

const showModal = ref(false);
const isEdit = ref(false);
const editKey = ref("");

const form = ref({
  device_type: "",
  config: [] as ChannelItem[],
});

function emptyChannel(): ChannelItem {
  return {
    name: "",
    dcExpect: "NORMAL",
    fcExpect: "OPEN",
    dcShortTip: "",
    fcShortTip: "",
    openFaultTip: "",
    circuitField: "",
  };
}

function toggleExpect(ch: ChannelItem, field: "dcExpect" | "fcExpect") {
  ch[field] = ch[field] === "NORMAL" ? "OPEN" : "NORMAL";
}

function addChannel() {
  form.value.config.push(emptyChannel());
}

function removeChannel(index: number) {
  form.value.config.splice(index, 1);
}

function openAdd() {
  isEdit.value = false;
  editKey.value = "";
  form.value = { device_type: "", config: [emptyChannel()] };
  showModal.value = true;
}

function openEdit(row: ChannelConfigRow) {
  isEdit.value = true;
  editKey.value = row.device_type;
  form.value = {
    device_type: row.device_type,
    config: row.config.map((c) => ({ ...c })),
  };
  showModal.value = true;
}

async function getList() {
  const response = await fetch(HTTP_URL + "/getChannelConfigs", {
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
    config: form.value.config,
  };
  await withLoading(async () => {
    const response = await fetch(HTTP_URL + "/saveChannelConfig", {
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
      `${HTTP_URL}/deleteChannelConfig/${device_type}`,
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
      <h2 class="page-title">通道配置管理</h2>
      <button class="add-btn" @click="openAdd">+ 添加机型配置</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>机型</th>
          <th>通道数</th>
          <th>通道名称</th>
          <th style="width: 160px; text-align: center">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.device_type">
          <td>{{ row.device_type }}</td>
          <td>{{ row.config?.length ?? 0 }}</td>
          <td>{{ (row.config || []).map((c) => c.name).join("、") }}</td>
          <td class="actions">
            <button class="action-btn edit" @click="openEdit(row)">编辑</button>
            <button class="action-btn delete" @click="remove(row.device_type)">
              删除
            </button>
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="4" class="empty-row">暂无通道配置</td>
        </tr>
      </tbody>
    </table>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-card">
        <h3 class="modal-title">{{ isEdit ? "编辑通道配置" : "添加通道配置" }}</h3>
        <div class="modal-body">
          <div class="form-row">
            <label>机型</label>
            <input
              v-model="form.device_type"
              class="modal-input"
              placeholder="ZD6 / ZD9 / ZYJ7 / ZDJ9"
              :disabled="isEdit" />
          </div>

          <div class="channel-list">
            <div v-for="(ch, i) in form.config" :key="i" class="channel-card">
              <div class="channel-header">
                <span class="channel-title">通道 {{ i + 1 }}</span>
                <button class="remove-btn" @click="removeChannel(i)">删除</button>
              </div>
              <div class="channel-grid">
                <label>
                  通道名称
                  <input v-model="ch.name" class="modal-input" placeholder="第3路" />
                </label>
                <label>
                  定操期望
                  <button
                    type="button"
                    class="expect-chip"
                    :class="ch.dcExpect === 'NORMAL' ? 'ok' : 'ng'"
                    @click="toggleExpect(ch, 'dcExpect')">
                    {{ ch.dcExpect }}
                  </button>
                </label>
                <label>
                  反操期望
                  <button
                    type="button"
                    class="expect-chip"
                    :class="ch.fcExpect === 'NORMAL' ? 'ok' : 'ng'"
                    @click="toggleExpect(ch, 'fcExpect')">
                    {{ ch.fcExpect }}
                  </button>
                </label>
                <label>
                  关联回路
                  <input v-model="ch.circuitField" class="modal-input" placeholder="DWBS" />
                </label>
                <label>
                  定操混线提示
                  <input v-model="ch.dcShortTip" class="modal-input" placeholder="D1D2混线" />
                </label>
                <label>
                  反操混线提示
                  <input v-model="ch.fcShortTip" class="modal-input" placeholder="D1D2混线" />
                </label>
                <label class="full">
                  开路故障提示
                  <input
                    v-model="ch.openFaultTip"
                    class="modal-input"
                    placeholder="D1至绕组1断线或D2至绕组2断线" />
                </label>
              </div>
            </div>
          </div>

          <button class="add-relay-btn" @click="addChannel">+ 添加通道</button>
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
  width: 860px;
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

.channel-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.channel-card {
  border: 1px solid #1a2d44;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.channel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.channel-title {
  font-size: 13px;
  font-weight: 600;
  color: #8fb4d8;
}

.remove-btn {
  background: transparent;
  border: none;
  color: #f87171;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
}

.remove-btn:hover {
  color: #e8473b;
}

.channel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 10px 12px;
}

.channel-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #5a7288;
}

.channel-grid label.full {
  grid-column: span 4;
}

.expect-chip {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.expect-chip.ok {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.3);
}

.add-relay-btn {
  background: transparent;
  border: 1px solid #1a6b3c;
  color: #34d399;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.add-relay-btn:hover {
  background: rgba(52, 211, 153, 0.1);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}
</style>
