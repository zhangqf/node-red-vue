<script setup lang="ts">
import { ref } from "vue";

interface ItemConfigItem {
  name: string;
  type: string;
}

const props = defineProps<{
  deviceName?: string;
  driveMode?: string;
  direction?: string;
  active?: RelayKey;
  itemConfig: ItemConfigItem[];
}>();

export type RelayKey = "1E" | "1J" | "2E" | "2J";

const emit = defineEmits<{
  "update:active": [val: RelayKey];
}>();

const handleButtonClick = (item: ItemConfigItem) => {
  // props.active.value = ;
  emit("update:active", item.type as RelayKey);
};
</script>

<template>
  <div>
    <div class="device-bar">
      <div class="device-info">
        <span class="device-label">当前设备：</span>
        <span class="device-value">{{ deviceName || "ZD6" }} ｜ 双动双机</span>
        <span class="device-separator">|</span>
        <!-- <span class="device-label">驱动方式：</span>
        <span class="device-value">{{ driveMode || "1、3闭合" }}</span> -->
        <!-- <span class="device-separator">|</span> -->
        <span class="device-label">转换方向：</span>
        <span class="device-value">{{ direction || "定位 反" }}</span>
      </div>
      <div class="device-actions">
        <button class="config-btn">/ 修改配置</button>
      </div>
    </div>
    <div class="device-item">
      <div>
        <h4>测试机型</h4>
        <div class="action-buttons">
          <button
            v-for="item in itemConfig"
            class="action-btn"
            :class="props.active === item.type ? 'active' : ''"
            @click="handleButtonClick(item)">
            {{ item.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  background: #0b1d33;
  border-bottom: 1px solid #1a2d44;
  padding: 0 20px;
  flex-shrink: 0;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.device-label {
  color: #7a8fa0;
}

.device-value {
  color: #e0e8f0;
  font-weight: 500;
}

.device-separator {
  color: #2a4058;
}
.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 80px;
  background: #0b1d33;
  border-bottom: 1px solid #1a2d44;
  padding: 0 20px;
  flex-shrink: 0;
}
.config-btn {
  background: transparent;
  border: 1px solid #2a4a68;
  color: #8fb4d8;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.config-btn:hover {
  border-color: #5a92d0;
  color: #b8d4f0;
}

.action-buttons {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.action-btn {
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid #2a4a68;
  color: #7a8fa0;
  font-size: 16px;
  padding: 4px 16px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.active {
  background: rgba(90, 146, 208, 0.25);
  border-color: #5a92d0;
  color: #fff;
}

.action-btn:hover:not(.active) {
  border-color: #5a92d0;
  color: #bccfde;
}
</style>
