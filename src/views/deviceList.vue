<script setup lang="ts">
import { HTTP_URL } from "@/config/config";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";

const { withLoading } = useToast();

const router = useRouter();

interface Device {
  id: string;
  name: string;
  location?: string;
}

const devices = ref<Device[]>([
  { id: "device-001", name: "ZD6 转辙机 #001", location: "站场 A 区" },
  { id: "device-002", name: "ZD6 转辙机 #002", location: "站场 B 区" },
  { id: "device-003", name: "ZD6 转辙机 #003", location: "站场 C 区" },
  { id: "device-004", name: "S700K 转辙机 #001", location: "站场 A 区" },
]);

function deviceModel(name: string): string {
  if (name.includes("ZD6")) return "ZD6";
  if (name.includes("ZDJ9")) return "ZDJ9";
  if (name.includes("ZYJ7")) return "ZYJ7";
  if (name.includes("S700K")) return "S700K";
  return "";
}

function onDeviceClick(deviceId: string) {
  router.push({ name: "configure", params: { deviceId } });
}

async function getList() {
  const response = await fetch(HTTP_URL + "/deviceList", {
    method: "get",
    headers: { "Content-Type": "application/json" },
  });
  devices.value = await response.json();
}

onMounted(async () => {
  await withLoading(async () => {
    await getList();
  }, "数据加载成功");
});
</script>

<template>
  <div class="device-list-page">
    <div class="page-header">
      <button class="back-btn" @click="router.push({ name: 'home' })">
        ← 返回首页
      </button>
      <h2 class="page-title">常规模式</h2>
      <span class="device-count">{{ devices.length }} 台设备</span>
    </div>

    <div class="device-grid">
      <div
        v-for="device in devices"
        :key="device.id"
        class="device-card"
        @click="onDeviceClick(device.id)">
        <div class="card-top">
          <div class="card-icon">
            <svg
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <rect
                x="6"
                y="8"
                width="28"
                height="24"
                rx="4"
                stroke="#5a92d0"
                stroke-width="1.5"
                fill="none" />
              <circle
                cx="20"
                cy="20"
                r="5"
                stroke="#5a92d0"
                stroke-width="1.2"
                fill="none" />
              <circle cx="20" cy="20" r="2" fill="#34d399" />
              <path
                d="M14 14L26 26"
                stroke="#5a92d0"
                stroke-width="1"
                opacity="0.3" />
              <path
                d="M26 14L14 26"
                stroke="#5a92d0"
                stroke-width="1"
                opacity="0.3" />
            </svg>
          </div>
          <span class="card-badge">{{ deviceModel(device.name) }}</span>
          <span class="card-status"></span>
        </div>

        <div class="card-body">
          <div class="device-name">{{ device.name }}</div>
          <div class="device-location">
            <svg viewBox="0 0 12 12" fill="none" class="loc-icon">
              <circle cx="6" cy="5" r="2" stroke="#5a7288" stroke-width="1" />
              <path
                d="M3 7L6 11L9 7"
                stroke="#5a7288"
                stroke-width="1"
                stroke-linecap="round" />
            </svg>
            {{ device.location }}
          </div>
        </div>

        <div class="card-footer">
          <span class="footer-label">点击进如选择组合方式</span>
          <span class="footer-arrow">→</span>
        </div>
      </div>
    </div>

    <div v-if="devices.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 64 64" fill="none">
          <rect
            x="12"
            y="14"
            width="40"
            height="36"
            rx="6"
            stroke="#1a3350"
            stroke-width="2" />
          <line
            x1="20"
            y1="26"
            x2="44"
            y2="26"
            stroke="#1a3350"
            stroke-width="2"
            opacity="0.5" />
          <line
            x1="20"
            y1="34"
            x2="38"
            y2="34"
            stroke="#1a3350"
            stroke-width="2"
            opacity="0.3" />
          <line
            x1="20"
            y1="42"
            x2="34"
            y2="42"
            stroke="#1a3350"
            stroke-width="2"
            opacity="0.2" />
        </svg>
      </div>
      <p class="empty-text">暂无设备数据</p>
      <p class="empty-hint">请先在「设备资产」中添加转辙机设备</p>
    </div>
  </div>
</template>

<style scoped>
.device-list-page {
  padding: 20px 28px;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #1a2d44 transparent;
}

.device-list-page::-webkit-scrollbar {
  width: 4px;
}

.device-list-page::-webkit-scrollbar-track {
  background: transparent;
}

.device-list-page::-webkit-scrollbar-thumb {
  background: #1a2d44;
  border-radius: 2px;
}

/* ---- Header ---- */
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
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

.device-count {
  font-size: 12px;
  color: #5a7288;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 20px;
  padding: 5px 14px;
}

/* ---- Grid ---- */
.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* ---- Card ---- */
.device-card {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 12px;
  padding: 20px 22px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  overflow: hidden;
}

.device-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 20% 0%,
    rgba(90, 146, 208, 0.05) 0%,
    transparent 60%
  );
  opacity: 0;
  transition: opacity 0.3s;
}

.device-card:hover {
  border-color: #2d5280;
  background: #0f2240;
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}

.device-card:hover::after {
  opacity: 1;
}

.device-card:hover .footer-arrow {
  opacity: 1;
  transform: translateX(4px);
}

.device-card:hover .footer-label {
  color: #8fb4d8;
}

/* Card top row */
.card-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.card-badge {
  font-size: 10px;
  font-weight: 700;
  color: #5a92d0;
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid rgba(90, 146, 208, 0.2);
  border-radius: 4px;
  padding: 2px 8px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.card-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
  margin-left: auto;
}

/* Card body */
.card-body {
  flex: 1;
}

.device-name {
  font-size: 15px;
  font-weight: 600;
  color: #e0e8f0;
  margin-bottom: 8px;
  line-height: 1.3;
}

.device-location {
  font-size: 12px;
  color: #5a7288;
  display: flex;
  align-items: center;
  gap: 4px;
}

.loc-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

/* Card footer */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(26, 45, 68, 0.4);
}

.footer-label {
  font-size: 12px;
  color: #5a7288;
  transition: color 0.3s;
}

.footer-arrow {
  font-size: 14px;
  color: #5a92d0;
  opacity: 0.5;
  transition: all 0.3s;
}

/* ---- Empty state ---- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  opacity: 0.3;
}

.empty-text {
  font-size: 15px;
  color: #5a7288;
}

.empty-hint {
  font-size: 12px;
  color: #3a5068;
}
</style>
