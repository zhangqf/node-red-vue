<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  saveRuntimeConfig,
  DEFAULT_CONFIG,
  STORAGE_KEYS,
  syncConfigFromStorage,
} from "@/config/config";
import { useAuth } from "@/composables/useAuth";

const {
  sessionAuthed,
  authExpiresAt,
  unlockDeviceAssets,
  clearAuth,
} = useAuth();

const assetPassword = ref("");
const unlockMessage = ref("");
const isUnlockError = ref(false);
const now = ref(Date.now());
let unlockTimer: number | undefined;
const remainingText = computed(() => {
  if (!authExpiresAt.value) return "00:00";
  const seconds = Math.max(
    0,
    Math.ceil((authExpiresAt.value - now.value) / 1000),
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
});

async function onUnlock() {
  unlockMessage.value = "";
  isUnlockError.value = false;

  if (!assetPassword.value) {
    unlockMessage.value = "请输入设备资产密码";
    isUnlockError.value = true;
    return;
  }

  const ok = await unlockDeviceAssets(assetPassword.value);
  if (ok) {
    assetPassword.value = "";
    unlockMessage.value = "设备资产已解锁，10 分钟后自动隐藏";
    isUnlockError.value = false;
  } else {
    unlockMessage.value = "设备资产密码错误，请重试";
    isUnlockError.value = true;
  }
}

function onHideAssets() {
  clearAuth();
  unlockMessage.value = "设备资产已隐藏";
  isUnlockError.value = false;
}

const messageUrl = ref("");
const isErrorUrl = ref(false);

const httpUrl = ref(DEFAULT_CONFIG.httpUrl);
const websocketUrl = ref(DEFAULT_CONFIG.websocketUrl);
const mqttUrl = ref(DEFAULT_CONFIG.mqttUrl);

const hasCustomConfig = computed(() => {
  return (
    httpUrl.value !== DEFAULT_CONFIG.httpUrl ||
    websocketUrl.value !== DEFAULT_CONFIG.websocketUrl ||
    mqttUrl.value !== DEFAULT_CONFIG.mqttUrl
  );
});

const loadConfig = () => {
  syncConfigFromStorage();
  httpUrl.value =
    localStorage.getItem(STORAGE_KEYS.httpUrl) || DEFAULT_CONFIG.httpUrl;
  websocketUrl.value =
    localStorage.getItem(STORAGE_KEYS.websocketUrl) ||
    DEFAULT_CONFIG.websocketUrl;
  mqttUrl.value =
    localStorage.getItem(STORAGE_KEYS.mqttUrl) || DEFAULT_CONFIG.mqttUrl;
};

const onSaveNetworkConfig = () => {
  messageUrl.value = "";
  isErrorUrl.value = false;

  saveRuntimeConfig({
    httpUrl: httpUrl.value,
    websocketUrl: websocketUrl.value,
    // mqttUrl: mqttUrl.value,
  });

  messageUrl.value = "服务器地址已保存，已立即生效";
};

onMounted(() => {
  loadConfig();
  unlockTimer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (unlockTimer !== undefined) {
    window.clearInterval(unlockTimer);
  }
});
</script>

<template>
  <div class="settings-page">
    <h2 class="page-title">系统设置</h2>
    <div style="display: flex; width: 100%; justify-content: space-around">
      <div class="section">
        <h3 class="section-title">服务器地址</h3>
        <div class="network-form">
          <div class="form-item">
            <label class="form-label">HTTP 地址</label>
            <input
              v-model="httpUrl"
              type="text"
              class="form-input"
              placeholder="例如: http://192.168.1.10:1880" />
          </div>
          <div class="form-item">
            <label class="form-label">WebSocket 地址</label>
            <input
              v-model="websocketUrl"
              type="text"
              class="form-input"
              placeholder="例如: ws://192.168.1.10:1880" />
          </div>
          <!-- <div class="form-item">
          <label class="form-label">MQTT 地址</label>
          <input
            v-model="mqttUrl"
            type="text"
            class="form-input"
            placeholder="例如: ws://192.168.1.10:8083" />
        </div> -->
          <p v-if="messageUrl" :class="['form-msg', { error: isErrorUrl }]">
            {{ messageUrl }}
          </p>
          <div class="config-actions">
            <button type="button" class="form-btn" @click="onSaveNetworkConfig">
              保存地址
            </button>
            <button
              v-if="hasCustomConfig"
              type="button"
              class="reset-btn"
              @click="
                () => {
                  httpUrl = DEFAULT_CONFIG.httpUrl;
                  websocketUrl = DEFAULT_CONFIG.websocketUrl;
                  mqttUrl = DEFAULT_CONFIG.mqttUrl;
                  onSaveNetworkConfig();
                }
              ">
              恢复默认
            </button>
          </div>
        </div>
      </div>

      <div class="section asset-access-section">
        <h3 class="section-title">管理设备资产显示</h3>
        <p class="section-desc">
          输入设备资产密码即可显示“设备资产”菜单。默认显示 10 分钟，
          超过时间后自动隐藏，需再次输入密码才能显示。
        </p>

        <div v-if="!sessionAuthed" class="asset-access-card">
          <div class="form-item password-row">
            <label class="form-label" for="asset-password">设备资产密码</label>
            <input
              id="asset-password"
              v-model="assetPassword"
              type="password"
              class="form-input"
              placeholder="请输入设备资产密码"
              autocomplete="off"
              @keyup.enter="onUnlock" />
          </div>
          <p v-if="unlockMessage" :class="['form-msg', { error: isUnlockError }]">
            {{ unlockMessage }}
          </p>
          <div class="config-actions">
            <button type="button" class="form-btn" @click="onUnlock">
              验证并显示设备资产
            </button>
          </div>
        </div>

        <div v-else class="asset-access-card asset-unlocked">
          <div class="status-line">
            <span class="status-dot"></span>
            设备资产已显示
          </div>
          <p class="remaining-time">
            剩余 {{ remainingText }} 后自动隐藏
          </p>
          <p v-if="unlockMessage" class="form-msg">
            {{ unlockMessage }}
          </p>
          <div class="config-actions">
            <button type="button" class="reset-btn hide-btn" @click="onHideAssets">
              立即隐藏设备资产
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 24px 32px;
  /* max-width: 620px; */
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e8f0;
  margin-bottom: 24px;
}

.section {
  background: #0d2339;
  border: 1px solid #1a2d44;
  border-radius: 6px;
  padding: 20px 24px;
  flex: 1;
  margin: 0 10px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #8fb4d8;
  margin-bottom: 16px;
}

.asset-access-section {
  display: flex;
  flex-direction: column;
}

.section-desc {
  color: #7a8fa0;
  font-size: 13px;
  line-height: 1.7;
  margin: -6px 0 16px;
}

.asset-access-card {
  background: rgba(5, 20, 36, 0.6);
  border: 1px solid #1a2d44;
  border-radius: 6px;
  padding: 16px;
}

.password-row {
  max-width: 360px;
}

.asset-unlocked {
  border-color: rgba(52, 211, 153, 0.35);
  background: rgba(19, 74, 54, 0.28);
}

.status-line {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8ff0c0;
  font-size: 14px;
  font-weight: 600;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.16);
}

.remaining-time {
  margin: 10px 0 14px;
  color: #e8473b;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.hide-btn {
  background: rgba(217, 48, 37, 0.65);
}



.network-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  color: #7a8fa0;
}

.form-input {
  padding: 8px 12px;
  background: #051424;
  border: 1px solid #1a2d44;
  border-radius: 4px;
  color: #e0e8f0;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #4dabf7;
}

.form-msg {
  font-size: 13px;
  color: #4dab7b;
}

.form-msg.error {
  color: #e8473b;
}

.config-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.form-btn,
.reset-btn {
  align-self: flex-start;
  padding: 8px 24px;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.form-btn {
  background: #2a5680;
}

.form-btn:hover {
  background: #3a6ea0;
}

.reset-btn {
  background: #4b4b4b;
}

.reset-btn:hover {
  background: #5f5f5f;
}
</style>
