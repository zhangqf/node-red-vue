import { ref } from "vue";
import type { useTestFlow } from "./useTestFlow";
import { useToast } from "./useToast";
const { withLoading, showToast } = useToast();
type TestFlow = ReturnType<typeof useTestFlow>;

/** 线圈写入/读回所在 unitId，与 flows.json 的 deviceType 推导一致 */
export const coilUnitId = (deviceType: string) =>
  deviceType === "ZD6" || deviceType === "ZD9" ? 1 : 2;

// 选型
export async function rawHandleCheckType(
  flow: TestFlow,
  ws: any,
  device: string,
  onLoading: (v: boolean) => void,
  onError: (flag: boolean, text: string) => void,
) {
  onLoading(true);
  onError(false, "");
  try {
    const ok = await flow.sendCommand(
      "relays",
      {
        value: ws,
        deviceType: device,
      },
      {
        label: "初始化端子状态",
        expect: {
          unitId: coilUnitId(device),
          value: ws ?? [],
        },
      },
    );
    if (!ok) {
      showToast("初始化端子状态指令未确认，请重试", "error");
      onError(true, "初始化端子状态指令未确认，请重新初始化");
    } else {
      flow.pass();
    }
  } finally {
    onLoading(false);
  }
}

export function useButton(flow: TestFlow) {
  let loading = ref(false);
  let loadingText = ref("等待响应中...");
  let msgError = ref(false);
  let msgErrorText = ref("");

  const resetLoading = () => {
    loading.value = false;
    loadingText.value = "等待响应中...";
    msgError.value = false;
    msgErrorText.value = "";
  };

  const handleCheckType = async (ws: any, device: string) => {
    resetLoading();
    if (!flow) return;
    await rawHandleCheckType(
      flow,
      ws,
      device,
      (v) => (loading.value = v),
      (flag, text) => {
        msgError.value = flag;
        msgErrorText.value = text;
      },
    );
  };

  return {
    loading,
    loadingText,
    msgError,
    msgErrorText,
    handleCheckType,
    coilUnitId,
  };
}
