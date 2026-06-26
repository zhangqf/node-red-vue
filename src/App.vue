<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import TopNav from "@/components/TopNav.vue";

const router = useRouter();

const activeMenu = ref("home");

function onMenuClick(menu: string) {
  switch (menu) {
    case "home":
      activeMenu.value = "home";
      router.push({ name: "deviceList" });
      break;
    case "device-manager":
      activeMenu.value = "assets";
      router.push({ name: "device-manager" });
      break;
    case "combination-manager":
      activeMenu.value = "assets";
      router.push({ name: "combination-manager" });
      break;
    case "config-manager":
      activeMenu.value = "assets";
      router.push({ name: "config-manager" });
      break;
    case "binding-manager":
      activeMenu.value = "assets";
      router.push({ name: "binding-manager" });
      break;
    case "history":
      activeMenu.value = "history";
      break;
    case "settings":
      activeMenu.value = "settings";
      break;
  }
}
</script>

<template>
  <div class="app-shell">
    <TopNav :active-menu="activeMenu" @menu-click="onMenuClick" />
    <router-view />
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
