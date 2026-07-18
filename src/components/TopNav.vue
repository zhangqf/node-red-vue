<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

defineProps<{
  activeMenu?: string;
}>();

const emit = defineEmits<{
  (e: "menu-click", menu: string): void;
}>();

const openSubmenu = ref("");
const navRef = ref<HTMLElement | null>(null);

const menuItems = [
  { key: "home", label: "首页" },
  {
    key: "assets",
    label: "设备资产",
    children: [
      { key: "device-manager", label: "机型资产管理" },
      { key: "combination-manager", label: "组合方式管理" },
      { key: "config-manager", label: "测试机型管理" },
      { key: "binding-manager", label: "绑定配置" },
    ],
  },
  { key: "history", label: "历史记录" },
  { key: "settings", label: "系统设置" },
];

function onMenuClick(key: string) {
  openSubmenu.value = openSubmenu.value === key ? "" : key;
}

function onSubClick(subKey: string) {
  openSubmenu.value = "";
  emit("menu-click", subKey);
}

function onNavClick(key: string) {
  openSubmenu.value = "";
  emit("menu-click", key);
}

function onOutsideClick(e: MouseEvent) {
  if (navRef.value && !navRef.value.contains(e.target as Node)) {
    openSubmenu.value = "";
  }
}

function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") openSubmenu.value = "";
}

onMounted(() => {
  document.addEventListener("click", onOutsideClick);
  document.addEventListener("keydown", onEsc);
});

onUnmounted(() => {
  document.removeEventListener("click", onOutsideClick);
  document.removeEventListener("keydown", onEsc);
});
</script>

<template>
  <div ref="navRef" class="top-nav">
    <div class="nav-left">
      <span class="nav-logo">便携式转辙机测试系统</span>
    </div>
    <div class="nav-center">
      <div v-for="item in menuItems" :key="item.key" class="nav-item-wrapper">
        <button
          v-if="!item.children"
          :class="['nav-btn', { active: activeMenu === item.key }]"
          @click="onNavClick(item.key)">
          {{ item.label }}
        </button>
        <button
          v-else
          :class="['nav-btn', { active: openSubmenu === item.key }]"
          @click.stop="onMenuClick(item.key)">
          {{ item.label }}
          <span class="nav-arrow" :class="{ open: openSubmenu === item.key }"
            >▾</span
          >
        </button>
        <div
          v-if="item.children && openSubmenu === item.key"
          class="nav-submenu"
          @click.stop>
          <button
            v-for="child in item.children"
            :key="child.key"
            class="nav-sub-btn"
            @click="onSubClick(child.key)">
            {{ child.label }}
          </button>
        </div>
      </div>
    </div>
    <div class="nav-right">
      <!-- <button class="emergency-btn" @click="emit('menu-click', 'emergency')">
        紧急停止
      </button> -->
    </div>
  </div>
</template>

<style scoped>
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  background: #051424;
  border-bottom: 1px solid #1a2d44;
  padding: 0 20px;
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

.nav-left {
  display: flex;
  align-items: center;
}

.nav-logo {
  font-size: 14px;
  font-weight: 600;
  color: #8fb4d8;
  letter-spacing: 0.5px;
}

.nav-center {
  display: flex;
  gap: 4px;
}

.nav-item-wrapper {
  position: relative;
}

.nav-btn {
  background: transparent;
  border: none;
  color: #7a8fa0;
  font-size: 13px;
  padding: 6px 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-height: 36px;
}

.nav-btn:hover {
  color: #bccfde;
  background: rgba(90, 146, 208, 0.1);
}

.nav-btn.active {
  color: #fff;
  background: #1a3350;
}

.nav-arrow {
  margin-left: 4px;
  font-size: 10px;
  display: inline-block;
  transition: transform 0.2s;
}

.nav-arrow.open {
  transform: rotate(180deg);
}

.nav-submenu {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 6px;
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 101;
}

.nav-sub-btn {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: #8fb4d8;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 36px;
}

.nav-sub-btn:hover {
  background: #1a3350;
  color: #fff;
}

.nav-right {
  display: flex;
  align-items: center;
}

.emergency-btn {
  background: #d93025;
  color: #fff;
  border: none;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 20px;
  border-radius: 4px;
  cursor: pointer;
  letter-spacing: 1px;
  transition: background 0.2s;
}

.emergency-btn:hover {
  background: #e8473b;
}
</style>
