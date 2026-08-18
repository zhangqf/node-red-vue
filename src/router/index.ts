import { createRouter, createWebHashHistory, createWebHistory } from "vue-router";
import Home from "@/views/Home.vue";
import Station from "@/views/Station.vue";
import DeviceList from "@/views/deviceList.vue";
import Configure from "@/views/configure.vue";
import Work from "@/views/work.vue";
import DeviceManager from "@/views/DeviceManager.vue";
import ConfigManager from "@/views/ConfigManager.vue";
import CombinationManager from "@/views/CombinationManager.vue";
import BindingManager from "@/views/BindingManager.vue";
import ChannelConfigManager from "@/views/ChannelConfigManager.vue";
import ThresholdConfigManager from "@/views/ThresholdConfigManager.vue";
import CurveThresholdConfigManager from "@/views/CurveThresholdConfigManager.vue";
import RecordList from "@/views/RecordList.vue";
import Settings from "@/views/Settings.vue";
import { useAuth } from "@/composables/useAuth";

const assetRouteNames = ["device-manager", "combination-manager", "config-manager", "binding-manager", "channel-config-manager", "threshold-config-manager", "curve-threshold-manager"];

const isElectron = !!(window as any).electronAPI;
const router = createRouter({
  history: isElectron ? createWebHashHistory() : createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Home },
    { path: "/station", name: "station", component: Station },
    { path: "/devices", name: "devices", component: DeviceList },
    { path: "/device-manager", name: "device-manager", component: DeviceManager },
    { path: "/configs", name: "config-manager", component: ConfigManager },
    {
      path: "/combinations",
      name: "combination-manager",
      component: CombinationManager,
    },
    { path: "/bindings", name: "binding-manager", component: BindingManager },
    { path: "/channel-configs", name: "channel-config-manager", component: ChannelConfigManager },
    { path: "/threshold-configs", name: "threshold-config-manager", component: ThresholdConfigManager },
    { path: "/curve-thresholds", name: "curve-threshold-manager", component: CurveThresholdConfigManager },
    { path: "/configure/:deviceId", name: "configure", component: Configure },
    { path: "/work/:deviceId/:combinationId/:configId", name: "work", component: Work },
    { path: "/records", name: "history", component: RecordList },
    { path: "/settings", name: "settings", component: Settings },
  ],
});

router.beforeEach((to, _from, next) => {
  if (assetRouteNames.includes(to.name as string)) {
    const { sessionAuthed } = useAuth();
    if (!sessionAuthed.value) {
      next({ name: "home" });
      return;
    }
  }
  next();
});

export default router;
