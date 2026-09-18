import type { useTestFlow } from "./useTestFlow";
import { useToast } from "./useToast";
const { withLoading, showToast } = useToast();
type TestFlow = ReturnType<typeof useTestFlow>;

// 选型
const handleCheckType = (flow: TestFlow, ws: any, device: string) => {
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
      if (!ok) {
        showToast("初始化端子状态指令未确认，请重试", "error");
      } else {
        flow.pass();
      }
    });
};

/** 线圈写入/读回所在 unitId，与 flows.json 的 deviceType 推导一致 */
const coilUnitId = (deviceType: string) =>
  deviceType === "ZD6" || deviceType === "ZD9" ? 1 : 2;

export function useButton(flow: TestFlow) {
  return {
    handleCheckType: (ws: any, device: string) => {
      handleCheckType(flow, ws, device);
    },
    coilUnitId,
  };
}
