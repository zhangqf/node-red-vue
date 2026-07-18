import { ref } from "vue";
import type { ActionRelays, ChannelTestItem, TestRule } from "./interface";

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

// 先抽离公共配置
const ZDJ9ANDZYJ7_RULES: ChannelTestItem[] = [
  {
    index: 0,
    name: "第1路",
    rules: [
      {
        min: 10000000,
        max: null,
        tip: "D1至绕组1断线或D2至绕组2断线",
        isNormal: false,
      },
      { min: null, max: 0.5, tip: "D1D2混线", isNormal: false },
      { min: 12, max: 17, tip: "正常", isNormal: true },
    ],
  },
  {
    index: 1,
    name: "第2路",
    rules: [
      { min: 10000000, max: null, tip: "正常", isNormal: true },
      { min: null, max: 0.5, tip: "D1D3混线", isNormal: false },
    ],
  },
  {
    index: 2,
    name: "第3路",
    rules: [
      { min: 10000000, max: null, tip: "正常", isNormal: true },
      { min: null, max: 0.5, tip: "D1D4混线", isNormal: false },
    ],
  },
  {
    index: 3,
    name: "第4路",
    rules: [
      {
        min: 10000000,
        max: null,
        tip: "D1至绕组1断线或D5至绕组3断线",
        isNormal: false,
      },
      { min: null, max: 0.5, tip: "D1D5混线", isNormal: false },
      { min: 12, max: 17, tip: "正常", isNormal: true },
    ],
  },
];

export const StartBeforeTestResult: Record<string, ChannelTestItem[]> = {
  ZYJ7: ZDJ9ANDZYJ7_RULES,
  ZDJ9: ZDJ9ANDZYJ7_RULES,
};
