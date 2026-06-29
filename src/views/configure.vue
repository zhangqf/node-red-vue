<script setup lang="ts">
import { HTTP_URL } from "@/config/config";
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const combinations = ref<any[]>([]);
const configs = ref<any[]>([]);
const loading = ref(true);
const configsLoading = ref(false);
const error = ref("");
const selectedCombination = ref<any>(null);

async function getCombinations(id: string) {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetch(HTTP_URL + "/getDeviceCombination/" + id);
    combinations.value = await res.json();
  } catch {
    error.value = "数据加载失败";
  } finally {
    loading.value = false;
  }
}

async function selectCombination(combo: any) {
  selectedCombination.value = combo;
  configsLoading.value = true;
  configs.value = [];
  router.replace({ query: { comboId: combo.id } });
  try {
    const res = await fetch(
      HTTP_URL + "/getConfigsByBinding/" + route.params.deviceId + "/" + combo.id
    );
    configs.value = await res.json();
  } catch {
    configs.value = [];
  } finally {
    configsLoading.value = false;
  }
}

function onConfigClick(configId: string) {
  router.push({
    name: "work",
    params: {
      deviceId: route.params.deviceId,
      combinationId: selectedCombination.value.id,
      configId,
    },
  });
}

function goToBinding() {
  router.push({
    name: "binding-manager",
    query: { deviceId: route.params.deviceId as string },
  });
}

onMounted(async () => {
  await getCombinations(route.params.deviceId as string);
  const comboId = route.query.comboId as string;
  if (comboId) {
    const matched = combinations.value.find((c) => c.id == comboId);
    if (matched) selectCombination(matched);
  }
});
</script>

<template>
  <div class="configure-page">
    <div class="page-header">
      <button class="back-btn" @click="router.back()">← 返回</button>
      <h2 class="page-title">选择组合方式</h2>
    </div>

    <!-- Loading / Error / Empty -->
    <div v-if="loading" class="state-box">
      <div class="state-spinner"></div>
      <p class="state-text">加载中...</p>
    </div>

    <div v-else-if="error" class="state-box">
      <span class="state-icon">⚠</span>
      <p class="state-text">{{ error }}</p>
      <button class="state-btn" @click="getCombinations(route.params.deviceId as string)">重试</button>
    </div>

    <div v-else-if="combinations.length === 0" class="state-box">
      <span class="state-icon">📋</span>
      <p class="state-title">该设备尚未绑定任何组合方式</p>
      <p class="state-desc">请先在「绑定配置」中为当前设备关联组合方式</p>
      <button class="state-btn" @click="goToBinding">前往绑定配置</button>
    </div>

    <!-- 双栏 -->
    <div v-else class="two-columns">
      <!-- 左栏：组合方式 -->
      <div class="column left">
        <h3 class="column-title">组合方式</h3>
        <div class="card-list">
          <div
            v-for="combo in combinations"
            :key="combo.id"
            class="card-item"
            :class="{ active: selectedCombination?.id === combo.id }"
            @click="selectCombination(combo)"
          >
            <div class="card-name">{{ combo.name }}</div>
            <div v-if="combo.deviceType" class="card-tag">{{ combo.deviceType }}</div>
            <div v-if="combo.description" class="card-desc">{{ combo.description }}</div>
          </div>
        </div>
      </div>

      <!-- 右栏：测试机型 -->
      <div class="column right">
        <h3 class="column-title">测试机型</h3>

        <div v-if="!selectedCombination" class="placeholder">
          <span class="placeholder-icon">←</span>
          <p>请先选择左侧组合方式</p>
        </div>

        <div v-else-if="configsLoading" class="placeholder">
          <div class="state-spinner"></div>
        </div>

        <div v-else-if="configs.length === 0" class="placeholder">
          <span class="placeholder-icon">📦</span>
          <p>该组合方式下暂无测试机型</p>
          <p class="placeholder-hint">请先在「绑定配置」中关联测试机型</p>
        </div>

        <div v-else class="card-list">
          <div
            v-for="cfg in configs"
            :key="cfg.id"
            class="card-item"
            @click="onConfigClick(cfg.id)"
          >
            <div class="card-name">{{ cfg.name }}</div>
            <div v-if="cfg.description" class="card-desc">{{ cfg.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.configure-page {
  padding: 24px;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.back-btn {
  background: transparent;
  border: 1px solid #1a2d44;
  color: #8fb4d8;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(90, 146, 208, 0.1);
}

.page-title {
  font-size: 18px;
  color: #8fb4d8;
}

/* ---- 双栏 ---- */
.two-columns {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
  padding: 16px;
  overflow: hidden;
}

.column-title {
  font-size: 14px;
  color: #8fb4d8;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
}

.card-item {
  background: #051424;
  border: 1px solid #1a2d44;
  border-radius: 6px;
  padding: 12px 16px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.card-item:hover {
  border-color: #2d5280;
  background: #0a1d30;
}

.card-item.active {
  border-color: #5a92d0;
  background: rgba(90, 146, 208, 0.08);
}

.card-name {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
}

.card-tag {
  display: inline-block;
  font-size: 11px;
  color: #5b8ecb;
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid #2a4a68;
  border-radius: 3px;
  padding: 1px 8px;
  margin-top: 4px;
}

.card-desc {
  font-size: 12px;
  color: #5a7288;
  margin-top: 4px;
}

/* ---- 右栏占位 ---- */
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex: 1;
  color: #5a7288;
  font-size: 13px;
}

.placeholder-icon {
  font-size: 32px;
  opacity: 0.5;
}

.placeholder-hint {
  font-size: 12px;
  color: #4a6078;
}

/* ---- 状态占位（loading / empty / error 共用） ---- */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  max-width: 500px;
  margin: 40px auto;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 12px;
}

.state-icon {
  font-size: 40px;
}

.state-title {
  font-size: 15px;
  font-weight: 600;
  color: #e0e8f0;
}

.state-desc {
  font-size: 12px;
  color: #5a7288;
  text-align: center;
}

.state-text {
  font-size: 13px;
  color: #5a7288;
}

.state-btn {
  background: #1a3350;
  border: 1px solid #2a4a68;
  color: #8fb4d8;
  font-size: 13px;
  padding: 7px 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.state-btn:hover {
  background: #254670;
  color: #b8d4f0;
}

.state-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(90, 146, 208, 0.2);
  border-top-color: #5a92d0;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
