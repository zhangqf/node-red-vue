<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

function goStation() {
  router.push({ name: "station" });
}

function goNormal() {
  router.push({ name: "devices" });
}
</script>

<template>
  <div class="home-page">
    <!-- Decorative background illustration -->

    <!-- Content overlay -->
    <div class="content-overlay">
      <div class="hero-section">
        <h1 class="hero-title">便携式转辙机测试系统</h1>
        <p class="hero-subtitle">Portable Switch Machine Testing System</p>
        <div class="hero-divider"></div>
      </div>

      <div class="mode-cards">
        <!-- Station Mode Card -->
        <div class="mode-card" @click="goStation">
          <div class="card-glow"></div>
          <div class="card-icon-box">
            <svg
              viewBox="0 0 72 72"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <!-- Track lines -->
              <line
                x1="6"
                y1="38"
                x2="66"
                y2="38"
                stroke="#5a92d0"
                stroke-width="2.5"
                stroke-linecap="round"
                opacity="0.5" />
              <line
                x1="6"
                y1="50"
                x2="66"
                y2="50"
                stroke="#5a92d0"
                stroke-width="2.5"
                stroke-linecap="round"
                opacity="0.3" />
              <!-- Switch -->
              <line
                x1="30"
                y1="38"
                x2="45"
                y2="50"
                stroke="#5a92d0"
                stroke-width="2"
                stroke-linecap="round" />
              <!-- Active device markers -->
              <circle cx="18" cy="38" r="4" fill="#34d399" opacity="0.9" />
              <circle cx="18" cy="38" r="8" fill="#34d399" opacity="0.15" />
              <circle cx="54" cy="50" r="4" fill="#34d399" opacity="0.9" />
              <circle cx="54" cy="50" r="8" fill="#34d399" opacity="0.15" />
              <!-- Signal point -->
              <circle cx="38" cy="44" r="3" fill="#f87171" opacity="0.7" />
            </svg>
          </div>
          <div class="card-content">
            <h2 class="card-title">站场模式</h2>
            <p class="card-desc">
              以站场拓扑视图展示转辙机点位分布，<br />直观查看设备状态与实时数据
            </p>
          </div>
          <div class="card-footer">
            <span class="card-enter">进入模式</span>
            <span class="card-arrow">→</span>
          </div>
        </div>

        <!-- Normal Mode Card -->
        <div class="mode-card" @click="goNormal">
          <div class="card-glow"></div>
          <div class="card-icon-box">
            <svg
              viewBox="0 0 72 72"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <!-- Grid cards -->
              <rect
                x="8"
                y="10"
                width="24"
                height="22"
                rx="4"
                stroke="#5a92d0"
                stroke-width="1.8"
                fill="rgba(90,146,208,0.06)" />
              <rect
                x="40"
                y="10"
                width="24"
                height="22"
                rx="4"
                stroke="#5a92d0"
                stroke-width="1.8"
                fill="rgba(90,146,208,0.06)" />
              <rect
                x="8"
                y="40"
                width="24"
                height="22"
                rx="4"
                stroke="#5a92d0"
                stroke-width="1.8"
                fill="rgba(90,146,208,0.06)" />
              <rect
                x="40"
                y="40"
                width="24"
                height="22"
                rx="4"
                stroke="#5a92d0"
                stroke-width="1.8"
                fill="rgba(90,146,208,0.06)" />
              <!-- Text lines in cards -->
              <rect
                x="13"
                y="15"
                width="14"
                height="3"
                rx="1.5"
                fill="#5a92d0"
                opacity="0.4" />
              <rect
                x="13"
                y="21"
                width="9"
                height="2"
                rx="1"
                fill="#5a92d0"
                opacity="0.25" />
              <rect
                x="45"
                y="15"
                width="14"
                height="3"
                rx="1.5"
                fill="#5a92d0"
                opacity="0.4" />
              <rect
                x="45"
                y="21"
                width="9"
                height="2"
                rx="1"
                fill="#5a92d0"
                opacity="0.25" />
              <rect
                x="13"
                y="45"
                width="14"
                height="3"
                rx="1.5"
                fill="#5a92d0"
                opacity="0.4" />
              <rect
                x="13"
                y="51"
                width="9"
                height="2"
                rx="1"
                fill="#5a92d0"
                opacity="0.25" />
              <rect
                x="45"
                y="45"
                width="14"
                height="3"
                rx="1.5"
                fill="#5a92d0"
                opacity="0.4" />
              <rect
                x="45"
                y="51"
                width="9"
                height="2"
                rx="1"
                fill="#5a92d0"
                opacity="0.25" />
            </svg>
          </div>
          <div class="card-content">
            <h2 class="card-title">常规模式</h2>
            <p class="card-desc">
              列表形式浏览设备清单，按步骤选择<br />组合方式与测试机型进入工作台
            </p>
          </div>
          <div class="card-footer">
            <span class="card-enter">进入模式</span>
            <span class="card-arrow">→</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ---- Background illustration ---- */
.bg-illustration {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* ---- Content ---- */
.content-overlay {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  padding: 40px;
}

.hero-section {
  text-align: center;
}

.hero-title {
  font-size: 34px;
  font-weight: 700;
  color: #e0e8f0;
  letter-spacing: 3px;
  margin-bottom: 10px;
  text-shadow: 0 2px 20px rgba(90, 146, 208, 0.15);
}

.hero-subtitle {
  font-size: 13px;
  color: #4a6880;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 0;
}

.hero-divider {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #5a92d0, transparent);
  margin: 16px auto 0;
  opacity: 0.6;
}

/* ---- Mode Cards ---- */
.mode-cards {
  display: flex;
  gap: 36px;
}

.mode-card {
  width: 340px;
  background: rgba(40, 93, 157, 0);
  border: 1px solid rgba(26, 45, 68, 0.8);
  border-radius: 16px;
  padding: 32px 28px 24px;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.card-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 30% 20%,
    rgba(117, 161, 212, 0.06) 0%,
    transparent 60%
  );
  opacity: 0;
  transition: opacity 0.35s;
}

.mode-card:hover {
  border-color: #386397;
  background: rgba(15, 34, 64, 0.9);
  transform: translateY(-3px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(90, 146, 208, 0.05);
}

.mode-card:hover .card-glow {
  opacity: 1;
}

.mode-card:hover .card-arrow {
  transform: translateX(4px);
  opacity: 1;
}

.mode-card:hover .card-enter {
  color: #b8d4f0;
}

/* Card icon */
.card-icon-box {
  width: 72px;
  height: 72px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-content {
  text-align: center;
  margin-bottom: 24px;
}

.card-title {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 12px;
  letter-spacing: 1px;
}

.card-desc {
  font-size: 13px;
  color: #ffffff;
  line-height: 1.7;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid rgba(26, 45, 68, 0.5);
}

.card-enter {
  font-size: 13px;
  color: #ffffff;
  transition: color 0.3s;
}

.card-arrow {
  font-size: 16px;
  color: #cfd4d9;
  opacity: 0.6;
  transition: all 0.3s;
  transform: translateX(0);
}
</style>
