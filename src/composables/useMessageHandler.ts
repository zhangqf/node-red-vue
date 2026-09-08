import { WEBSOCKET_URL } from "@/config/config";
import type { UseSocketReturn } from "./useSocket";
import { parseWsData } from "@/utils/utils";
import { onUnmounted, ref, watch } from "vue";

type WsEventHandler = (payload: any) => void;

interface UseMessageHandleOptions {
  ws: UseSocketReturn;
  maxHistory?: number;
}

export function useMessageHandler(options: UseMessageHandleOptions) {
  const { ws, maxHistory = 400 } = options;

  const rawWsMsg = ref("");
  const wsMsgHistory = ref<string[]>([]);

  const eventMap = new Map<string, WsEventHandler>();

  function registerEvent(event: string, handler: WsEventHandler) {
    eventMap.set(event, handler);
  }

  function unregisterEvent(event: string) {
    eventMap.delete(event);
  }

  const handleWsMessage = (raw: string) => {
    rawWsMsg.value = raw;
    wsMsgHistory.value.push(raw);
    if (wsMsgHistory.value.length > maxHistory) {
      wsMsgHistory.value.shift();
    }

    const msg = parseWsData<{
      event: string;
      payload: any;
      sendData: Record<string, string>;
    }>(raw);
    if (msg && msg.sendData.type) {
      const handler = eventMap.get(msg.sendData.type);
      if (handler) {
        handler(msg.sendData);
      }
    }
  };
  const stopWatch = watch(
    () => ws.message.value,
    (newMsg) => {
      handleWsMessage(newMsg);
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stopWatch();
  });

  return {
    rawWsMsg,
    wsMsgHistory,
    registerEvent,
    unregisterEvent,
    handleWsMessage,
  };
}
