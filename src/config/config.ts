export type RuntimeConfig = {
  mqttUrl?: string;
  websocketUrl?: string;
  httpUrl?: string;
};

export const STORAGE_KEYS = {
  mqttUrl: "SWITCH_MACHINE_MQTT_URL",
  websocketUrl: "SWITCH_MACHINE_WEBSOCKET_URL",
  httpUrl: "SWITCH_MACHINE_HTTP_URL",
} as const;

const currentHost =
  typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";

const buildDefaultConfig = (): Required<RuntimeConfig> => ({
  mqttUrl: `ws://${currentHost}:8083`,
  websocketUrl: `ws://${currentHost}:1880/ws/test`,
  httpUrl: `http://${currentHost}:1880`,
});

const getRuntimeValue = (key: keyof RuntimeConfig, fallback: string) => {
  const runtimeConfig = (
    globalThis as typeof globalThis & {
      SWITCH_MACHINE_CONFIG?: RuntimeConfig;
    }
  ).SWITCH_MACHINE_CONFIG;

  const configValue = runtimeConfig?.[key];
  if (typeof configValue === "string" && configValue.trim()) {
    return configValue.trim();
  }

  if (typeof window !== "undefined") {
    const localValue = window.localStorage.getItem(STORAGE_KEYS[key]);
    if (localValue && localValue.trim()) {
      return localValue.trim();
    }
  }

  return fallback;
};

export const DEFAULT_CONFIG = buildDefaultConfig();

export let MQTT_URL = getRuntimeValue("mqttUrl", DEFAULT_CONFIG.mqttUrl);
export let WEBSOCKET_URL = getRuntimeValue(
  "websocketUrl",
  DEFAULT_CONFIG.websocketUrl,
);
export let HTTP_URL = getRuntimeValue("httpUrl", DEFAULT_CONFIG.httpUrl);

export const syncConfigFromStorage = () => {
  const nextConfig = {
    mqttUrl: getRuntimeValue("mqttUrl", DEFAULT_CONFIG.mqttUrl),
    websocketUrl: getRuntimeValue("websocketUrl", DEFAULT_CONFIG.websocketUrl),
    httpUrl: getRuntimeValue("httpUrl", DEFAULT_CONFIG.httpUrl),
  };

  MQTT_URL = nextConfig.mqttUrl;
  WEBSOCKET_URL = nextConfig.websocketUrl;
  HTTP_URL = nextConfig.httpUrl;

  (
    globalThis as typeof globalThis & { SWITCH_MACHINE_CONFIG?: RuntimeConfig }
  ).SWITCH_MACHINE_CONFIG = nextConfig;
};

export const saveRuntimeConfig = (config: RuntimeConfig) => {
  const validConfig = {
    // mqttUrl: config.mqttUrl?.trim() || DEFAULT_CONFIG.mqttUrl,
    socketUrl: config.websocketUrl?.trim() || DEFAULT_CONFIG.websocketUrl,
    httpUrl: config.httpUrl?.trim() || DEFAULT_CONFIG.httpUrl,
  };

  if (typeof window !== "undefined") {
    // window.localStorage.setItem(STORAGE_KEYS.mqttUrl, validConfig.mqttUrl);
    window.localStorage.setItem(
      STORAGE_KEYS.websocketUrl,
      validConfig.socketUrl,
    );
    window.localStorage.setItem(STORAGE_KEYS.httpUrl, validConfig.httpUrl);
  }

  (
    globalThis as typeof globalThis & { SWITCH_MACHINE_CONFIG?: RuntimeConfig }
  ).SWITCH_MACHINE_CONFIG = validConfig;
  // MQTT_URL = validConfig.mqttUrl;
  WEBSOCKET_URL = validConfig.socketUrl;
  HTTP_URL = validConfig.httpUrl;
};

syncConfigFromStorage();

// 运行时手动覆盖示例：
// window.SWITCH_MACHINE_CONFIG = {
//   mqttUrl: "ws://192.168.1.10:8083",
//   websocketUrl: "ws://192.168.1.10:1880/ws/test",
//   httpUrl: "http://192.168.1.10:1880",
// };
// 或在浏览器控制台里执行：
// localStorage.setItem("SWITCH_MACHINE_HTTP_URL", "http://192.168.1.10:1880");
