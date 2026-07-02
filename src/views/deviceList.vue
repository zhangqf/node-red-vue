<script setup lang="ts">
import { HTTP_URL } from "@/config/config";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";

const { withLoading } = useToast();

const router = useRouter();

const devices = ref([
  { id: "device-001", name: "ZD6 转辙机 #001", location: "站场 A 区" },
  { id: "device-002", name: "ZD6 转辙机 #002", location: "站场 B 区" },
  { id: "device-003", name: "ZD6 转辙机 #003", location: "站场 C 区" },
  { id: "device-004", name: "S700K 转辙机 #001", location: "站场 A 区" },
]);

function onDeviceClick(deviceId: string) {
  router.push({ name: "configure", params: { deviceId } });
}

const getList = async () => {
  try {
    const response = await fetch(HTTP_URL + "/deviceList", {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    devices.value = await response.json();
  } catch {}
};

onMounted(async () => {
  await withLoading(async () => {
    getList();
  }, "数据加载成功");
});
</script>

<template>
  <div class="device-list-page">
    <h2 class="page-title">设备列表</h2>
    <div class="device-grid">
      <div
        v-for="device in devices"
        :key="device.id"
        class="device-card"
        @click="onDeviceClick(device.id)">
        <div class="device-name">{{ device.name }}</div>
        <div class="device-location">{{ device.location }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-list-page {
  padding: 24px;
}

.page-title {
  font-size: 18px;
  color: #8fb4d8;
  margin-bottom: 20px;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.device-card {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.device-card:hover {
  border-color: #2d5280;
  background: #0f2240;
}

.device-name {
  font-size: 15px;
  font-weight: 600;
  color: #e0e8f0;
  margin-bottom: 6px;
}

.device-location {
  font-size: 12px;
  color: #5a7288;
}
</style>
