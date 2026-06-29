<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { HTTP_URL } from "@/config/config";
import { useToast } from "@/composables/useToast";

const route = useRoute();
const { withLoading, showToast } = useToast();

interface Device {
  id: string;
  name: string;
  typeName: string;
  location: string;
}

interface Combination {
  id: string;
  name: string;
  description: string;
  deviceType: string;
}

interface Config {
  id: string;
  name: string;
  description: string;
  deviceId: string;
  deviceName: string;
}

interface Binding {
  deviceId: string;
  combinationId: string;
  configIds: string[];
}

/* ---- 基础数据（从各管理页面对应的 API 拉取） ---- */
const devices = ref<Device[]>([]);
const combinations = ref<Combination[]>([]);
const configs = ref<Config[]>([]);

/* ---- 绑定数据 ---- */
const bindings = ref<Binding[]>([]);

/* ---- 当前选中的机型 ---- */
const selectedDeviceId = ref("");

/* ---- 从绑定中查找 ---- */
function getBinding(
  deviceId: string,
  combinationId: string,
): Binding | undefined {
  return bindings.value.find(
    (b) => b.deviceId === deviceId && b.combinationId === combinationId,
  );
}

function isCombinationBound(combinationId: string): boolean {
  if (!selectedDeviceId.value) return false;
  return bindings.value.some(
    (b) =>
      b.deviceId === selectedDeviceId.value &&
      b.combinationId === combinationId,
  );
}

function toggleCombination(combinationId: string) {
  if (!selectedDeviceId.value) return;
  const existing = bindings.value.findIndex(
    (b) =>
      b.deviceId === selectedDeviceId.value &&
      b.combinationId === combinationId,
  );
  if (existing !== -1) {
    bindings.value.splice(existing, 1);
  } else {
    bindings.value.push({
      deviceId: selectedDeviceId.value,
      combinationId,
      configIds: [],
    });
  }
}

function isConfigBound(combinationId: string, configId: string): boolean {
  const binding = getBinding(selectedDeviceId.value, combinationId);
  return binding?.configIds.includes(configId) ?? false;
}

function toggleConfig(combinationId: string, configId: string) {
  if (!selectedDeviceId.value) return;

  /* 确保 combination 已绑定到当前机型 */
  if (!isCombinationBound(combinationId)) {
    bindings.value.push({
      deviceId: selectedDeviceId.value,
      combinationId,
      configIds: [],
    });
  }

  const binding = getBinding(selectedDeviceId.value, combinationId)!;
  const idx = binding.configIds.indexOf(configId);
  if (idx !== -1) {
    binding.configIds.splice(idx, 1);
  } else {
    binding.configIds.push(configId);
  }
}

/* ---- 当前机型下绑定的组合方式（含测试机型） ---- */
const boundCombinations = computed(() => {
  if (!selectedDeviceId.value) return [];
  return bindings.value
    .filter((b) => b.deviceId === selectedDeviceId.value)
    .map((b) => {
      const combo = combinations.value.find((c) => c.id === b.combinationId);
      const cfgs = b.configIds
        .map((id) => configs.value.find((c) => c.id === id))
        .filter(Boolean) as Config[];
      return { ...b, combination: combo, configList: cfgs };
    });
});

/* ---- 保存绑定到后端 ---- */
async function saveBindings() {
  const payload = bindings.value.filter(
    (b) => b.deviceId === selectedDeviceId.value,
  );
  await withLoading(async () => {
    const response = await fetch(HTTP_URL + "/saveBinding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: selectedDeviceId.value,
        bindings: payload,
      }),
    });
    const data = await response.json();
    console.log("Node-RED回应:", data);
    fetchBindings();
  }, "保存成功");
}

/* ---- 拉取数据 ---- */
async function fetchDevices() {
  try {
    const res = await fetch(HTTP_URL + "/getDevice");
    devices.value = await res.json();
  } catch {
    devices.value = [
      {
        id: "1",
        name: "ZD6 转辙机 #001",
        typeName: "ZD6",
        location: "站场 A 区",
      },
      {
        id: "2",
        name: "ZD6 转辙机 #002",
        typeName: "ZD6",
        location: "站场 B 区",
      },
      {
        id: "3",
        name: "S700K 转辙机 #001",
        typeName: "S700K",
        location: "站场 C 区",
      },
    ];
  }
}

async function fetchCombinations() {
  try {
    const res = await fetch(HTTP_URL + "/getCombination");
    combinations.value = await res.json();
  } catch {
    combinations.value = [
      {
        id: "1",
        name: "双动双机",
        description: "双机牵引组合方式",
        deviceType: "ZD6",
      },
      {
        id: "2",
        name: "单动单机",
        description: "单机牵引组合方式",
        deviceType: "ZD6",
      },
      {
        id: "3",
        name: "双动双机",
        description: "双机牵引组合方式",
        deviceType: "S700K",
      },
    ];
  }
}

async function fetchConfigs() {
  try {
    const res = await fetch(HTTP_URL + "/getConfig");
    configs.value = await res.json();
  } catch {
    configs.value = [
      {
        id: "1",
        name: "定位→反位 拉力曲线",
        description: "标准拉力曲线检测参数",
        deviceId: "1",
        deviceName: "ZD6 转辙机 #001",
      },
      {
        id: "2",
        name: "驱动回路 导通检测",
        description: "X1-C1, X2-C10 回路导通参数",
        deviceId: "1",
        deviceName: "ZD6 转辙机 #001",
      },
      {
        id: "3",
        name: "表示回路 导通检测",
        description: "X1, X2 回路导通参数",
        deviceId: "2",
        deviceName: "ZD6 转辙机 #002",
      },
    ];
  }
}

const BindData = ref([]);

async function fetchBindings() {
  try {
    const res = await fetch(HTTP_URL + "/getBingings");
    const data = await res.json();
    console.log(data);
    BindData.value = data;
  } catch {
    bindings.value = [
      {
        deviceId: "1",
        combinationId: "1",
        configIds: ["1", "2"],
      },
      {
        deviceId: "1",
        combinationId: "2",
        configIds: ["3"],
      },
    ];
  }
}

watch(selectedDeviceId, (newVal) => {
  if (newVal) {
    const deviceData = BindData.value.find((i: any) => i.deviceId === newVal);
    bindings.value = deviceData?.bindings || [];
  }
});

onMounted(async () => {
  await Promise.all([
    fetchDevices(),
    fetchCombinations(),
    fetchConfigs(),
    fetchBindings(),
  ]);
  if (devices.value.length > 0 && !selectedDeviceId.value) {
    const preferId = route.query.deviceId as string;
    if (preferId && devices.value.some((d) => d.id === preferId)) {
      selectedDeviceId.value = preferId;
    } else {
      selectedDeviceId.value = devices.value[0].id;
    }
  }
});
</script>

<template>
  <div class="manager-page">
    <div class="page-header">
      <h2 class="page-title">绑定配置</h2>
      <button class="save-btn" @click="saveBindings">保存绑定</button>
    </div>

    <!-- 选择机型 -->
    <div class="selector-bar">
      <label class="selector-label">选择机型：</label>
      <select v-model="selectedDeviceId" class="selector-input">
        <option v-for="d in devices" :key="d.id" :value="d.id">
          {{ d.name }}（{{ d.typeName }}）
        </option>
      </select>
    </div>

    <!-- 绑定列表 -->
    <div class="bind-section">
      <h3 class="section-title">组合方式绑定</h3>
      <p class="section-hint" v-if="!selectedDeviceId">请先选择机型</p>

      <div
        v-for="combo in combinations"
        :key="combo.id"
        class="bind-row"
        :class="{ bound: isCombinationBound(combo.id) }">
        <div class="bind-row-header">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="isCombinationBound(combo.id)"
              :disabled="!selectedDeviceId"
              @change="toggleCombination(combo.id)" />
            <span class="combo-name">{{ combo.name }}</span>
            <span class="combo-desc">{{ combo.description }}</span>
          </label>
        </div>

        <!-- 测试机型子列表（组合已绑定才显示） -->
        <div v-if="isCombinationBound(combo.id)" class="config-sublist">
          <span class="config-label">关联测试机型：</span>
          <div class="config-chips">
            <label
              v-for="cfg in configs"
              :key="cfg.id"
              class="chip-label"
              :class="{ checked: isConfigBound(combo.id, cfg.id) }">
              <input
                type="checkbox"
                :checked="isConfigBound(combo.id, cfg.id)"
                @change="toggleConfig(combo.id, cfg.id)" />
              {{ cfg.name }}
            </label>
            <span v-if="configs.length === 0" class="empty-hint"
              >暂无测试机型</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- 当前绑定摘要 -->
    <div class="summary-section" v-if="boundCombinations.length > 0">
      <h3 class="section-title">当前绑定预览</h3>
      <div class="summary-tree">
        <div class="tree-root">
          {{ devices.find((d) => d.id === selectedDeviceId)?.name }}
        </div>
        <div
          v-for="item in boundCombinations"
          :key="item.combinationId"
          class="tree-branch">
          <div class="tree-combo">├ {{ item.combination?.name }}</div>
          <div v-for="cfg in item.configList" :key="cfg.id" class="tree-config">
            └ {{ cfg.name }}
          </div>
          <div v-if="item.configList.length === 0" class="tree-config empty">
            └ （未关联测试机型）
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

.save-btn {
  background: #1a6b3c;
  color: #fff;
  border: none;
  font-size: 13px;
  padding: 7px 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.save-btn:hover {
  background: #21884b;
}

/* 机型选择栏 */
.selector-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
}

.selector-label {
  font-size: 13px;
  color: #8fb4d8;
  white-space: nowrap;
}

.selector-input {
  background: #051424;
  border: 1px solid #1a2d44;
  color: #e0e8f0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  min-width: 300px;
}

.selector-input:focus {
  border-color: #2d5280;
}

/* 绑定区域 */
.bind-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 15px;
  color: #8fb4d8;
  margin-bottom: 12px;
}

.section-hint {
  color: #5a7288;
  font-size: 13px;
}

.bind-row {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 8px;
  transition: border-color 0.2s;
}

.bind-row.bound {
  border-color: #2d5280;
}

.bind-row-header {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  accent-color: #5a92d0;
  width: 16px;
  height: 16px;
}

.combo-name {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
}

.combo-desc {
  font-size: 12px;
  color: #5a7288;
  margin-left: 8px;
}

/* 测试机型子列表 */
.config-sublist {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #1a2d44;
  padding-left: 24px;
}

.config-label {
  font-size: 12px;
  color: #5a7288;
  margin-bottom: 8px;
  display: block;
}

.config-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-label {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(90, 146, 208, 0.08);
  border: 1px solid #2a4a68;
  color: #8a9fb0;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.chip-label.checked {
  background: rgba(90, 146, 208, 0.2);
  border-color: #5a92d0;
  color: #b8d4f0;
}

.chip-label input[type="checkbox"] {
  display: none;
}

.chip-label:hover {
  border-color: #5a92d0;
}

.empty-hint {
  font-size: 12px;
  color: #5a7288;
}

/* 摘要树 */
.summary-section {
  padding: 16px;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
}

.summary-tree {
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
  font-size: 13px;
  color: #c0d0e0;
  line-height: 2;
}

.tree-root {
  color: #8fb4d8;
  font-weight: 600;
}

.tree-branch {
  padding-left: 20px;
}

.tree-combo {
  color: #e0e8f0;
}

.tree-config {
  padding-left: 24px;
  color: #5a7288;
}

.tree-config.empty {
  color: #4a6078;
  font-style: italic;
}
</style>
