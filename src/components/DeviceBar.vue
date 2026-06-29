<script setup lang="ts">
interface ItemConfigItem {
  name: string;
  type: string;
  id: string | number;
}

const props = defineProps<{
  deviceName?: string;
  combinationName?: string;
  configName?: string;
  active?: string;
  itemConfig: ItemConfigItem[];
}>();

const emit = defineEmits<{
  "update:active": [val: string];
  back: [];
}>();

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
        <span class="info-sep">›</span>
        <span class="info-label">组合方式</span>
        <span class="info-value">{{ combinationName || "-" }}</span>
        <span class="info-sep">›</span>
        <span class="info-label">测试机型</span>
        <span class="info-value highlight">{{ configName || "-" }}</span>
      </div>
    </div>
    <!-- <div class="switch-bar">
      <div class="switch-buttons">
        <button
          v-for="item in itemConfig"
          class="switch-btn"
          :key="item.id"
          :class="props.active === item.id ? 'active' : ''"
          @click="handleButtonClick(item.id)">
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
  height: 36px;
  background: #0b1d33;
  padding: 0 20px;
}

.info-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.back-btn {
  background: transparent;
  border: 1px solid #1a2d44;
  color: #8fb4d8;
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  margin-right: 10px;
  min-height: 30px;
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

.switch-btn.active {
  background: rgba(90, 146, 208, 0.2);
  border-color: #5a92d0;
  color: #fff;
}

.switch-btn:hover:not(.active) {
  border-color: #2d5280;
  color: #bccfde;
}
</style>
