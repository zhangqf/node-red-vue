<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { HTTP_URL } from "@/config/config";
import { useToast } from "@/composables/useToast";

const { withLoading } = useToast();

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
  indicationRelays: Relay[];
  contact_13_closed?: Record<string, string[]>;
  contact_24_closed?: Record<string, string[]>;
}

const actionGroups = ["DC", "FC"];
const indicationGroups = [
  "DWBS",
  "FWBS",
  "YJCDDWBS",
  "YJCDFWBS",
  "EJCDDWBS",
  "EJCDFWBS",
];
const contactGroups = [...actionGroups, ...indicationGroups];
const contactGroupLabels: Record<string, string> = {
  DC: "定操",
  FC: "反操",
  DWBS: "定位表示",
  FWBS: "反位表示",
  YJCDDWBS: "一级传动定位表示",
  YJCDFWBS: "一级传动反位表示",
  EJCDDWBS: "二级传动定位表示",
  EJCDFWBS: "二级传动反位表示",
};

/* ---- 折叠 ---- */
const expandedGroups = ref<Record<string, boolean>>({});

function toggleGroup(g: string) {
  expandedGroups.value[g] = !expandedGroups.value[g];
}

function isGroupExpanded(g: string): boolean {
  return expandedGroups.value[g] ?? false;
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

const configs = ref<Config[]>([]);

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref("");
const form = ref({
  name: "",
  description: "",
  relays: [] as Relay[],
  indicationRelays: [] as Relay[],
  contact_13_closed: {} as Record<string, string[]>,
  contact_24_closed: {} as Record<string, string[]>,
});

/* ---- 绑定状态 ---- */
const boundIds = ref<Set<string>>(new Set());

async function fetchBoundIds() {
  try {
    const res = await fetch(HTTP_URL + "/getBoundConfigsIds");
    const { data } = await res.json();
    const ids: string[] = data;
    boundIds.value = new Set(ids);
  } catch {}
}

/* ---- 继电器编辑 ---- */
const relayTableRef = ref<HTMLElement | null>(null);

function addRelay() {
  const nextOrder = form.value.relays.length + 1;
  form.value.relays.push({
    relay_name: "",
    default_status: 0,
    sort_order: nextOrder,
  });
  nextTick(() => {
    if (relayTableRef.value) {
      relayTableRef.value.scrollTop = relayTableRef.value.scrollHeight;
    }
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

/* ---- 表示继电器编辑 ---- */
const indicationTableRef = ref<HTMLElement | null>(null);

function addIndicationRelay() {
  const nextOrder = form.value.indicationRelays.length + 1;
  form.value.indicationRelays.push({
    relay_name: "",
    default_status: 0,
    sort_order: nextOrder,
  });
  nextTick(() => {
    if (indicationTableRef.value) {
      indicationTableRef.value.scrollTop =
        indicationTableRef.value.scrollHeight;
    }
  });
}

function removeIndicationRelay(index: number) {
  form.value.indicationRelays.splice(index, 1);
  form.value.indicationRelays.forEach((r, i) => (r.sort_order = i + 1));
}

function toggleIndicationRelayStatus(index: number) {
  const r = form.value.indicationRelays[index];
  r.default_status = r.default_status === 1 ? 0 : 1;
}

function relayNames(): string[] {
  return form.value.relays.filter((r) => r.relay_name).map((r) => r.relay_name);
}

function indicationNames(): string[] {
  return form.value.indicationRelays
    .filter((r) => r.relay_name)
    .map((r) => r.relay_name);
}

function isIndicationGroup(g: string): boolean {
  return indicationGroups.includes(g);
}

function getContactData(target: "13" | "24"): Record<string, string[]> {
  return target === "13"
    ? form.value.contact_13_closed
    : form.value.contact_24_closed;
}

function toggleActionRelay(target: "13" | "24", group: string, name: string) {
  const data = getContactData(target);
  const arr = data[group];
  if (!arr) {
    data[group] = [name];
    return;
  }
  const idx = arr.indexOf(name);
  if (idx === -1) {
    arr.push(name);
  } else {
    arr.splice(idx, 1);
  }
}

function isActionRelaySelected(
  target: "13" | "24",
  group: string,
  name: string,
): boolean {
  return getContactData(target)[group]?.includes(name) ?? false;
}

/* ---- 增/改/查 ---- */
function emptyContactData(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  contactGroups.forEach((g) => (map[g] = []));
  return map;
}

function openAdd() {
  isEdit.value = false;
  editId.value = "";
  form.value = {
    name: "",
    description: "",
    relays: [],
    indicationRelays: [],
    contact_13_closed: emptyContactData(),
    contact_24_closed: emptyContactData(),
  };
  showModal.value = true;
}

function normalizeContactData(
  raw: string | Record<string, string | string[]> | undefined,
): Record<string, string[]> {
  const base = emptyContactData();
  if (!raw) return base;
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return base;
    }
  }
  for (const g of contactGroups) {
    const val = (data as Record<string, any>)[g];
    if (Array.isArray(val)) {
      base[g] = val;
    } else if (typeof val === "string" && val) {
      base[g] = [val];
    }
  }
  return base;
}

function openEdit(cfg: Config) {
  isEdit.value = true;
  editId.value = cfg.id;
  form.value = {
    name: cfg.name,
    description: cfg.description,
    relays: cloneRelays(cfg.relays),
    indicationRelays: cloneRelays(cfg.indicationRelays),
    contact_13_closed: normalizeContactData(cfg.contact_13_closed),
    contact_24_closed: normalizeContactData(cfg.contact_24_closed),
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
    indicationRelays: cloneRelays(cfg.indicationRelays),
    contact_13_closed: normalizeContactData(cfg.contact_13_closed),
    contact_24_closed: normalizeContactData(cfg.contact_24_closed),
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
    indicationRelays: cloneRelays(cfg.indicationRelays),
    contact_13_closed: normalizeContactData(cfg.contact_13_closed),
    contact_24_closed: normalizeContactData(cfg.contact_24_closed),
  };
  showModal.value = true;
}

async function save() {
  console.log(form.value);
  const payload: Record<string, any> = {
    name: form.value.name,
    description: form.value.description,
    relays: form.value.relays.map((r) => ({ ...r })),
    indicationRelays: form.value.indicationRelays.map((r) => ({ ...r })),
    contact_13_closed: { ...form.value.contact_13_closed },
    contact_24_closed: { ...form.value.contact_24_closed },
  };
  if (isEdit.value) {
    payload.id = editId.value;
  }

  if (isEdit.value && !boundIds.value.has(editId.value)) {
    const idx = configs.value.findIndex((c) => c.id === editId.value);
    if (idx !== -1) {
      configs.value[idx] = {
        id: editId.value,
        name: payload.name,
        description: payload.description,
        relays: form.value.relays,
        indicationRelays: form.value.indicationRelays,
      };
    }
  } else {
    configs.value.push({
      id: String(Date.now()),
      name: payload.name,
      description: payload.description,
      relays: form.value.relays,
      indicationRelays: form.value.indicationRelays,
    });
  }

  await withLoading(async () => {
    const response = await fetch(HTTP_URL + "/saveConfig", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("Node-RED回应:", data);
  }, "保存成功");
  getList();
  showModal.value = false;
}

const deleteList = async (id: string) => {
  const response = await fetch(`${HTTP_URL}/deleteConfig/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`请求失败，状态码：${response.status}`);
  }

  const data = await response.json();
  console.log("删除接口返回：", data);

  if (data.code !== 200 && data.code !== 0) {
    throw new Error(data.msg || "删除失败");
  }
  return data;
};

async function remove(id: string) {
  const delAction = withLoading(async () => {
    const res = await deleteList(id);
    configs.value = configs.value.filter((c) => c.id !== id);
    return res;
  }, "正在删除...");
  try {
    await delAction();
  } catch (error: any) {
    console.error("删除操作异常：", error);
  }
}

const getList = async () => {
  fetchBoundIds();
  try {
    const response = await fetch(HTTP_URL + "/getConfig", {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    configs.value = await response.json();
  } catch {}
};

onMounted(async () => {
  await withLoading(async () => {
    getList();
  }, "数据加载成功");
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
          <th style="width: 120px; text-align: center">动作继电器数</th>
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
          <div class="form-row">
            <div class="form-col">
              <label>配置名称</label>
              <input
                v-model="form.name"
                class="modal-input"
                :disabled="boundIds.has(editId)" />
            </div>
            <div class="form-col">
              <label>描述</label>
              <input
                v-model="form.description"
                class="modal-input"
                :disabled="boundIds.has(editId)" />
            </div>
          </div>

          <div class="section-header">
            <span class="section-label">继电器配置</span>
            <div class="display-toggles">
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
          </div>

          <div class="relay-layout">
            <div class="relay-left">
              <div class="relay-label">动作继电器</div>
              <div ref="relayTableRef" class="relay-table-wrapper">
                <table class="relay-table">
                  <thead>
                    <tr>
                      <th style="width: 30px">#</th>
                      <th style="width: 100px">名称</th>
                      <th style="text-align: center">状态</th>
                      <th v-if="!boundIds.has(editId)" style="width: 28px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(r, i) in form.relays" :key="i">
                      <td class="sort-cell">{{ r.sort_order }}</td>
                      <td>
                        <input
                          v-model="r.relay_name"
                          class="relay-input"
                          placeholder="KA1"
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
                      <td
                        v-if="!boundIds.has(editId)"
                        style="text-align: center">
                        <button
                          class="relay-remove-btn"
                          @click="removeRelay(i)">
                          ×
                        </button>
                      </td>
                    </tr>
                    <tr v-if="form.relays.length === 0">
                      <td colspan="4" class="relay-empty">暂无继电器</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                v-if="!boundIds.has(editId)"
                class="add-relay-btn"
                @click="addRelay">
                + 添加动作继电器
              </button>

              <div class="relay-label" style="margin-top: 10px">表示继电器</div>
              <div ref="indicationTableRef" class="relay-table-wrapper">
                <table class="relay-table">
                  <thead>
                    <tr>
                      <th style="width: 30px">#</th>
                      <th style="width: 100px">名称</th>
                      <th style="text-align: center">状态</th>
                      <th v-if="!boundIds.has(editId)" style="width: 28px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(r, i) in form.indicationRelays" :key="i">
                      <td class="sort-cell">{{ r.sort_order }}</td>
                      <td>
                        <input
                          v-model="r.relay_name"
                          class="relay-input"
                          placeholder="DB1"
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
                            @click="toggleIndicationRelayStatus(i)">
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
                            @click="toggleIndicationRelayStatus(i)">
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
                            @click="toggleIndicationRelayStatus(i)">
                            {{ r.default_status === 1 ? "↑" : "↓" }}
                          </button>
                        </div>
                      </td>
                      <td
                        v-if="!boundIds.has(editId)"
                        style="text-align: center">
                        <button
                          class="relay-remove-btn"
                          @click="removeIndicationRelay(i)">
                          ×
                        </button>
                      </td>
                    </tr>
                    <tr v-if="form.indicationRelays.length === 0">
                      <td colspan="4" class="relay-empty">暂无继电器</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                v-if="!boundIds.has(editId)"
                class="add-relay-btn"
                @click="addIndicationRelay">
                + 添加表示继电器
              </button>
            </div>

            <div class="contact-panels">
              <!-- 触点 1,3 闭合 -->
              <div class="contact-section">
                <div class="contact-header">触点 1、3 闭合</div>
                <div
                  v-for="g in contactGroups"
                  :key="'13_' + g"
                  class="action-group">
                  <button
                    class="action-group-label"
                    :disabled="boundIds.has(editId)"
                    @click="toggleGroup('13_' + g)">
                    <span
                      class="group-arrow"
                      :class="{ open: isGroupExpanded('13_' + g) }"
                      >&#9654;</span
                    >
                    <span>{{ contactGroupLabels[g] }}</span>
                    <span class="group-count">{{
                      (form.contact_13_closed[g] || []).length
                    }}</span>
                  </button>
                  <div v-if="isGroupExpanded('13_' + g)" class="action-checks">
                    <template v-if="isIndicationGroup(g)">
                      <label
                        v-for="name in indicationNames()"
                        :key="name"
                        class="action-check">
                        <input
                          type="checkbox"
                          :checked="isActionRelaySelected('13', g, name)"
                          :disabled="boundIds.has(editId)"
                          @change="toggleActionRelay('13', g, name)" />
                        <span>{{ name }}</span>
                      </label>
                      <div
                        v-if="indicationNames().length === 0"
                        class="action-empty">
                        暂无表示继电器
                      </div>
                    </template>
                    <template v-else>
                      <label
                        v-for="name in relayNames()"
                        :key="name"
                        class="action-check">
                        <input
                          type="checkbox"
                          :checked="isActionRelaySelected('13', g, name)"
                          :disabled="boundIds.has(editId)"
                          @change="toggleActionRelay('13', g, name)" />
                        <span>{{ name }}</span>
                      </label>
                      <div
                        v-if="relayNames().length === 0"
                        class="action-empty">
                        暂无继电器
                      </div>
                    </template>
                  </div>
                </div>
              </div>

              <!-- 触点 2,4 闭合 -->
              <div class="contact-section">
                <div class="contact-header">触点 2、4 闭合</div>
                <div
                  v-for="g in contactGroups"
                  :key="'24_' + g"
                  class="action-group">
                  <button
                    class="action-group-label"
                    :disabled="boundIds.has(editId)"
                    @click="toggleGroup('24_' + g)">
                    <span
                      class="group-arrow"
                      :class="{ open: isGroupExpanded('24_' + g) }"
                      >&#9654;</span
                    >
                    <span>{{ contactGroupLabels[g] }}</span>
                    <span class="group-count">{{
                      (form.contact_24_closed[g] || []).length
                    }}</span>
                  </button>
                  <div v-if="isGroupExpanded('24_' + g)" class="action-checks">
                    <template v-if="isIndicationGroup(g)">
                      <label
                        v-for="name in indicationNames()"
                        :key="name"
                        class="action-check">
                        <input
                          type="checkbox"
                          :checked="isActionRelaySelected('24', g, name)"
                          :disabled="boundIds.has(editId)"
                          @change="toggleActionRelay('24', g, name)" />
                        <span>{{ name }}</span>
                      </label>
                      <div
                        v-if="indicationNames().length === 0"
                        class="action-empty">
                        暂无表示继电器
                      </div>
                    </template>
                    <template v-else>
                      <label
                        v-for="name in relayNames()"
                        :key="name"
                        class="action-check">
                        <input
                          type="checkbox"
                          :checked="isActionRelaySelected('24', g, name)"
                          :disabled="boundIds.has(editId)"
                          @change="toggleActionRelay('24', g, name)" />
                        <span>{{ name }}</span>
                      </label>
                      <div
                        v-if="relayNames().length === 0"
                        class="action-empty">
                        暂无继电器
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
  width: 980px;
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
  gap: 2px;
  margin-bottom: 16px;
  flex: 1;
  min-height: 0;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-col > label {
  font-size: 12px;
  color: #5a7288;
}

.modal-input {
  background: #051424;
  border: 1px solid #1a2d44;
  color: #e0e8f0;
  padding: 9px 12px;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.modal-input:focus {
  border-color: #2d5280;
}

.modal-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* section 标题行 */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.section-label {
  font-size: 12px;
  color: #5a7288;
  flex-shrink: 0;
}

/* 显示模式开关 */
.display-toggles {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: #5a7288;
  padding: 4px 8px;
  border: 1px solid #1a2d44;
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
  min-height: 28px;
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
.relay-layout {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  min-height: 0;
}

.relay-left {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.relay-label {
  font-size: 12px;
  color: #5a7288;
  padding: 2px 0;
}

.relay-table-wrapper {
  flex: 1;
  border: 1px solid #1a2d44;
  border-radius: 4px;
  overflow: hidden;
  max-height: 210px;
  overflow-y: auto;
  min-width: 0;
  scrollbar-width: thin;
  scrollbar-color: #1a3350 #051424;
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
  padding: 4px 8px;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
}

.relay-table td {
  padding: 4px 8px;
  border-top: 1px solid #1a2d44;
}

.sort-cell {
  color: #5a7288;
  font-size: 12px;
  text-align: center;
}

.relay-input {
  width: 90px;
  background: #051424;
  border: 1px solid #1a2d44;
  color: #e0e8f0;
  padding: 7px 8px;
  border-radius: 3px;
  font-size: 13px;
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
  padding: 4px 6px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 34px;
  min-height: 28px;
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
  min-width: 24px;
  padding: 2px 4px;
}

.relay-remove-btn {
  background: transparent;
  border: none;
  color: #f87171;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  min-width: 30px;
  min-height: 30px;
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
  border: 1px solid #1a6b3c;
  color: #34d399;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  min-height: 30px;
}

.add-relay-btn:hover {
  background: rgba(52, 211, 153, 0.1);
}

/* 触点面板 */
.contact-panels {
  flex: 1;
  display: flex;
  gap: 8px;
  min-width: 0;
}

.contact-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid #1a2d44;
  border-radius: 4px;
  padding: 8px;
  max-height: 500px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #1a3350 #051424;
}

.contact-section::-webkit-scrollbar {
  width: 5px;
}

.contact-section::-webkit-scrollbar-track {
  background: #051424;
}

.contact-section::-webkit-scrollbar-thumb {
  background: #1a3350;
  border-radius: 3px;
}

.contact-section::-webkit-scrollbar-thumb:hover {
  background: #254670;
}

.contact-header {
  font-size: 12px;
  color: #34d399;
  font-weight: 600;
  margin-bottom: 2px;
  padding: 2px 4px;
  border-bottom: 1px solid #1a2d44;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-group-label {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: #8fb4d8;
  font-size: 11px;
  padding: 3px 4px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
  text-align: left;
  min-height: 28px;
}

.action-group-label:hover {
  background: rgba(90, 146, 208, 0.1);
}

.action-group-label:disabled {
  cursor: default;
  opacity: 0.6;
}

.group-arrow {
  font-size: 10px;
  transition: transform 0.15s;
  width: 10px;
  flex-shrink: 0;
}

.group-arrow.open {
  transform: rotate(90deg);
}

.group-count {
  margin-left: auto;
  font-size: 10px;
  color: #5a7288;
  background: #051424;
  padding: 1px 5px;
  border-radius: 8px;
  min-width: 16px;
  text-align: center;
}

.action-checks {
  padding-left: 8px;
}

.action-check {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #c0d0e0;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background 0.15s;
  min-height: 26px;
}

.action-check:hover {
  background: rgba(90, 146, 208, 0.08);
}

.action-check input[type="checkbox"] {
  width: 13px;
  height: 13px;
  accent-color: #5a92d0;
  flex-shrink: 0;
}

.action-check input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-empty {
  font-size: 11px;
  color: #5a7288;
  padding: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.relay-table-wrapper::-webkit-scrollbar {
  width: 6px;
}

.relay-table-wrapper::-webkit-scrollbar-track {
  background: #051424;
}

.relay-table-wrapper::-webkit-scrollbar-thumb {
  background: #1a3350;
  border-radius: 3px;
}

.relay-table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #254670;
}
</style>
