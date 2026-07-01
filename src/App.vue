<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import TopNav from "@/components/TopNav.vue";
import GlobalToast from "@/components/GlobalToast.vue";

const router = useRouter();

const activeMenu = ref("home");

function onMenuClick(menu: string) {
  switch (menu) {
    case "home":
      router.push({ name: "deviceList" });
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

const homeRoutes = ["deviceList", "configure", "work"];
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
}
</style>
