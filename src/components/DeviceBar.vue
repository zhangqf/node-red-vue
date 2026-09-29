<script setup lang="ts">
import { ref } from "vue";

interface ItemConfigItem {
  name: string;
  type: string;
  id: string | number;
}
const emit = defineEmits<{
  "update:active": [val: string];
  back: [];
  contactConfigClick: [type: string, nonInitialPageTransition?: boolean];
}>();

const props = defineProps<{
  deviceName?: string;
  combinationName?: string;
  configName?: string;
  active?: string;
  itemConfig: ItemConfigItem[];
  contactActive?: string;
  deviceType?: string;
  statusMessage?: string;
}>();

const contactConfig = [
  {
    id: 1,
    name: "1、3闭合",
    type: "contact13Closed",
  },
  {
    id: 1,
    name: "2、4闭合",
    type: "contact24Closed",
  },
];

const contactConfigActive = ref("");

// 触点点击事件
const handleContactConfigClick = (type: string) => {
  contactConfigActive.value = type;
  emit("contactConfigClick", type, true);
};

const handleButtonClick = (id: string) => {
  emit("update:active", id);
};
</script>

<template>
  <div class="device-bar-wrap">
    <div class="info-bar">
      <div class="info-left">
        <button class="back-btn" @click="emit('back')">← 返回</button>
        <span class="info-label">设备</span>
        <span class="info-value">{{ deviceName || "-" }}</span>
        <span class="info-label">设备类型</span>
        <span class="info-value">{{ deviceType || "-" }}</span>
        <span class="info-sep">›</span>
        <span class="info-label">组合方式</span>
        <span class="info-value">{{ combinationName || "-" }}</span>
        <span class="info-sep">›</span>
        <span class="info-label">测试机型</span>
        <span class="info-value highlight">{{ configName || "-" }}</span>

        <button
          v-for="item in contactConfig"
          class="contactConfig-btn"
          :key="item.id"
          :class="contactActive === item.type ? 'active' : ''"
          @click="handleContactConfigClick(item.type)">
          {{ item.name }}
        </button>
      </div>
      <div v-if="statusMessage" class="info-status" :title="statusMessage">
        {{ statusMessage }}
      </div>
      <!-- <div class="nav-right">
        <button class="emergency-btn" @click="emit('menu-click', 'emergency')">
          开启动作电源/紧急停止
        </button>
      </div> -->
    </div>

    <!-- <div class="switch-bar">
      <div class="switch-buttons">
        <button
          v-for="item in itemConfig"
          class="switch-btn"
          :key="item.id"
          :class="props.active === item.id ? 'active' : ''"
          @click="handleButtonClick(item.type)">
          {{ item.name }}
        </button>
      </div>
    </div> -->
  </div>
</template>

<style scoped>
.device-bar-wrap {
  flex-shrink: 0;
  border-bottom: 1px solid #1a2d44;
}

.info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 66px;
  background: #0b1d33;
  padding: 0 20px;
}

.info-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  flex: 1;
  min-width: 0;
}

.info-status {
  flex: 0 1 auto;
  max-width: 45%;
  margin-left: 20px;
  padding: 10px;
  border-radius: 3px;
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  font-size: 20px;
  text-align: right;
  overflow-wrap: anywhere;
  animation: pulse 0.5s ease-in-out 0.2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 900px) {
  .info-bar {
    height: auto;
    min-height: 66px;
    flex-wrap: wrap;
    gap: 8px 0;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .info-left {
    flex-wrap: wrap;
  }

  .info-status {
    max-width: 100%;
    margin-left: auto;
  }
}

.back-btn {
  background: transparent;
  border: 1px solid #1a2d44;
  color: #8fb4d8;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.2s;
  margin-right: 8px;
}

.back-btn:hover {
  background: rgba(90, 146, 208, 0.1);
}

.info-label {
  color: #5a7288;
}

.info-value {
  color: #c0d0e0;
}

.info-value.highlight {
  color: #5a92d0;
  font-weight: 600;
}

.info-sep {
  color: #2a4058;
  margin: 0 2px;
}

.switch-bar {
  display: flex;
  align-items: center;
  height: 34px;
  background: #08192b;
  padding: 0 20px;
}

.switch-buttons {
  display: flex;
  gap: 4px;
}

.switch-btn {
  background: rgba(90, 146, 208, 0.08);
  border: 1px solid #1a2d44;
  color: #7a8fa0;
  font-size: 12px;
  padding: 2px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.contactConfig-btn {
  background: rgba(90, 146, 208, 0.08);
  border: 1px solid #1a2d44;
  color: #7a8fa0;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
  margin: 0 10px;
}
.contactConfig-btn.active {
  background: rgba(90, 146, 208, 0.2);
  border-color: #5a92d0;
  color: #fff;
}

.switch-btn.active {
  background: rgba(90, 146, 208, 0.2);
  border-color: #5a92d0;
  color: #fff;
}

.switch-btn:hover:not(.active) {
  border-color: #2d5280;
  color: #bccfde;
}

.nav-right {
  display: flex;
  align-items: center;
}

.emergency-btn {
  background: #d93025;
  color: #fff;
  border: none;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 20px;
  border-radius: 4px;
  cursor: pointer;
  letter-spacing: 1px;
  transition: background 0.2s;
}

.emergency-btn:hover {
  background: #e8473b;
}
</style>
