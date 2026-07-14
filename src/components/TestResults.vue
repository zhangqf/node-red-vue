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
}>();

const defaultTests = [
  { name: "定位表示", type: "X1-C1:OK,X2-C10:OK", status: "NT" as const },
  { name: "反位表示", type: "X1:OK,X2:OK", status: "NT" as const },
  { name: "一级传动定位表示", type: "X1:OK,X2:OK", status: "NT" as const },
  { name: "一级传动反位表示", type: "X1:OK,X2:OK", status: "NT" as const },
  { name: "二传动定位表示", type: "X1:OK,X2:OK", status: "NT" as const },
  { name: "二级传动反位表示", type: "X1:OK,X2:OK", status: "NT" as const },
];
</script>

<template>
  <div class="test-panel">
    <div class="panel-header">
      <span class="panel-title">测试结果</span>
    </div>
    <div class="test-list">
      <h4
        v-if="tests && tests?.length > 0 && tests[0].type === 'empty'"
        style="color: #c18232">
        暂无表示继电器配置，跳过该组状态校验
      </h4>
      <div
        v-for="(test, idx) in tests?.length ? tests : defaultTests"
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
