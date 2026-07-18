<script setup lang="ts">
defineProps<{
  modbusStatus?: {
    connected: boolean;
    msg?: string;
    color?: string;
  };
  startBeforeTestTips: [];
  machineStatus: boolean;
}>();
</script>

<template>
  <div class="test-panel">
    <div class="panel-header">
      <span class="panel-title">{{
        modbusStatus && modbusStatus.connected
          ? "启动前测试测试结果"
          : "通讯异常"
      }}</span>
    </div>
    <div
      class="modbusStatus-content"
      v-if="modbusStatus && !modbusStatus.connected">
      {{ modbusStatus?.msg }}！ 请检查通讯连接或设备状态
    </div>
    <div v-else class="test-list">
      <div
        v-if="machineStatus"
        v-for="(test, idx) in startBeforeTestTips?.length
          ? startBeforeTestTips
          : []"
        :key="idx"
        class="test-item">
        <div class="test-header">
          <span class="test-dot" :class="test.isNormal ? 'ok' : 'ng'"></span>
          <span class="test-name">{{ test.channelName }}</span>
        </div>
        <div v-if="test?.type === 'GreenLight' || test?.type === 'YellowLight'">
          <span class="action-light">
            <span
              class="light"
              :class="{
                green:
                  test.type === 'GreenLight' &&
                  test.status !== 'NT' &&
                  test.status,
                yellow:
                  test.type === 'YellowLight' &&
                  test.status !== 'NT' &&
                  test.status,
              }"></span>
          </span>
        </div>
        <div v-else class="test-result" :class="test.isNormal ? 'ok' : 'ng'">
          {{ test.tip }}
        </div>
        <div v-if="test.realCheck"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.test-panel {
  flex: 1;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
}

.modbusStatus-content {
  font-size: 16px;
  color: #f87171;
  padding: 10px;
  background: rgba(248, 113, 113, 0.1);
  border-radius: 3px;
}

/* 给modbusStatus-content 添加动画 */
.modbusStatus-content {
  animation: pulse 0.5s ease-in-out 0.2s infinite;
}

.test-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.test-item {
  display: flex;
  /* flex-direction: column; */
  gap: 4px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  border-left: 3px solid #1a2d44;
  transition: border-color 0.2s;
}

.test-item:has(.test-dot.ok) {
  border-left-color: #34d399;
}

.test-item:has(.test-dot.ng) {
  border-left-color: #f87171;
}

.test-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.test-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5a7288;
}

.test-dot.ok {
  background: #34d399;
  box-shadow: 0 0 4px rgba(52, 211, 153, 0.4);
}

.test-dot.ng {
  background: #f87171;
  box-shadow: 0 0 4px rgba(248, 113, 113, 0.4);
}

.test-name {
  font-size: 12px;
  color: #bccfde;
}

.test-result {
  font-size: 10px;
  color: #5a7288;
  padding-left: 13px;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
}

.test-result.ok {
  color: #34d399;
}

.test-result.ng {
  color: #f87171;
}

.action-light {
  align-self: center;
  margin-left: 30px;
}

.light {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: inline-block;
  vertical-align: middle;
  background-color: #a6a6a6;
  box-shadow: 0 0 6px rgba(152, 157, 155, 0.6);
  transition: all 0.2s ease;
}

.light-green {
  background-color: #26c945;
  box-shadow: rgba(38, 201, 69, 0.75);
}

.light-yellow {
  background-color: #ffc520;
  box-shadow: rgba(255, 197, 32, 0.75);
}

.light {
  width: var(--light-size);
  height: var(--light-size);
  border-radius: 50%;
  display: inline-block;
  vertical-align: middle;
  /* 外层光晕 + 内部柔和高光双层阴影 */
  box-shadow:
    inset 0 -3px 6px rgba(0, 0, 0, 0.15),
    /* 内部暗边模拟球体 */ 0 0 8px var(--light-gray-glow);
  background-color: var(--light-gray);
  transition: all 0.25s ease;
  position: relative;
}

/* 灯珠顶部高光，更立体 */
.light::after {
  content: "";
  position: absolute;
  top: 15%;
  left: 20%;
  width: 30%;
  height: 20%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
}

/* 绿色亮灯 */
.light.green {
  background-color: var(--light-green);
  box-shadow:
    inset 0 -3px 6px rgba(0, 0, 0, 0.15),
    0 0 12px 2px var(--light-green-glow);
}
/* 黄色亮灯 */
.light.yellow {
  background-color: var(--light-yellow);
  box-shadow:
    inset 0 -3px 6px rgba(0, 0, 0, 0.15),
    0 0 12px 2px var(--light-yellow-glow);
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}
.light.blink {
  animation: blink 1s infinite;
}
</style>
