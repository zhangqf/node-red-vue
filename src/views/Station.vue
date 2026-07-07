<script setup lang="ts">
import { HTTP_URL } from "@/config/config";
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";

const { withLoading } = useToast();
const router = useRouter();

interface Device {
  id: string;
  name: string;
  location?: string;
}

const devices = ref<Device[]>([]);

function extractZone(location?: string): string {
  if (!location) return "";
  const match = location.match(/[A-C]区?/);
  return match ? match[0].replace("区", "") + " 区" : "";
}

function deviceModel(name: string): string {
  if (name.includes("ZD6")) return "ZD6";
  if (name.includes("ZDJ9")) return "ZDJ9";
  if (name.includes("ZYJ7")) return "ZYJ7";
  if (name.includes("S700K")) return "S700K";
  return "";
}

const groupedDevices = computed(() => {
  const groups: Record<string, Device[]> = {};
  for (const d of devices.value) {
    const zone = extractZone(d.location) || "未分区";
    if (!groups[zone]) groups[zone] = [];
    groups[zone].push(d);
  }
  return Object.entries(groups);
});

function onDeviceClick(device: Device) {
  router.push({ name: "configure", params: { deviceId: device.id } });
}

async function fetchDevices() {
  try {
    const response = await fetch(HTTP_URL + "/deviceList", {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    devices.value = await response.json();
  } catch {
    devices.value = [
      { id: "device-001", name: "ZD6 转辙机 #001", location: "站场 A 区" },
      { id: "device-002", name: "ZD6 转辙机 #002", location: "站场 B 区" },
      { id: "device-003", name: "ZD6 转辙机 #003", location: "站场 C 区" },
      { id: "device-004", name: "S700K 转辙机 #001", location: "站场 A 区" },
    ];
  }
}

onMounted(async () => {
  await withLoading(async () => {
    await fetchDevices();
  }, "站场数据加载成功");
});
</script>

<template>
  <div class="station-page">
    <div class="page-header">
      <button class="back-btn" @click="router.push({ name: 'home' })">← 返回首页</button>
      <h2 class="page-title">站场模式</h2>
      <div class="header-info">
        <span class="info-badge">
          <span class="badge-dot online"></span>
          {{ devices.length }} 台设备
        </span>
      </div>
    </div>

    <div class="dashboard">
      <div
        v-for="[zone, zoneDevices] in groupedDevices"
        :key="zone"
        class="zone-section">
        <div class="zone-header">
          <span class="zone-title">{{ zone }}</span>
          <span class="zone-count">{{ zoneDevices.length }} 台</span>
        </div>
        <div class="device-grid">
          <div
            v-for="device in zoneDevices"
            :key="device.id"
            class="device-card"
            @click="onDeviceClick(device)">
            <div class="card-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="10" width="32" height="28" rx="4" stroke="#5a92d0" stroke-width="1.5" fill="none"/>
                <circle cx="24" cy="24" r="6" stroke="#5a92d0" stroke-width="1.5" fill="none"/>
                <circle cx="24" cy="24" r="2.5" fill="#34d399"/>
                <line x1="24" y1="4" x2="24" y2="10" stroke="#5a92d0" stroke-width="1.5"/>
                <line x1="24" y1="38" x2="24" y2="44" stroke="#5a92d0" stroke-width="1.5"/>
                <line x1="8" y1="24" x2="14" y2="24" stroke="#5a92d0" stroke-width="1.5"/>
                <line x1="34" y1="24" x2="40" y2="24" stroke="#5a92d0" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="card-body">
              <div class="device-model">{{ deviceModel(device.name) }}</div>
              <div class="device-name">{{ device.name }}</div>
              <div class="device-location">{{ device.location }}</div>
            </div>
            <div class="card-status">
              <span class="status-dot online"></span>
              <span class="status-text">在线</span>
            </div>
            <div class="card-arrow">→</div>
          </div>
        </div>
      </div>

      <div v-if="devices.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="20" width="40" height="28" rx="4" stroke="#1a3350" stroke-width="2"/>
            <circle cx="32" cy="28" r="12" stroke="#1a3350" stroke-width="2"/>
            <line x1="32" y1="16" x2="32" y2="20" stroke="#1a3350" stroke-width="2"/>
          </svg>
        </div>
        <p class="empty-text">暂无设备数据</p>
        <p class="empty-hint">请先在设备资产中添加转辙机设备</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.station-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 24px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
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

.header-info {
  display: flex;
  gap: 12px;
}

.info-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 12px;
  color: #8fb4d8;
}

.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.badge-dot.online {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
}

.dashboard {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #1a2d44 transparent;
}

.dashboard::-webkit-scrollbar {
  width: 4px;
}

.dashboard::-webkit-scrollbar-track {
  background: transparent;
}

.dashboard::-webkit-scrollbar-thumb {
  background: #1a2d44;
  border-radius: 2px;
}

.zone-section {
  margin-bottom: 20px;
}

.zone-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #0a1628;
  border: 1px solid #152238;
  border-radius: 6px;
  margin-bottom: 12px;
}

.zone-title {
  font-size: 14px;
  font-weight: 600;
  color: #8fb4d8;
}

.zone-count {
  font-size: 12px;
  color: #5a7288;
  background: #0b1d33;
  padding: 1px 10px;
  border-radius: 10px;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.device-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 10px;
  padding: 16px 18px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.device-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at top left, rgba(90, 146, 208, 0.04) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s;
}

.device-card:hover {
  border-color: #2d5280;
  background: #0f2240;
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.device-card:hover::after {
  opacity: 1;
}

.device-card:hover .card-arrow {
  opacity: 1;
  transform: translateX(0);
}

.card-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.device-model {
  font-size: 10px;
  font-weight: 700;
  color: #5a92d0;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.device-name {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-location {
  font-size: 11px;
  color: #5a7288;
}

.card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-dot.online {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.6);
}

.status-text {
  font-size: 11px;
  color: #5a7288;
}

.card-arrow {
  font-size: 18px;
  color: #5a92d0;
  opacity: 0;
  transform: translateX(-6px);
  transition: all 0.3s;
  flex-shrink: 0;
}

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
  opacity: 0.4;
}

.empty-text {
  font-size: 15px;
  color: #5a7288;
}

.empty-hint {
  font-size: 12px;
  color: #3a5068;
}

@media (max-width: 1200px) {
  .device-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .device-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
