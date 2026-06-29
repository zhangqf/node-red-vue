<script setup lang="ts">
import { useToast } from "@/composables/useToast";

const { toasts, loading } = useToast();
</script>

<template>
  <Teleport to="body">
    <!-- Loading -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span class="loading-text">请稍候...</span>
    </div>

    <!-- Toasts -->
    <div class="toast-container">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast-item"
        :class="t.type"
      >
        <span class="toast-icon">{{ t.type === "success" ? "✓" : "✕" }}</span>
        {{ t.message }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(5, 20, 36, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 9999;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(90, 146, 208, 0.2);
  border-top-color: #5a92d0;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: #8fb4d8;
  font-size: 13px;
}

.toast-container {
  position: fixed;
  top: 60px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9998;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 13px;
  color: #e0e8f0;
  animation: slideIn 0.25s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  max-width: 360px;
}

.toast-item.success {
  background: #0f3326;
  border: 1px solid #1a6b3c;
}

.toast-item.error {
  background: #331111;
  border: 1px solid #7a2828;
}

.toast-icon {
  font-weight: 700;
  font-size: 14px;
}

.toast-item.success .toast-icon {
  color: #34d399;
}

.toast-item.error .toast-icon {
  color: #f87171;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
</style>
