<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import TopNav from "@/components/TopNav.vue";
import GlobalToast from "@/components/GlobalToast.vue";

const router = useRouter();

const activeMenu = ref("home");

// ---- 自动更新 ----
const updateReady = ref(false);
const updateVersion = ref("");
const updateDownloading = ref(false);
const updateProgress = ref(0);

onMounted(() => {
  const api = window.electronAPI;
  if (!api) return;

  api.onUpdateStatus((status) => {
    if (status === "downloading") {
      updateDownloading.value = true;
    }
  });
  api.onUpdateProgress((pct) => {
    updateProgress.value = Math.round(pct);
  });
  api.onUpdateDownloaded((version) => {
    updateDownloading.value = false;
    updateVersion.value = version;
    updateReady.value = true;
  });
});

function restartToUpdate() {
  window.electronAPI?.installUpdate();
}

function onMenuClick(menu: string) {
  switch (menu) {
    case "home":
      router.push({ name: "home" });
      break;
    case "device-manager":
      router.push({ name: "device-manager" });
      break;
    case "combination-manager":
      router.push({ name: "combination-manager" });
      break;
    case "config-manager":
      router.push({ name: "config-manager" });
      break;
    case "binding-manager":
      router.push({ name: "binding-manager" });
      break;
    case "history":
      router.push({ name: "history" });
      break;
    case "settings":
      break;
  }
}

const homeRoutes = ["home", "station", "devices", "configure", "work"];
const assetRoutes = ["device-manager", "combination-manager", "config-manager", "binding-manager"];

watch(
  () => router.currentRoute.value.name,
  (name) => {
    if (homeRoutes.includes(name as string)) activeMenu.value = "home";
    else if (assetRoutes.includes(name as string)) activeMenu.value = "assets";
    else if (name === "history") activeMenu.value = "history";
    else if (name === "settings") activeMenu.value = "settings";
    else activeMenu.value = "home";
  },
  { immediate: true }
);
</script>

<template>
  <div class="app-shell">
    <TopNav :active-menu="activeMenu" @menu-click="onMenuClick" />
    <router-view />
    <GlobalToast />

    <!-- 更新通知条 -->
    <Transition name="update-slide">
      <div v-if="updateDownloading || updateReady" class="update-bar">
        <template v-if="updateDownloading">
          <span class="update-text">正在下载更新 {{ updateProgress }}%</span>
          <div class="update-progress-track">
            <div class="update-progress-fill" :style="{ width: updateProgress + '%' }" />
          </div>
        </template>
        <template v-else>
          <span class="update-text">新版本 v{{ updateVersion }} 已就绪</span>
          <button class="update-btn" @click="restartToUpdate">重启安装</button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  background: #051424;
  color: #e0e8f0;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  overflow: hidden;
}
</style>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #051424;
  position: relative;
}

/* ---- 更新提示条 ---- */
.update-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(13, 35, 57, 0.97);
  border-top: 1px solid #2a5680;
  backdrop-filter: blur(8px);
}

.update-text {
  font-size: 13px;
  color: #8fb4d8;
}

.update-btn {
  padding: 4px 14px;
  background: #2a5680;
  border: none;
  border-radius: 3px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.update-btn:hover {
  background: #3a6ea0;
}

.update-progress-track {
  width: 120px;
  height: 4px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  background: #4dabf7;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.update-slide-enter-active,
.update-slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.update-slide-enter-from,
.update-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
