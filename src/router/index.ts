import { createRouter, createWebHistory } from "vue-router";
import DeviceList from "@/views/deviceList.vue";
import Configure from "@/views/configure.vue";
import Work from "@/views/work.vue";
import DeviceManager from "@/views/DeviceManager.vue";
import ConfigManager from "@/views/ConfigManager.vue";
import CombinationManager from "@/views/CombinationManager.vue";
import BindingManager from "@/views/BindingManager.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "deviceList", component: DeviceList },
    { path: "/devices", name: "device-manager", component: DeviceManager },
    { path: "/configs", name: "config-manager", component: ConfigManager },
    { path: "/combinations", name: "combination-manager", component: CombinationManager },
    { path: "/bindings", name: "binding-manager", component: BindingManager },
    { path: "/configure/:deviceId", name: "configure", component: Configure },
    { path: "/work/:deviceId/:configId", name: "work", component: Work },
  ],
});

export default router;
