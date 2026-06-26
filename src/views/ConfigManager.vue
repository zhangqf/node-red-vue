<script setup lang="ts">
import { onMounted, ref } from "vue";
import { HTTP_URL } from "@/config/config";

interface Relay {
  relay_name: string;
  default_status: 0 | 1;
  sort_order: number;
}

interface Config {
  id: string;
  name: string;
  description: string;
  relaysNum?: number;
  relays: Relay[];
}

/* ---- 显示模式开关 ---- */
const showOkNg = ref(true);
const showTrueFalse = ref(false);
const showArrow = ref(true);

/* ---- 深拷贝 relays，兼容 API 返回空数组 ---- */
function cloneRelays(list: Relay[] | undefined | null): Relay[] {
  if (!Array.isArray(list)) return [];
  return list.map((r) => ({ ...r }));
}

const configs = ref<Config[]>([
  // {
  //   id: "1",
  //   name: "定位→反位 拉力曲线",
  //   description: "标准拉力曲线检测参数",
  //   relaysNum: 12,
  //   relays: [
  //     { relay_name: "KA1", default_status: 0, sort_order: 1 },
  //     { relay_name: "KA2", default_status: 0, sort_order: 2 },
  //     { relay_name: "KA3", default_status: 0, sort_order: 3 },
  //     { relay_name: "KA4", default_status: 1, sort_order: 4 },
  //     { relay_name: "KA5", default_status: 0, sort_order: 5 },
  //     { relay_name: "KA6", default_status: 0, sort_order: 6 },
  //     { relay_name: "KA7", default_status: 0, sort_order: 7 },
  //     { relay_name: "KA8", default_status: 0, sort_order: 8 },
  //     { relay_name: "KA9", default_status: 0, sort_order: 9 },
  //     { relay_name: "KA10", default_status: 0, sort_order: 10 },
  //     { relay_name: "KA11", default_status: 0, sort_order: 11 },
  //     { relay_name: "KA12", default_status: 0, sort_order: 12 },
  //   ],
  // },
  // {
  //   id: "2",
  //   name: "驱动回路 导通检测",
  //   description: "X1-C1, X2-C10 回路导通参数",
  //   relaysNum: 12,
  //   relays: [
  //     { relay_name: "X1", default_status: 1, sort_order: 1 },
  //     { relay_name: "X2", default_status: 1, sort_order: 2 },
  //     { relay_name: "X3", default_status: 0, sort_order: 3 },
  //   ],
  // },
  // {
  //   id: "3",
  //   name: "表示回路 导通检测",
  //   description: "X1, X2 回路导通参数",
  //   relaysNum: ,
  //   relays: [
  //     { relay_name: "X1", default_status: 1, sort_order: 1 },
  //     { relay_name: "X2", default_status: 1, sort_order: 2 },
  //   ],
  // },
]);

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref("");
const form = ref({ name: "", description: "", relays: [] as Relay[] });

/* ---- 绑定状态 ---- */
const boundIds = ref<Set<string>>(new Set());

async function fetchBoundIds() {
  try {
    const res = await fetch(HTTP_URL + "/getBoundTestModelIds");
    const ids: string[] = await res.json();
    boundIds.value = new Set(ids);
  } catch {}
}

/* ---- 继电器编辑 ---- */
function addRelay() {
  const nextOrder = form.value.relays.length + 1;
  form.value.relays.push({
    relay_name: "",
    default_status: 0,
    sort_order: nextOrder,
  });
}

function removeRelay(index: number) {
  form.value.relays.splice(index, 1);
  form.value.relays.forEach((r, i) => (r.sort_order = i + 1));
}

function toggleRelayStatus(index: number) {
  const r = form.value.relays[index];
  r.default_status = r.default_status === 1 ? 0 : 1;
}

/* ---- 增/改/查 ---- */
function openAdd() {
  isEdit.value = false;
  editId.value = "";
  form.value = { name: "", description: "", relays: [] };
  showModal.value = true;
}

function openEdit(cfg: Config) {
  isEdit.value = true;
  editId.value = cfg.id;
  form.value = {
    name: cfg.name,
    description: cfg.description,
    relays: cloneRelays(cfg.relays),
  };
  showModal.value = true;
}

function viewDetail(cfg: Config) {
  isEdit.value = true;
  editId.value = cfg.id;
  form.value = {
    name: cfg.name,
    description: cfg.description,
    relays: cloneRelays(cfg.relays),
  };
  showModal.value = true;
}

function saveAsCopy(cfg: Config) {
  isEdit.value = false;
  editId.value = "";
  form.value = {
    name: cfg.name + " (副本)",
    description: cfg.description,
    relays: cloneRelays(cfg.relays),
  };
  showModal.value = true;
}

async function save() {
  const payload = {
    id: isEdit.value ? editId.value : "",
    name: form.value.name,
    description: form.value.description,
    relays: form.value.relays.map((r) => ({ ...r })),
  };

  if (isEdit.value && !boundIds.value.has(editId.value)) {
    const idx = configs.value.findIndex((c) => c.id === editId.value);
    if (idx !== -1) {
      configs.value[idx] = {
        id: editId.value,
        name: payload.name,
        description: payload.description,
        relays: form.value.relays,
      };
    }
  } else {
    configs.value.push({
      id: String(Date.now()),
      name: payload.name,
      description: payload.description,
      relays: form.value.relays,
    });
  }

  try {
    const response = await fetch(HTTP_URL + "/saveConfig", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("Node-RED回应:", data);
  } catch (error) {
    console.error("提交失败:", error);
  }
  getList();
  showModal.value = false;
}

async function remove(id: string) {
  try {
    await fetch(HTTP_URL + "/deleteConfig", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch {}
  configs.value = configs.value.filter((c) => c.id !== id);
}

const getList = async () => {
  try {
    const response = await fetch(HTTP_URL + "/getConfig", {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    configs.value = await response.json();
  } catch {}
};

onMounted(() => {
  getList();
  // fetchBoundIds();
});
</script>

<template>
  <div class="manager-page">
    <div class="page-header">
      <h2 class="page-title">测试机型管理</h2>
      <button class="add-btn" @click="openAdd">+ 添加配置</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>配置名称</th>
          <th>描述</th>
          <th style="width: 80px; text-align: center">继电器数</th>
          <th style="width: 160px">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cfg in configs" :key="cfg.id">
          <td>
            <span>
              {{ cfg.name }}
              <em v-if="boundIds.has(cfg.id)" class="bound-mark">[已绑定]</em>
            </span>
          </td>
          <td>{{ cfg.description }}</td>
          <td style="text-align: center">{{ cfg.relaysNum ?? 0 }}</td>
          <td class="actions">
            <template v-if="!boundIds.has(cfg.id)">
              <button class="action-btn edit" @click="openEdit(cfg)">
                编辑
              </button>
              <button class="action-btn delete" @click="remove(cfg.id)">
                删除
              </button>
            </template>
            <template v-else>
              <button class="action-btn view" @click="viewDetail(cfg)">
                查看
              </button>
              <button class="action-btn save-as" @click="saveAsCopy(cfg)">
                另存为
              </button>
            </template>
          </td>
        </tr>
        <tr v-if="configs.length === 0">
          <td colspan="4" class="empty-row">暂无配置</td>
        </tr>
      </tbody>
    </table>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-card">
        <h3 class="modal-title">
          {{
            boundIds.has(editId) ? "查看配置" : isEdit ? "编辑配置" : "添加配置"
          }}
        </h3>
        <div class="modal-body">
          <label>配置名称</label>
          <input
            v-model="form.name"
            class="modal-input"
            :disabled="boundIds.has(editId)" />

          <label>描述</label>
          <input
            v-model="form.description"
            class="modal-input"
            :disabled="boundIds.has(editId)" />

          <label>继电器配置</label>

          <!-- 显示模式开关 -->
          <div class="display-toggles">
            <span class="toggle-hint">状态显示：</span>
            <label class="toggle-label" :class="{ on: showOkNg }">
              <input type="checkbox" v-model="showOkNg" /> OK/NG
            </label>
            <label class="toggle-label" :class="{ on: showTrueFalse }">
              <input type="checkbox" v-model="showTrueFalse" /> TRUE/FALSE
            </label>
            <label class="toggle-label" :class="{ on: showArrow }">
              <input type="checkbox" v-model="showArrow" /> 箭头
            </label>
          </div>

          <div class="relay-table-wrapper">
            <table class="relay-table">
              <thead>
                <tr>
                  <th style="width: 44px">#</th>
                  <th>继电器名称</th>
                  <th style="width: 130px">状态</th>
                  <th v-if="!boundIds.has(editId)" style="width: 44px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in form.relays" :key="i">
                  <td class="sort-cell">{{ r.sort_order }}</td>
                  <td>
                    <input
                      v-model="r.relay_name"
                      class="relay-input"
                      placeholder="如 KA1, X1"
                      :disabled="boundIds.has(editId)" />
                  </td>
                  <td class="status-cell">
                    <div class="status-parts">
                      <button
                        v-if="showOkNg"
                        class="status-chip"
                        :class="{
                          ok: r.default_status === 1,
                          ng: r.default_status === 0,
                        }"
                        :disabled="boundIds.has(editId)"
                        @click="toggleRelayStatus(i)">
                        {{ r.default_status === 1 ? "OK" : "NG" }}
                      </button>
                      <button
                        v-if="showTrueFalse"
                        class="status-chip"
                        :class="{
                          ok: r.default_status === 1,
                          ng: r.default_status === 0,
                        }"
                        :disabled="boundIds.has(editId)"
                        @click="toggleRelayStatus(i)">
                        {{ r.default_status === 1 ? "TRUE" : "FALSE" }}
                      </button>
                      <button
                        v-if="showArrow"
                        class="status-chip arrow-icon"
                        :class="{
                          ok: r.default_status === 1,
                          ng: r.default_status === 0,
                        }"
                        :disabled="boundIds.has(editId)"
                        @click="toggleRelayStatus(i)">
                        {{ r.default_status === 1 ? "↑" : "↓" }}
                      </button>
                    </div>
                  </td>
                  <td v-if="!boundIds.has(editId)" style="text-align: center">
                    <button class="relay-remove-btn" @click="removeRelay(i)">
                      ×
                    </button>
                  </td>
                </tr>
                <tr v-if="form.relays.length === 0">
                  <td colspan="4" class="relay-empty">
                    暂无继电器，点击下方按钮添加
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            v-if="!boundIds.has(editId)"
            class="add-relay-btn"
            @click="addRelay">
            + 添加继电器
          </button>
        </div>
        <div class="modal-footer">
          <button class="action-btn cancel" @click="showModal = false">
            取消
          </button>
          <button
            v-if="!boundIds.has(editId)"
            class="action-btn save"
            @click="save">
            保存
          </button>
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

.bound-mark {
  font-style: normal;
  color: #e9c235;
  font-size: 11px;
  margin-left: 6px;
}

.actions {
  display: flex;
  gap: 8px;
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

.action-btn.delete {
  background: rgba(217, 48, 37, 0.2);
  color: #f87171;
}

.action-btn.delete:hover {
  background: rgba(217, 48, 37, 0.4);
}

.action-btn.view {
  background: #1a3350;
  color: #8fb4d8;
}

.action-btn.save-as {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.action-btn.save-as:hover {
  background: rgba(52, 211, 153, 0.25);
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
  width: 580px;
  max-height: 82vh;
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
  gap: 6px;
  margin-bottom: 20px;
  flex: 1;
  min-height: 0;
}

.modal-body > label {
  font-size: 12px;
  color: #5a7288;
  margin-top: 8px;
}

.modal-body > label:first-child {
  margin-top: 0;
}

.modal-input {
  background: #051424;
  border: 1px solid #1a2d44;
  color: #e0e8f0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.modal-input:focus {
  border-color: #2d5280;
}

.modal-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 显示模式开关 */
.display-toggles {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.toggle-hint {
  font-size: 11px;
  color: #5a7288;
  margin-right: 4px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #5a7288;
  padding: 2px 8px;
  border: 1px solid #1a2d44;
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.toggle-label.on {
  color: #8fb4d8;
  border-color: #2a4a68;
  background: rgba(90, 146, 208, 0.1);
}

.toggle-label input[type="checkbox"] {
  width: 12px;
  height: 12px;
  accent-color: #5a92d0;
}

/* 继电器表格 */
.relay-table-wrapper {
  border: 1px solid #1a2d44;
  border-radius: 6px;
  overflow: hidden;
  max-height: 260px;
  overflow-y: auto;
}

.relay-table {
  width: 100%;
  border-collapse: collapse;
}

.relay-table th {
  background: #051424;
  color: #5a7288;
  font-size: 11px;
  font-weight: 500;
  padding: 6px 10px;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
}

.relay-table td {
  padding: 4px 10px;
  border-top: 1px solid #1a2d44;
}

.sort-cell {
  color: #5a7288;
  font-size: 12px;
  text-align: center;
}

.relay-input {
  width: 100%;
  background: #051424;
  border: 1px solid #1a2d44;
  color: #e0e8f0;
  padding: 5px 8px;
  border-radius: 3px;
  font-size: 12px;
  outline: none;
}

.relay-input:focus {
  border-color: #2d5280;
}

.relay-input:disabled {
  opacity: 0.6;
}

.status-cell {
  text-align: center;
}

.status-parts {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.status-chip {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 36px;
  text-align: center;
}

.status-chip.ok {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.3);
}

.status-chip:disabled {
  cursor: default;
  opacity: 0.7;
}

.status-chip.arrow-icon {
  font-size: 14px;
  min-width: 28px;
  padding: 1px 8px;
}

.relay-remove-btn {
  background: transparent;
  border: none;
  color: #f87171;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.relay-remove-btn:hover {
  color: #e8473b;
}

.relay-empty {
  text-align: center;
  color: #5a7288;
  font-size: 12px;
  padding: 16px;
}

.add-relay-btn {
  background: transparent;
  border: 1px dashed #2a4a68;
  color: #8fb4d8;
  font-size: 12px;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 4px;
}

.add-relay-btn:hover {
  border-color: #5a92d0;
  color: #b8d4f0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}
</style>
