<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  saveRuntimeConfig,
  DEFAULT_CONFIG,
  STORAGE_KEYS,
  syncConfigFromStorage,
} from "@/config/config";
import { useAuth } from "@/composables/useAuth";

const { changePassword } = useAuth();

const oldPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const message = ref("");
const messageUrl = ref("");
const isError = ref(false);
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

async function onSubmit() {
  message.value = "";
  isError.value = false;

  if (!oldPassword.value) {
    message.value = "请输入原密码";
    isError.value = true;
    return;
  }
  if (!newPassword.value) {
    message.value = "请输入新密码";
    isError.value = true;
    return;
  }
  if (newPassword.value.length < 6) {
    message.value = "新密码至少 6 位";
    isError.value = true;
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    message.value = "两次输入的新密码不一致";
    isError.value = true;
    return;
  }

  const result = await changePassword(oldPassword.value, newPassword.value);
  if (result.success) {
    message.value = "密码修改成功";
    isError.value = false;
    oldPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
  } else {
    message.value = result.error || "修改失败";
    isError.value = true;
  }
}

onMounted(() => {
  loadConfig();
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

      <div class="section">
        <h3 class="section-title">修改资产操作密码</h3>
        <form class="password-form" @submit.prevent="onSubmit">
          <div class="form-item">
            <label class="form-label">原密码</label>
            <input
              v-model="oldPassword"
              type="password"
              class="form-input"
              placeholder="输入原密码" />
          </div>
          <div class="form-item">
            <label class="form-label">新密码</label>
            <input
              v-model="newPassword"
              type="password"
              class="form-input"
              placeholder="至少 6 位" />
          </div>
          <div class="form-item">
            <label class="form-label">确认新密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="form-input"
              placeholder="再次输入新密码" />
          </div>
          <p v-if="message" :class="['form-msg', { error: isError }]">
            {{ message }}
          </p>
          <button type="submit" class="form-btn">保存修改</button>
        </form>
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

.password-form,
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
