import { ref, onUnmounted } from "vue";

export function useSocket(url: string) {
  let socket: WebSocket | null = null;
  const status = ref("未连接");
  const message = ref("");
  let isManualClose = false; // 标记是否是手动关闭连接

  // 建立连接
  const connect = () => {
    socket = new WebSocket(url);

    socket.onopen = () => (status.value = "已连接");

    socket.onmessage = (e) => {
      message.value = e.data;
    };

    socket.onerror = () => (status.value = "异常");

    socket.onclose = () => {
      status.value = "断开";
      // 简单重连
      if (!isManualClose) {
        setTimeout(connect, 2000);
      }
    };
  };

  // 发送数据
  const send = (data: string | object) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const sendData = typeof data === "string" ? data : JSON.stringify(data);
      socket.send(sendData);
    }
  };

  // 关闭
  const close = () => {
    isManualClose = true; // 标记为手动关闭
    socket?.close();
  };

  // 关键：组件卸载自动执行关闭
  onUnmounted(() => {
    close();
  });

  return {
    status,
    message,
    connect,
    send,
    close,
  };
}

export type UseSocketReturn = ReturnType<typeof useSocket>;
