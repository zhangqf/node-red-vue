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
      HTTP_URL +
        "/getConfigsByBinding/" +
        route.params.deviceId +
        "/" +
        combo.id,
    );
    configs.value = await res.json();
  } catch {
    configs.value = [];
  } finally {
    configsLoading.value = false;
  }
}
const selectedConfig = ref<any>(null);

function onConfigClick(configId: string) {
  selectedConfig.value = configId;

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
      <div class="step-indicator">
        <span
          class="step"
          :class="[!selectedCombination && !selectedConfig ? 'active' : '']"
          >1. 组合方式</span
        >
        <span class="step-divider">→</span>
        <span
          class="step"
          :class="[selectedCombination && !selectedConfig ? 'active' : '']"
          >2. 测试机型</span
        >
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-box">
      <div class="state-spinner"></div>
      <p class="state-text">加载中...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="state-box">
      <div class="state-icon-box error">
        <svg viewBox="0 0 48 48" fill="none">
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="#f87171"
            stroke-width="2"
            opacity="0.4" />
          <line
            x1="24"
            y1="14"
            x2="24"
            y2="26"
            stroke="#f87171"
            stroke-width="2.5"
            stroke-linecap="round" />
          <circle cx="24" cy="32" r="1.5" fill="#f87171" />
        </svg>
      </div>
      <p class="state-text">{{ error }}</p>
      <button
        class="state-btn"
        @click="getCombinations(route.params.deviceId as string)">
        重试
      </button>
    </div>

    <!-- Empty -->
    <div v-else-if="combinations.length === 0" class="state-box">
      <div class="state-icon-box">
        <svg viewBox="0 0 48 48" fill="none">
          <rect
            x="8"
            y="10"
            width="32"
            height="28"
            rx="5"
            stroke="#1a3350"
            stroke-width="2" />
          <line
            x1="14"
            y1="20"
            x2="34"
            y2="20"
            stroke="#1a3350"
            stroke-width="2"
            opacity="0.5" />
          <line
            x1="14"
            y1="28"
            x2="28"
            y2="28"
            stroke="#1a3350"
            stroke-width="2"
            opacity="0.3" />
        </svg>
      </div>
      <p class="state-title">该设备尚未绑定任何组合方式</p>
      <p class="state-desc">请先在「绑定配置」中为当前设备关联组合方式</p>
      <button class="state-btn" @click="goToBinding">前往绑定配置</button>
    </div>

    <!-- Content -->
    <div v-else class="two-columns">
      <!-- Left: 组合方式 -->
      <div class="column left-col">
        <div class="column-header">
          <h3 class="column-title">组合方式</h3>
          <span class="column-count">{{ combinations.length }} 项</span>
        </div>
        <div class="card-list">
          <div
            v-for="combo in combinations"
            :key="combo.id"
            class="card-item combo-card"
            :class="{ active: selectedCombination?.id === combo.id }"
            @click="selectCombination(combo)">
            <div class="combo-icon">
              <svg
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <rect
                  x="4"
                  y="6"
                  width="28"
                  height="24"
                  rx="4"
                  stroke="#5a92d0"
                  stroke-width="1.5"
                  fill="none" />
                <line
                  x1="4"
                  y1="15"
                  x2="32"
                  y2="15"
                  stroke="#5a92d0"
                  stroke-width="1"
                  opacity="0.3" />
                <circle
                  cx="12"
                  cy="10.5"
                  r="1.5"
                  fill="#5a92d0"
                  opacity="0.5" />
                <circle
                  cx="18"
                  cy="10.5"
                  r="1.5"
                  fill="#5a92d0"
                  opacity="0.3" />
              </svg>
            </div>
            <div class="combo-body">
              <div class="combo-name">{{ combo.name }}</div>
              <div v-if="combo.deviceType" class="combo-tag">
                {{ combo.deviceType }}
              </div>
              <div v-if="combo.description" class="combo-desc">
                {{ combo.description }}
              </div>
            </div>
            <div
              class="combo-check"
              v-if="selectedCombination?.id === combo.id">
              <svg viewBox="0 0 20 20" fill="none">
                <circle
                  cx="10"
                  cy="10"
                  r="9"
                  fill="#34d399"
                  opacity="0.15"
                  stroke="#34d399"
                  stroke-width="1.5" />
                <path
                  d="M6 10L9 13L14 7"
                  stroke="#34d399"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: 测试机型 -->
      <div class="column right-col">
        <div class="column-header">
          <h3 class="column-title">测试机型</h3>
          <span v-if="configs.length && !configsLoading" class="column-count"
            >{{ configs.length }} 项</span
          >
        </div>

        <div v-if="!selectedCombination" class="placeholder">
          <div class="placeholder-icon">
            <svg viewBox="0 0 48 48" fill="none">
              <path
                d="M10 24L38 24"
                stroke="#1a3350"
                stroke-width="2"
                stroke-linecap="round" />
              <path
                d="M20 14L10 24L20 34"
                stroke="#1a3350"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </div>
          <p>请先选择左侧组合方式</p>
        </div>

        <div v-else-if="configsLoading" class="placeholder">
          <div class="state-spinner"></div>
          <p>加载测试机型...</p>
        </div>

        <div v-else-if="configs.length === 0" class="placeholder">
          <div class="placeholder-icon">
            <svg viewBox="0 0 48 48" fill="none">
              <rect
                x="10"
                y="12"
                width="28"
                height="24"
                rx="5"
                stroke="#1a3350"
                stroke-width="2" />
              <line
                x1="16"
                y1="22"
                x2="32"
                y2="22"
                stroke="#1a3350"
                stroke-width="2"
                opacity="0.4" />
              <line
                x1="16"
                y1="28"
                x2="26"
                y2="28"
                stroke="#1a3350"
                stroke-width="2"
                opacity="0.25" />
            </svg>
          </div>
          <p>该组合方式下暂无测试机型</p>
          <p class="placeholder-hint">请先在「绑定配置」中关联测试机型</p>
        </div>

        <div v-else class="card-list">
          <div
            v-for="cfg in configs"
            :key="cfg.id"
            class="card-item config-card"
            @click="onConfigClick(cfg.id)">
            <div class="config-icon">
              <svg
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <circle
                  cx="18"
                  cy="18"
                  r="13"
                  stroke="#5a92d0"
                  stroke-width="1.5"
                  fill="none" />
                <circle
                  cx="18"
                  cy="18"
                  r="7"
                  stroke="#5a92d0"
                  stroke-width="1"
                  fill="none"
                  opacity="0.5" />
                <circle cx="18" cy="18" r="2.5" fill="#34d399" />
              </svg>
            </div>
            <div class="config-body">
              <div class="config-name">{{ cfg.name }}</div>
              <div v-if="cfg.description" class="config-desc">
                {{ cfg.description }}
              </div>
            </div>
            <div class="config-arrow">
              <svg viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 4L10 8L6 12"
                  stroke="#5a7288"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.configure-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px 28px;
}

/* ---- Header ---- */
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
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(90, 146, 208, 0.1);
  border-color: #2d5280;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e8f0;
  flex: 1;
}

.step-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #5a7288;
}

.step.active {
  color: #8fb4d8;
  font-weight: 600;
}

.step-divider {
  color: #2a3a50;
}

/* ---- Two-column layout ---- */
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
  border-radius: 12px;
  overflow: hidden;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid #1a2d44;
  flex-shrink: 0;
}

.column-title {
  font-size: 14px;
  font-weight: 600;
  color: #8fb4d8;
}

.column-count {
  font-size: 11px;
  color: #5a7288;
  background: #051424;
  border-radius: 10px;
  padding: 2px 10px;
}

/* ---- Card list ---- */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  scrollbar-width: thin;
  scrollbar-color: #1a2d44 transparent;
}

.card-list::-webkit-scrollbar {
  width: 4px;
}

.card-list::-webkit-scrollbar-track {
  background: transparent;
}

.card-list::-webkit-scrollbar-thumb {
  background: #1a2d44;
  border-radius: 2px;
}

/* ---- Combo card ---- */
.combo-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #051424;
  border: 1px solid #152238;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.combo-card:hover {
  border-color: #2d5280;
  background: #0a1d30;
}

.combo-card.active {
  border-color: #5a92d0;
  background: rgba(90, 146, 208, 0.06);
}

.combo-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.combo-body {
  flex: 1;
  min-width: 0;
}

.combo-name {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
}

.combo-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  color: #5a92d0;
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid rgba(90, 146, 208, 0.2);
  border-radius: 4px;
  padding: 1px 8px;
  margin-top: 6px;
  letter-spacing: 0.5px;
}

.combo-desc {
  font-size: 11px;
  color: #5a7288;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.combo-check {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* ---- Config card ---- */
.config-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #051424;
  border: 1px solid #152238;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.config-card:hover {
  border-color: #2d5280;
  background: #0a1d30;
  transform: translateX(2px);
}

.config-card:hover .config-arrow {
  opacity: 1;
  transform: translateX(2px);
}

.config-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.config-body {
  flex: 1;
  min-width: 0;
}

.config-name {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
}

.config-desc {
  font-size: 11px;
  color: #5a7288;
  margin-top: 4px;
}

.config-arrow {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.4;
  transition: all 0.3s;
  display: flex;
  align-items: center;
}

/* ---- Placeholder ---- */
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
  width: 48px;
  height: 48px;
  opacity: 0.4;
}

.placeholder-hint {
  font-size: 11px;
  color: #3a5068;
}

/* ---- State boxes ---- */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 64px 20px;
  max-width: 440px;
  margin: 40px auto;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 14px;
}

.state-icon-box {
  width: 48px;
  height: 48px;
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
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.state-btn:hover {
  background: #254670;
  color: #b8d4f0;
  border-color: #3a6088;
}

/* ---- Spinner ---- */
.state-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(90, 146, 208, 0.15);
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
