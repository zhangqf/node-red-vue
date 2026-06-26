<script setup lang="ts">
import { HTTP_URL } from "@/config/config";
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const configItems = [
  { id: "cfg-001", name: "双动双机", description: "标准拉力曲线检测" },
  {
    id: "cfg-002",
    name: "反位→定位 拉力测试",
    description: "反向拉力曲线检测",
  },
  {
    id: "cfg-003",
    name: "驱动回路 导通测试",
    description: "X1-C1, X2-C10 回路检测",
  },
  { id: "cfg-004", name: "表示回路 导通测试", description: "表示回路状态检测" },
  { id: "cfg-005", name: "绝缘耐压 测试", description: "绝缘电阻与耐压检测" },
];

function onConfigClick(configId: string) {
  router.push({
    name: "work",
    params: { deviceId: route.params.deviceId, configId },
  });
}
const data = ref([]);
const getList = async (id: string) => {
  try {
    const response = await fetch(HTTP_URL + "/getDeviceCombination/" + id, {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    data.value = await response.json();
    console.log(data);
  } catch {}
};

onMounted(() => {
  getList(route.params.deviceId);
});
</script>

<template>
  <div class="configure-page">
    <div class="page-header">
      <button class="back-btn" @click="router.back()">← 返回</button>
      <h2 class="page-title">配置项选择 — {{ route.params.deviceId }}</h2>
    </div>
    <div class="config-list">
      <div
        v-for="item in configItems"
        :key="item.id"
        class="config-card"
        @click="onConfigClick(item.id)">
        <div class="config-name">{{ item.name }}</div>
        <div class="config-desc">{{ item.description }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.configure-page {
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
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

.config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 600px;
}

.config-card {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
  padding: 16px 20px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.config-card:hover {
  border-color: #2d5280;
  background: #0f2240;
}

.config-name {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
  margin-bottom: 4px;
}

.config-desc {
  font-size: 12px;
  color: #5a7288;
}
</style>
