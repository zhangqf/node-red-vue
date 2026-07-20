import { ref } from "vue";
import type { ActionRelays } from "./interface";

// 配置映射：名称、type、对应继电器数组字段
export const relayConfigList = [
  {
    name: "定位表示",
    type: "GreenLight",
    field: "DWBS" as const,
  },
  {
    name: "反位表示",
    type: "YellowLight",
    field: "FWBS" as const,
  },
  {
    name: "二级传动反位",
    type: "SecondaryTransmissionInReversePosition",
    field: "EJCDFWBS" as const,
  },
  {
    name: "二级传动定位",
    type: "SecondaryTransmissionPositioning",
    field: "EJCDDWBS" as const,
  },
  {
    name: "一级传动反位",
    type: "PrimaryTransmissionInReversePosition",
    field: "YJCDFWBS" as const,
  },
  {
    name: "一级传动定位",
    type: "PrimaryTransmissionPositioning",
    field: "YJCDDWBS" as const,
  },
];

export const StartPowerConfig = {
  ZD6: [31, 30],
  ZD9: [31, 30],
  ZYJ7: [29, 30, 31],
  ZDJ9: [29, 30, 31],
};

export const StartBeforeTestConfig = {
  ZD6: [19, 20, 21, 22, 23],
  ZD9: [19, 20, 21, 22, 23],
  ZYJ7: [15, 16, 17, 18, 19, 23, 24, 25, 26, 27],
  ZDJ9: [15, 16, 17, 18, 19, 23, 24, 25, 26, 27],
};

export const contact13Closed = ref<ActionRelays>({
  DC: [],
  FC: [],
  DWBS: [],
  EJCDDWBS: [],
  EJCDFWBS: [],
  FWBS: [],
  YJCDDWBS: [],
  YJCDFWBS: [],
});
export const contact24Closed = ref<ActionRelays>({
  DC: [],
  FC: [],
  DWBS: [],
  EJCDDWBS: [],
  EJCDFWBS: [],
  FWBS: [],
  YJCDDWBS: [],
  YJCDFWBS: [],
});

// ===== 4路阻值合并配置 =====
// dcExpect / fcExpect: 该方向时期望的阻值状态
// shortTip: 混线(<0.5Ω)时的故障提示
// openFaultTip: 期望NORMAL但实际OPEN时的断线故障提示
export interface ChannelExpect {
  name: string;
  dcExpect: "NORMAL" | "OPEN";
  fcExpect: "NORMAL" | "OPEN";
  shortTip: string;
  openFaultTip: string;
}

export const CHANNEL_CONFIG: ChannelExpect[] = [
  {
    name: "第1路",
    dcExpect: "NORMAL",
    fcExpect: "OPEN",
    shortTip: "D1D2混线",
    openFaultTip: "D1至绕组1断线或D2至绕组2断线",
  },
  {
    name: "第2路",
    dcExpect: "OPEN",
    fcExpect: "NORMAL",
    shortTip: "D1D3混线",
    openFaultTip: "D1至绕组1断线或D3至绕组2断线",
  },
  {
    name: "第3路",
    dcExpect: "OPEN",
    fcExpect: "NORMAL",
    shortTip: "D1D4混线",
    openFaultTip: "D1至绕组1断线或D4至绕组3断线",
  },
  {
    name: "第4路",
    dcExpect: "NORMAL",
    fcExpect: "OPEN",
    shortTip: "D1D5混线",
    openFaultTip: "D1至绕组1断线或D5至绕组3断线",
  },
];
export interface ChannelResult {
  channelName: string;
  value: number;
  state: ResistanceState;
  tip: string;
  isNormal: boolean;
}

export interface DirectionResult {
  DC: boolean;
  FC: boolean;
  diagnosis: string[];
}

export interface StartBeforeTestReturn {
  dcResult: ChannelResult[];
  fcResult: ChannelResult[];
  allTrue: boolean;
  direction: DirectionResult;
}

// ===== 启动前测试：4路阻值方向判定 =====
export type ResistanceState = "NORMAL" | "OPEN" | "SHORT" | "UNKNOWN";
