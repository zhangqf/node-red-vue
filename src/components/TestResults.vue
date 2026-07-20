<script setup lang="ts">
export interface TestItem {
  name: string;
  type: string;
  status: boolean | "NT";
  realCheck: boolean;
  relayName: string[];
}

defineProps<{
  tests?: TestItem[];
  modbusStatus?: {
    connected: boolean;
    msg?: string;
    color?: string;
  };
  isAction: boolean;
  powerStatusIsRunning: boolean;
  /** 启动前测试结果，非 null 时展示测试详情 */
  testResult?: {
    dcResult: {
      channelName: string;
      value: number;
      tip: string;
      isNormal: boolean;
    }[];
    fcResult: {
      channelName: string;
      value: number;
      tip: string;
      isNormal: boolean;
    }[];
    allTrue: boolean;
    direction: { DC: boolean; FC: boolean; diagnosis: string[] };
  } | null;
  availableDirections: { DC: boolean; FC: boolean };
  diagnosisMessages: string[];
  startBeforeLoading: boolean;
}>();
</script>

<template>
  <div class="test-panel">
    <div class="panel-header">
      <span class="panel-title">{{
        modbusStatus && modbusStatus.connected ? "测试结果" : "通讯异常"
      }}</span>
    </div>
    <!-- 通讯异常 -->
    <div
      class="modbusStatus-content"
      v-if="modbusStatus && !modbusStatus.connected">
      {{ modbusStatus?.msg }}！ 请检查通讯连接或设备状态
    </div>

    <div v-else class="test-list">
      <template v-if="!powerStatusIsRunning">
        <div class="modbusStatus-content">开启电源</div>
      </template>
      <template v-if="startBeforeLoading"> 启动前测试，等待结果中... </template>
      <!-- 启动前测试结果（始终显示，不隐藏） -->
      <template v-if="testResult">
        <div class="direction-banner">
          <div class="direction-row">
            <span class="direction-label">定操</span>
            <span
              class="direction-status"
              :class="availableDirections.DC ? 'ok' : 'ng'">
              {{ availableDirections.DC ? "可用" : "不可用" }}
            </span>
            <span class="direction-divider">|</span>
            <span class="direction-label">反操</span>
            <span
              class="direction-status"
              :class="availableDirections.FC ? 'ok' : 'ng'">
              {{ availableDirections.FC ? "可用" : "不可用" }}
            </span>
          </div>
        </div>

        <div v-if="diagnosisMessages.length > 0" class="diagnosis-box">
          <div
            v-for="(msg, idx) in diagnosisMessages"
            :key="idx"
            class="diagnosis-item">
            {{ msg }}
          </div>
        </div>

        <div class="section-label">
          定操视角
          <span v-if="availableDirections.DC" class="section-badge ok"
            >通过</span
          >
          <span v-else class="section-badge ng">未通过</span>
        </div>
        <div
          v-for="(test, idx) in testResult.dcResult"
          :key="'dc-' + idx"
          class="test-item">
          <div class="test-header">
            <span class="test-dot" :class="test.isNormal ? 'ok' : 'ng'"></span>
            <span class="test-name">{{ test.channelName }}</span>
            <span class="test-value">{{ test.value }}Ω</span>
          </div>
          <div class="test-result" :class="test.isNormal ? 'ok' : 'ng'">
            {{ test.tip }}
          </div>
        </div>

        <div class="section-label section-divider">
          反操视角
          <span v-if="availableDirections.FC" class="section-badge ok"
            >通过</span
          >
          <span v-else class="section-badge ng">未通过</span>
        </div>
        <div
          v-for="(test, idx) in testResult.fcResult"
          :key="'fc-' + idx"
          class="test-item">
          <div class="test-header">
            <span class="test-dot" :class="test.isNormal ? 'ok' : 'ng'"></span>
            <span class="test-name">{{ test.channelName }}</span>
            <span class="test-value">{{ test.value }}Ω</span>
          </div>
          <div class="test-result" :class="test.isNormal ? 'ok' : 'ng'">
            {{ test.tip }}
          </div>
        </div>

        <div class="section-divider"></div>
      </template>

      <!-- 常规表示继电器结果 -->
      <h4
        v-if="tests && tests?.length > 0 && tests[0].type === 'empty'"
        style="color: #c18232">
        暂无表示继电器配置，跳过该组状态校验
      </h4>
      <div
        v-if="
          (powerStatusIsRunning && availableDirections.DC) ||
          availableDirections.FC
        "
        v-for="(test, idx) in tests?.length ? tests : []"
        :key="idx"
        class="test-item">
        <div class="test-header">
          <span
            class="test-dot"
            :class="
              test.status == 'NT' ? '' : test.status ? 'ok' : 'ng'
            "></span>
          <span class="test-name">{{ test.name }}</span>
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
        <div
          v-else
          class="test-result"
          :class="test.status == 'NT' ? '' : test.status ? 'ok' : 'ng'">
          {{ test.status == "NT" ? "--" : test.status ? "OK" : "NG" }}
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
  animation: pulse 0.5s ease-in-out 0.2s infinite;
}

.test-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
}

.test-list::-webkit-scrollbar {
  display: none;
}

.test-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
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
  flex-shrink: 0;
  min-width: 100px;
}

.test-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5a7288;
  flex-shrink: 0;
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

.test-value {
  font-size: 11px;
  color: #5a7288;
  margin-left: auto;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
}

.test-result {
  font-size: 10px;
  color: #5a7288;
  padding-left: 13px;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
  flex: 1;
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
  box-shadow:
    inset 0 -3px 6px rgba(0, 0, 0, 0.15),
    0 0 8px var(--light-gray-glow);
  background-color: var(--light-gray);
  transition: all 0.25s ease;
  position: relative;
}

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

.light.green {
  background-color: var(--light-green);
  box-shadow:
    inset 0 -3px 6px rgba(0, 0, 0, 0.15),
    0 0 12px 2px var(--light-green-glow);
}

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

/* ---- 方向判定横幅 ---- */
.direction-banner {
  background: rgba(0, 153, 255, 0.06);
  border: 1px solid rgba(0, 153, 255, 0.15);
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 4px;
}

.direction-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.direction-label {
  font-size: 13px;
  color: #8fb4d8;
  font-weight: 600;
}

.direction-status {
  font-size: 13px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 4px;
}

.direction-status.ok {
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
}

.direction-status.ng {
  color: #5a7288;
  background: rgba(90, 114, 136, 0.1);
}

.direction-divider {
  color: #1a2d44;
  margin: 0 4px;
}

/* ---- 诊断信息 ---- */
.diagnosis-box {
  background: rgba(248, 113, 113, 0.06);
  border: 1px solid rgba(248, 113, 113, 0.15);
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 4px;
}

.diagnosis-item {
  font-size: 11px;
  color: #fca5a5;
  line-height: 1.8;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
}

.diagnosis-item::before {
  content: "! ";
  color: #f87171;
  font-weight: 700;
}

/* ---- 区块标签 ---- */
.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #8fb4d8;
  padding: 6px 0 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-divider {
  margin-top: 8px;
  border-top: 1px solid #1a2d44;
  padding-top: 10px;
}

.section-badge {
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 3px;
  font-weight: 700;
}

.section-badge.ok {
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
}

.section-badge.ng {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}
</style>
