<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  errorMsg: string;
}>();

const emit = defineEmits<{
  (e: "confirm", password: string): void;
  (e: "cancel"): void;
}>();

const password = ref("");

watch(
  () => props.visible,
  (v) => {
    if (v) password.value = "";
  },
);

function onSubmit() {
  if (!password.value.trim()) return;
  emit("confirm", password.value);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="auth-overlay" @click.self="emit('cancel')">
      <div class="auth-dialog">
        <h3 class="auth-title">权限验证</h3>
        <p class="auth-desc">操作设备资产需要输入密码</p>
        <form @submit.prevent="onSubmit">
          <input
            ref="inputRef"
            v-model="password"
            type="password"
            class="auth-input"
            placeholder="请输入密码"
            autofocus
          />
          <p v-if="errorMsg" class="auth-error">{{ errorMsg }}</p>
          <div class="auth-actions">
            <button type="button" class="auth-btn cancel" @click="emit('cancel')">取消</button>
            <button type="submit" class="auth-btn confirm" :disabled="!password.trim()">确认</button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.auth-dialog {
  background: #0d2339;
  border: 1px solid #2a5680;
  border-radius: 8px;
  padding: 28px 32px;
  width: 380px;
}

.auth-title {
  font-size: 16px;
  font-weight: 600;
  color: #e0e8f0;
  margin-bottom: 8px;
}

.auth-desc {
  font-size: 13px;
  color: #7a8fa0;
  margin-bottom: 20px;
}

.auth-input {
  width: 100%;
  padding: 10px 12px;
  background: #051424;
  border: 1px solid #1a2d44;
  border-radius: 4px;
  color: #e0e8f0;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.auth-input:focus {
  border-color: #4dabf7;
}

.auth-error {
  color: #e8473b;
  font-size: 12px;
  margin-top: 8px;
}

.auth-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.auth-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.auth-btn.cancel {
  background: #1a2d44;
  color: #8fb4d8;
}

.auth-btn.cancel:hover {
  background: #243e5a;
}

.auth-btn.confirm {
  background: #2a5680;
  color: #fff;
}

.auth-btn.confirm:hover {
  background: #3a6ea0;
}

.auth-btn.confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
