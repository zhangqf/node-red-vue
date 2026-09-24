import { ref } from "vue";
import type { useTestFlow } from "./useTestFlow";
import { useToast } from "./useToast";
const { withLoading, showToast } = useToast();
type TestFlow = ReturnType<typeof useTestFlow>;

let loading = ref(false);
let loadingText = ref("等待响应中...");
let msgError = ref(false);
let msgErrorText = ref("");

const resetLoading = () => {
  ((loading.value = false), (loadingText.value = "等待响应中..."));
};

// 选型
const handleCheckType = (flow: TestFlow, ws: any, device: string) => {
  loading.value = true;
  msgError.value = false;
  flow
    .sendCommand(
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
    )
    .then((ok) => {
      console.log(1111111111111);
      if (!ok) {
        showToast("初始化端子状态指令未确认，请重试", "error");
        msgErrorText.value = "初始化端子状态指令未确认，请重新初始化";
        msgError.value = true;
        loading.value = false;
      } else {
        flow.pass();
        loading.value = false;
      }
    });
};

/** 线圈写入/读回所在 unitId，与 flows.json 的 deviceType 推导一致 */
export const coilUnitId = (deviceType: string) =>
  deviceType === "ZD6" || deviceType === "ZD9" ? 1 : 2;

export function useButton(flow: TestFlow) {
  return {
    loading,
    loadingText,
    msgError,
    msgErrorText,
    handleCheckType: (ws: any, device: string) => {
      resetLoading();
      handleCheckType(flow, ws, device);
    },
    coilUnitId,
  };
}
