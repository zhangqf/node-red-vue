import {
  fetchChannelConfigs,
  fetchCombination,
  fetchConfig,
  fetchConfigList,
  fetchCurveThresholds,
  fetchDevice,
  fetchResistanceThresholds,
} from "@/api/work";
import { HTTP_URL, WEBSOCKET_URL } from "@/config/config";
import type { ActionRelays } from "@/utils/interface";
import { ref } from "vue";

export function useDeviceLoad(ws: { connect: () => void }) {
  const active = ref<string>("");
  const device = ref<{ name: string }>({ name: "" });
  const combinationName = ref<string>("");
  const deviceType = ref<string>("");
  const configName = ref<string>("");

  const contact13Closed = ref<ActionRelays>({
    DC: [],
    FC: [],
    DWBS: [],
    EJCDDWBS: [],
    EJCDFWBS: [],
    FWBS: [],
    YJCDDWBS: [],
    YJCDFWBS: [],
    DCB: [],
    FCB: [],
    DCC: [],
    FCC: [],
  });
  const contact24Closed = ref<ActionRelays>({
    DC: [],
    FC: [],
    DWBS: [],
    EJCDDWBS: [],
    EJCDFWBS: [],
    FWBS: [],
    YJCDDWBS: [],
    YJCDFWBS: [],
    DCB: [],
    FCB: [],
    DCC: [],
    FCC: [],
  });
  const channelConfigs = ref<any[]>([]);
  const resistanceThresholds = ref<any[]>([]);
  const curveThresholds = ref<any[]>([]);
  const itemConfig = ref<any[]>([]);

  const deviceId = ref("");
  const combinationId = ref("");
  const configId = ref("");
  const codeName = ref("");
  const routeCloseType = ref("");
  ws.connect();
  /* 获取代码设备列表 */
  async function getCodeDeviceList(
    handleContactConfigClick: (type: string) => void,
  ) {
    try {
      const [
        comboRes,
        configRes,
        channelConfigRes,
        thresholdRes,
        curveThresholdRes,
      ] = await Promise.all([
        fetchCombination(combinationId.value),
        fetchConfigList(configId.value),
        fetchChannelConfigs(),
        fetchResistanceThresholds(),
        fetchCurveThresholds(),
      ]);

      active.value = configId.value;
      device.value.name = codeName.value || "";
      const comboData = await comboRes.json();

      combinationName.value = comboData.name || "";
      deviceType.value = comboData.deviceType || "";
      // ws.send({ type: "setDeviceType", deviceType: deviceType.value });

      const configData = await configRes.json();
      // configActionRelays.value = configData.actionRelays || {};
      contact13Closed.value = configData.contact13Closed || {};
      contact24Closed.value = configData.contact24Closed || {};
      configName.value = configData.name || "";

      channelConfigs.value = await channelConfigRes.json();
      resistanceThresholds.value = await thresholdRes.json();
      curveThresholds.value = await curveThresholdRes.json();

      if (
        routeCloseType.value === "contact13Closed" ||
        routeCloseType.value === "contact24Closed"
      ) {
        handleContactConfigClick(routeCloseType.value);
      }
    } catch (e) {
      console.error("加载数据失败:", e);
      throw e;
    }
  }

  /* 获取列表数据 */
  async function getList() {
    try {
      const [
        itemRes,
        deviceRes,
        comboRes,
        configRes,
        channelConfigRes,
        thresholdRes,
        curveThresholdRes,
      ] = await Promise.all([
        fetchConfig(deviceId.value, combinationId.value),
        fetchDevice(deviceId.value),
        fetchCombination(combinationId.value),
        fetchConfigList(configId.value),
        fetchChannelConfigs(),
        fetchResistanceThresholds(),
        fetchCurveThresholds(),
        // fetch(HTTP_URL + "/getConfig/" + deviceId + "/" + combinationId.value),
        // fetch(HTTP_URL + "/getDevice/" + deviceId),
        // fetch(HTTP_URL + "/getCombination/" + combinationId.value),
        // fetch(HTTP_URL + "/getConfigList/" + configId.value),
        // fetch(HTTP_URL + "/getChannelConfigs"),
        // fetch(HTTP_URL + "/getResistanceThresholds"),
        // fetch(HTTP_URL + "/getCurveThresholds"),
      ]);

      itemConfig.value = await itemRes.json();

      if (itemConfig.value.length > 0) {
        active.value = itemConfig.value.filter(
          (v) => v.id === configId.value,
        )[0].id;
      }

      const deviceData = await deviceRes.json();
      device.value.name = deviceData.name || "";

      const comboData = await comboRes.json();
      combinationName.value = comboData.name || "";
      deviceType.value = comboData.deviceType || "";
      // ws.send({ type: "setDeviceType", deviceType: deviceType.value });
      const configData = await configRes.json();
      // configActionRelays.value = configData.actionRelays || {};
      contact13Closed.value = configData.contact13Closed || {};
      contact24Closed.value = configData.contact24Closed || {};
      configName.value = configData.name || "";

      channelConfigs.value = await channelConfigRes.json();
      resistanceThresholds.value = await thresholdRes.json();
      curveThresholds.value = await curveThresholdRes.json();
    } catch (e) {
      console.error("加载数据失败:", e);
      throw e;
    }
  }

  return {
    active,
    device,
    combinationName,
    deviceType,
    configName,
    contact13Closed,
    contact24Closed,
    channelConfigs,
    resistanceThresholds,
    curveThresholds,
    itemConfig,
    deviceId,
    combinationId,
    configId,
    codeName,
    routeCloseType,
    getCodeDeviceList,
    getList,
  };
}
