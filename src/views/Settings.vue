<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "@/composables/useAuth";

const { changePassword } = useAuth();

const oldPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const message = ref("");
const isError = ref(false);

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
</script>

<template>
  <div class="settings-page">
    <h2 class="page-title">系统设置</h2>

    <div class="section">
      <h3 class="section-title">修改资产操作密码</h3>
      <form class="password-form" @submit.prevent="onSubmit">
        <div class="form-item">
          <label class="form-label">原密码</label>
          <input v-model="oldPassword" type="password" class="form-input" placeholder="输入原密码" />
        </div>
        <div class="form-item">
          <label class="form-label">新密码</label>
          <input v-model="newPassword" type="password" class="form-input" placeholder="至少 6 位" />
        </div>
        <div class="form-item">
          <label class="form-label">确认新密码</label>
          <input v-model="confirmPassword" type="password" class="form-input" placeholder="再次输入新密码" />
        </div>
        <p v-if="message" :class="['form-msg', { error: isError }]">{{ message }}</p>
        <button type="submit" class="form-btn">保存修改</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 24px 32px;
  max-width: 520px;
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
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #8fb4d8;
  margin-bottom: 16px;
}

.password-form {
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

.form-btn {
  align-self: flex-start;
  padding: 8px 24px;
  background: #2a5680;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 4px;
}

.form-btn:hover {
  background: #3a6ea0;
}
</style>
