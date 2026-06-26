import { useMQTT } from "mqtt-vue-hook";

import { onMounted, onUnmounted } from "vue";

import { MQTT_URL } from "@/config/config";

type QoS = 0 | 1 | 2;

export function useMqttClient(vmKey: string) {
  const mqtt = useMQTT();

  const connect = () => {
    mqtt.connect(MQTT_URL, {
      clientId: `vue_mqtt_${Math.random().toString().slice(2, 10)}`,
      clean: true,
      keepalive: 30,
      reconnectPeriod: 2000,
    });
  };

  const subscribe = (
    topic: string,
    callback: (t: string, msg: string) => void,
  ) => {
    mqtt.registerEvent(topic, callback, vmKey);
  };

  const publish = (
    topic: string,
    data: object | string,
    qos: QoS = 0 as const,
  ) => {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    mqtt.publish(topic, msg, qos);
  };

  onUnmounted(() => {
    mqtt.unRegisterEvent("", vmKey);
  });
  return {
    mqtt,
    connect,
    subscribe,
    publish,
  };
}
