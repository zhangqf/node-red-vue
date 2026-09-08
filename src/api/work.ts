import { HTTP_URL, WEBSOCKET_URL } from "@/config/config";

export const fetchConfig = (deviceId: string, combinationId: string) => {
  return fetch(HTTP_URL + "/getConfig/" + deviceId + "/" + combinationId);
};

export const fetchDevice = (deviceId: string) => {
  return fetch(HTTP_URL + "/getDevice/" + deviceId);
};

export const fetchCombination = (combinationId: string) => {
  return fetch(HTTP_URL + "/getCombination/" + combinationId);
};

export const fetchConfigList = (configId: string) => {
  return fetch(HTTP_URL + "/getConfigList/" + configId);
};

export const fetchChannelConfigs = () => {
  return fetch(HTTP_URL + "/getChannelConfigs");
};

export const fetchResistanceThresholds = () => {
  return fetch(HTTP_URL + "/getResistanceThresholds");
};

export const fetchCurveThresholds = () => {
  return fetch(HTTP_URL + "/getCurveThresholds");
};
