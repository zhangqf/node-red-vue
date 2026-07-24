<script setup lang="ts">
import { ref } from "vue";

export interface TestItem {
  name: string;
  type: string;
  status: boolean | "NT";
  realCheck: boolean;
  relayName: string[];
  relayTips?: Record<string, string>[];
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

const perviewImg = ref("");

const detailVisible = ref(false);

function handleView(url: string) {
  detailVisible.value = true;
  perviewImg.value = url;
}

const circuitLoopExpanded = ref<Record<number, boolean>>({});

function toggleCircuitLoop(idx: number) {
  circuitLoopExpanded.value[idx] = !circuitLoopExpanded.value[idx];
}
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
            <!-- <span class="circuit-link" @click="handleView">查看电路图</span> -->
            <!-- 查看电路图按钮 -->
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
      <template
        v-if="
          (powerStatusIsRunning && availableDirections.DC) ||
          availableDirections.FC
        ">
        <div class="relay-results">
          <div
            v-for="(test, idx) in tests?.length ? tests : []"
            :key="idx"
            class="test-item">
            <div class="test-item-main">
              <div class="test-header">
                <span
                  class="test-dot"
                  :class="
                    test.status == 'NT' ? '' : test.status ? 'ok' : 'ng'
                  "></span>
                <span class="test-name">{{ test.name }}</span>
              </div>
              <div
                class="test-result"
                v-if="
                  test?.type === 'GreenLight' || test?.type === 'YellowLight'
                ">
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
              <div
                style="display: flex"
                v-if="
                  test.relayTips && test.relayTips.length > 0 && test.realCheck
                ">
                <button
                  style="margin-right: 14px"
                  class="circuit-view-btn"
                  @click="toggleCircuitLoop(idx)">
                  <span
                    class="circuit-toggle-icon"
                    :class="{ expanded: !circuitLoopExpanded[idx] }"
                    >&#9654;</span
                  >
                  电路环路
                </button>
                <button class="circuit-view-btn" @click="handleView(test.img)">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                  查看电路图
                </button>
              </div>
            </div>
            <!-- 电路环路详情 -->
            <div
              v-if="
                test.relayTips &&
                test.relayTips.length > 0 &&
                !circuitLoopExpanded[idx] &&
                test.realCheck
              "
              class="circuit-loop-panel">
              <div
                v-for="(tip, tipIdx) in test.relayTips"
                :key="tipIdx"
                class="circuit-loop-row">
                <template v-for="(path, port) in tip" :key="port">
                  <span class="circuit-port-badge">{{ port }}</span>
                  <span class="circuit-path-text">{{ path }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
    <Teleport to="body">
      <div
        v-if="detailVisible"
        class="modal-overlay"
        @click.self="detailVisible = false">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-header-left">
              <h3 class="modal-title">电路图</h3>
            </div>
            <button
              class="modal-close"
              @click="
                detailVisible = false;
                perviewImg = '';
              ">
              <svg viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div style="width: 100%; height: 80vh; padding: 10px">
            <img :src="perviewImg" alt="" width="100%" height="100%" />
          </div>
        </div>
      </div>
    </Teleport>
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

.circuit-link {
  margin-left: auto;
  font-size: 12px;
  color: #5a92d0;
  cursor: pointer;
  border: 1px solid rgba(90, 146, 208, 0.25);
  border-radius: 4px;
  transition: all 0.2s;
}

.circuit-link:hover {
  color: #8fb4d8;
  background: rgba(90, 146, 208, 0.1);
  border-color: rgba(90, 146, 208, 0.4);
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

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 14px;
  width: 860px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}
.modal-card::-webkit-scrollbar {
  display: none;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 28px 0;
}

.modal-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e8f0;
}

.modal-subtitle {
  font-size: 13px;
  color: #5a7288;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid #1a2d44;
  border-radius: 6px;
  color: #5a7288;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.modal-close:hover {
  color: #e0e8f0;
  border-color: #2d5280;
  background: rgba(90, 146, 208, 0.08);
}

/* Modal stats */
.modal-stats {
  display: flex;
  gap: 12px;
  padding: 20px 28px;
}

/* ---- 电路环路（仅作用于常规继电器结果区域） ---- */
.relay-results .test-item {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  padding: 0;
  background: transparent;
  border-left: 3px solid #1a2d44;
  overflow: hidden;
}

.relay-results .test-item:has(.test-dot.ok) {
  border-left-color: #34d399;
}

.relay-results .test-item:has(.test-dot.ng) {
  border-left-color: #f87171;
}

.test-item-main {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.2);
}

.circuit-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 2px 8px;
  background: rgba(90, 146, 208, 0.08);
  border: 1px solid rgba(90, 146, 208, 0.2);
  border-radius: 3px;
  color: #5a92d0;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.circuit-toggle:hover {
  background: rgba(90, 146, 208, 0.16);
  border-color: rgba(90, 146, 208, 0.35);
  color: #8fb4d8;
}

.circuit-toggle-icon {
  display: inline-block;
  font-size: 8px;
  transition: transform 0.2s ease;
}

.circuit-toggle-icon.expanded {
  transform: rotate(90deg);
}

.circuit-loop-panel {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(90, 146, 208, 0.1);
}

.circuit-loop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 24px;
  transition: background 0.15s;
}

.circuit-loop-row:hover {
  background: rgba(90, 146, 208, 0.04);
}

.circuit-port-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 20px;
  padding: 0 6px;
  background: rgba(90, 146, 208, 0.15);
  border: 1px solid rgba(90, 146, 208, 0.25);
  border-radius: 3px;
  color: #8fb4d8;
  font-size: 10px;
  font-weight: 700;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
  flex-shrink: 0;
}

.circuit-path-text {
  font-size: 11px;
  color: #6a8fa8;
  font-family: "SF Mono", "Monaco", "Menlo", monospace;
  word-break: break-all;
  line-height: 1.5;
  letter-spacing: 0.2px;
}

/* ---- 查看电路图按钮行 ---- */
.circuit-view-row {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
  margin-left: auto;
}

.circuit-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: rgba(90, 146, 208, 0.08);
  border: 1px solid rgba(90, 146, 208, 0.2);
  border-radius: 4px;
  color: #5a92d0;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.circuit-view-btn:hover {
  background: rgba(90, 146, 208, 0.16);
  border-color: rgba(90, 146, 208, 0.4);
  color: #8fb4d8;
}

.circuit-view-btn svg {
  flex-shrink: 0;
}
</style>
