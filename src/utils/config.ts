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
  {
    name: "反操B项",
    type: "FCBX",
    field: "FCB" as const,
  },
  {
    name: "反操C项",
    type: "FCCX",
    field: "FCC" as const,
  },
  {
    name: "定操B项",
    type: "DCBX",
    field: "DCB" as const,
  },
  {
    name: "定操C项",
    type: "DCCX",
    field: "DCC" as const,
  },
];

export const StartPowerConfig = {
  ZD6: [31, 30],
  ZD9: [31, 30],
  ZYJ7: [29, 30, 31],
  ZDJ9: [29, 30, 31],
};

export const StartBeforeTestConfig = {
  ZD6: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  ZD9: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  ZYJ7: [13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27],
  ZDJ9: [13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27],
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
  DCB: [],
  FCB: [],
  DCC: [],
  FCC: [],
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
  DCB: [],
  FCB: [],
  DCC: [],
  FCC: [],
});

// ===== 4路阻值合并配置 =====
// dcExpect / fcExpect: 该方向时期望的阻值状态
// dcShortTip / fcShortTip: 定操/反操方向下混线(<0.5Ω)时的故障提示
// openFaultTip: 期望NORMAL但实际OPEN时的断线故障提示
// circuitField: 关联的回路图 field，用于未通过时查看电路图
export interface ChannelExpect {
  name: string;
  dcExpect: "NORMAL" | "OPEN";
  fcExpect: "NORMAL" | "OPEN";
  dcShortTip: string;
  fcShortTip: string;
  openFaultTip: string;
  circuitField: string;
}

export const CHANNEL_CONFIG: ChannelExpect[] = [
  {
    name: "第3路",
    dcExpect: "NORMAL",
    fcExpect: "OPEN",
    dcShortTip: "D1D2混线",
    fcShortTip: "D1D2混线",
    openFaultTip: "D1至绕组1断线或D2至绕组2断线",
    circuitField: "DWBS",
  },
  {
    name: "第4路",
    dcExpect: "OPEN",
    fcExpect: "NORMAL",
    dcShortTip: "D1D3混线",
    fcShortTip: "D1D3混线",
    openFaultTip: "D1至绕组1断线或D3至绕组2断线",
    circuitField: "FWBS",
  },
  {
    name: "第5路",
    dcExpect: "OPEN",
    fcExpect: "NORMAL",
    dcShortTip: "D1D4混线",
    fcShortTip: "D1D4混线",
    openFaultTip: "D1至绕组1断线或D4至绕组3断线",
    circuitField: "FWBS",
  },
  {
    name: "第6路",
    dcExpect: "NORMAL",
    fcExpect: "OPEN",
    dcShortTip: "D1D5混线",
    fcShortTip: "D1D5混线",
    openFaultTip: "D1至绕组1断线或D5至绕组3断线",
    circuitField: "DWBS",
  },
];

export const CHANNEL_CONFIGZD6: ChannelExpect[] = [
  {
    name: "第7路",
    dcExpect: "NORMAL",
    fcExpect: "OPEN",
    dcShortTip: "D1D5混线",
    fcShortTip: "D1D2混线",
    openFaultTip: "D1至绕组1或D5至绕4组断线",
    circuitField: "DWBS",
  },
  {
    name: "第8路IE",
    dcExpect: "OPEN",
    fcExpect: "NORMAL",
    dcShortTip: "D1D2混线",
    fcShortTip: "D2D5混线",
    openFaultTip: "D2至绕组2或D5至绕4组断线",
    circuitField: "FWBS",
  },
];

export interface ChannelResult {
  channelName: string;
  value: number;
  state: ResistanceState;
  tip: string;
  isNormal: boolean;
  circuitField: string;
  circuitImg?: string;
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

/* 

单：1
双：2
动：3
机：4

*/

export enum ZD6Serial {
  "双动双机" = 2324,
  "单动单机" = 1314,
  "单动双机" = 1324,
  "单-单-单-单" = 1111,
  "双-单-双-单" = 2121,
  "单-单-双" = 112,
  "双-单-单" = 211,
  "双-单-双" = 212,
  "双-单-单-单" = 2111,
  "ZDJ9双机" = "ZDJ9SJ",
  "ZDJ9五机" = "ZDJ9WJ",
  "ZDJ9全机" = "ZDJ9QJ",
  "ZYJ7+SH6双机" = "ZYJ7SH6SJ",
  "ZYJ7单机" = "ZYJ7DJ",
  "ZYJ7全主机" = "ZYJ7QZJ",
  "ZYJ7+SH6五机" = "ZYJ7SH6WJ",
}

/* 
一：10
二：20
*/
export const ModelConfig = {
  一动A机: "103A4",
  一动E机: "103A4",
  一动B机: "103B4",
  一动J机: "103B4",
  二动A机: "203A4",
  二动E机: "203A4",
  二动B机: "203B4",
  二动J机: "203B4",
  单动单机: "1314",
  单动A机: "13A4",
  单动B机: "13B4",
  一动单机: "10314",
  二动单机: "20314",
  三动单机: "30314",
  四动单机: "40314",
  三动A机: "303A4",
  三动B机: "303B4",
  ZDJ9: "ZDJ9",
  ZYJ7: "ZYJ7",
  SH6: "SH6",
} as const;

// 图片生成函数
function getImgZD6(model: string, type: "DW" | "FW" | "DWC" | "FWC") {
  const prefix = model.includes("A") ? "ZD6E-A" : "ZD6J-B";
  return `./img/${prefix}-${type}.png`;
}
function getImgZDJ9(type: "DW" | "FW") {
  const prefix = "ZDJ9";
  return `./img/${prefix}-${type}.png`;
}
function getImgZYJ7(type: "DW" | "FW" | "FCB" | "FCC" | "DCB" | "DCC") {
  const prefix = "ZYJ7";
  return `./img/${prefix}-${type}.png`;
}

const generaZDJ9config = () => {
  return {
    img: {
      DWBS: getImgZDJ9("DW"),
      FWBS: getImgZDJ9("FW"),
    },
    C9: "D2→33-34→15-16→D7",
    C10: "D4→11-12→绕组3→绕组2→35-36→D12",
    C11: "D3→23-24→45-46→D8",
    C12: "D5→41-42→绕组3→绕组2→25-26→D11",
  };
};

export const collectConfig = {
  ZYJ7: {
    ZYJ7SH6SJ: {
      ZYJ7: {
        img: {
          DWBS: getImgZYJ7("DW"),
          FWBS: getImgZYJ7("FW"),
          FCB: getImgZYJ7("FCB"),
          FCC: getImgZYJ7("FCC"),
          DCB: getImgZYJ7("DCB"),
          DCC: getImgZYJ7("DCC"),
        },
        C9: "D2→43→33-34→15-16→D7",
        C10: "D4→21→11-12→42→绕组3→绕组2→35-36→D12",
        C11: "D3→23-24→45-46→D8",
        C12: "D5→41-42→绕组3→绕组2→35→25-26→D11",
        C13: "D4→21-22→D9",
        C14: "D5→41→31-32→D10",
        C15: "D6→12→42→绕组3",
        C16: "D13→44→14→K1-K2→25→35→绕组2",
      },
      SH6: {
        img: {
          DWBS: getImgZYJ7("DW"),
          FWBS: getImgZYJ7("FW"),
          FCB: getImgZYJ7("FCB"),
          FCC: getImgZYJ7("FCC"),
          DCB: getImgZYJ7("DCB"),
          DCC: getImgZYJ7("DCC"),
        },
        C9: "D7→43→33-34→15-16→25→D2",
        C10: "D12→36-35→46→D1",
        C11: "D8→23-24→45-46→D1",
        C12: "D11→26-25→D2",
        C13: "D9→21→11-12→42→D6",
        C14: "D10→41-42→D6",
      },
    },
    ZYJ7DJ: {
      ZYJ7: {
        img: {
          DWBS: getImgZYJ7("DW"),
          FWBS: getImgZYJ7("FW"),
          FCB: getImgZYJ7("FCB"),
          FCC: getImgZYJ7("FCC"),
          DCB: getImgZYJ7("DCB"),
          DCC: getImgZYJ7("DCC"),
        },
        C9: "D2→43→33-34→15-16→D7",
        C10: "D4→21→11-12→42→绕组3→绕组2→35-36→D12",
        C11: "D3→23-24→45-46→D8",
        C12: "D5→41-42→绕组3→绕组2→35→25-26→D11",
        C13: "D4→21-22→D9",
        C14: "D5→41→31-32→D10",
        C15: "D6→12→42→绕组3",
        C16: "D13→44→14→K1-K2→25→35→绕组2",
      },
      SH6: {
        img: {
          DWBS: getImgZYJ7("DW"),
          FWBS: getImgZYJ7("FW"),
          FCB: getImgZYJ7("FCB"),
          FCC: getImgZYJ7("FCC"),
          DCB: getImgZYJ7("DCB"),
          DCC: getImgZYJ7("DCC"),
        },
        C9: "D7→43→33-34→15-16→25→D2",
        C10: "D12→36-35→46→D1",
        C11: "D8→23-24→45-46→D1",
        C12: "D11→26-25→D2",
        C13: "D9→21→11-12→42→D6",
        C14: "D10→41-42→D6",
      },
    },
    ZYJ7QZJ: {
      ZYJ7: {
        img: {
          DWBS: getImgZYJ7("DW"),
          FWBS: getImgZYJ7("FW"),
          FCB: getImgZYJ7("FCB"),
          FCC: getImgZYJ7("FCC"),
          DCB: getImgZYJ7("DCB"),
          DCC: getImgZYJ7("DCC"),
        },
        C9: "D2→43→33-34→15-16→D7",
        C10: "D4→21→11-12→42→绕组3→绕组2→35-36→D12",
        C11: "D3→23-24→45-46→D8",
        C12: "D5→41-42→绕组3→绕组2→35→25-26→D11",
        C13: "D4→21-22→D9",
        C14: "D5→41→31-32→D10",
        C15: "D6→12→42→绕组3",
        C16: "D13→44→14→K1-K2→25→35→绕组2",
      },
      SH6: {
        img: {
          DWBS: getImgZYJ7("DW"),
          FWBS: getImgZYJ7("FW"),
          FCB: getImgZYJ7("FCB"),
          FCC: getImgZYJ7("FCC"),
          DCB: getImgZYJ7("DCB"),
          DCC: getImgZYJ7("DCC"),
        },
        C9: "D7→43→33-34→15-16→25→D2",
        C10: "D12→36-35→46→D1",
        C11: "D8→23-24→45-46→D1",
        C12: "D11→26-25→D2",
        C13: "D9→21→11-12→42→D6",
        C14: "D10→41-42→D6",
      },
    },
    ZYJ7SH6WJ: {
      ZYJ7: {
        img: {
          DWBS: getImgZYJ7("DW"),
          FWBS: getImgZYJ7("FW"),
          FCB: getImgZYJ7("FCB"),
          FCC: getImgZYJ7("FCC"),
          DCB: getImgZYJ7("DCB"),
          DCC: getImgZYJ7("DCC"),
        },
        C9: "D2→43→33-34→15-16→D7",
        C10: "D4→21→11-12→42→绕组3→绕组2→35-36→D12",
        C11: "D3→23-24→45-46→D8",
        C12: "D5→41-42→绕组3→绕组2→35→25-26→D11",
        C13: "D4→21-22→D9",
        C14: "D5→41→31-32→D10",
        C15: "D6→12→42→绕组3",
        C16: "D13→44→14→K1-K2→25→35→绕组2",
      },
      SH6: {
        img: {
          DWBS: getImgZYJ7("DW"),
          FWBS: getImgZYJ7("FW"),
          FCB: getImgZYJ7("FCB"),
          FCC: getImgZYJ7("FCC"),
          DCB: getImgZYJ7("DCB"),
          DCC: getImgZYJ7("DCC"),
        },
        C9: "D7→43→33-34→15-16→25→D2",
        C10: "D12→36-35→46→D1",
        C11: "D8→23-24→45-46→D1",
        C12: "D11→26-25→D2",
        C13: "D9→21→11-12→42→D6",
        C14: "D10→41-42→D6",
      },
    },
  },
  ZDJ9: {
    ZDJ9SJ: {
      ZDJ9: generaZDJ9config(),
    },
    ZDJ9QJ: {
      ZDJ9: generaZDJ9config(),
    },
    ZDJ9WJ: {
      ZDJ9: generaZDJ9config(),
    },
  },
  ZD6: {
    // 双动双击
    2324: {
      "103A4": {
        img: {
          DWBS: getImgZD6("A", "DW"),
          FWBS: getImgZD6("A", "FW"),
          YJCDDWBS: getImgZD6("A", "DWC"),
          YJCDFWBS: getImgZD6("A", "FWC"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
        C5: "D13→35-36→D15",
        C6: "D14→25-26→D16",
      },
      "103B4": {
        img: {
          DWBS: getImgZD6("B", "DW"),
          FWBS: getImgZD6("B", "FW"),
          YJCDDWBS: getImgZD6("B", "DWC"),
          YJCDFWBS: getImgZD6("B", "FWC"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
        C5: "D15→35-36→D17",
        C6: "D16→25-26→D18",
      },
      "203A4": {
        img: {
          YJCDDWBS: getImgZD6("C", "DW"),
          YJCDFWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "203B4": {
        img: {
          YJCDDWBS: getImgZD6("D", "DW"),
          YJCDFWBS: getImgZD6("D", "FW"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
      },
    },
    // 单动单机
    1314: {
      "1314": {
        img: {
          YJCDDWBS: getImgZD6("C", "DW"),
          YJCDFWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
    },
    // 单动双机
    1324: {
      "13A4": {
        img: {
          YJCDDWBS: getImgZD6("C", "DW"),
          YJCDFWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "13B4": {
        img: {
          YJCDDWBS: getImgZD6("D", "DW"),
          YJCDFWBS: getImgZD6("D", "FW"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
      },
    },
    //单-单-单-单
    1111: {
      10314: {
        img: {
          YJCDDWBS: getImgZD6("C", "DW"),
          YJCDFWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      20314: {
        img: {
          YJCDDWBS: getImgZD6("C", "DW"),
          YJCDFWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      30314: {
        img: {
          YJCDDWBS: getImgZD6("C", "DW"),
          YJCDFWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      40314: {
        img: {
          YJCDDWBS: getImgZD6("C", "DW"),
          YJCDFWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
    },
    //双-单-双-单
    2121: {
      "103A4": {
        img: {
          DWBS: getImgZD6("A", "DW"),
          FWBS: getImgZD6("A", "FW"),
          YJCDDWBS: getImgZD6("A", "DWC"),
          YJCDFWBS: getImgZD6("A", "FWC"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
        C5: "D13→35-36→D15",
        C6: "D14→25-26→D16",
      },
      "103B4": {
        img: {
          DWBS: getImgZD6("B", "DW"),
          FWBS: getImgZD6("B", "FW"),
          YJCDDWBS: getImgZD6("B", "DWC"),
          YJCDFWBS: getImgZD6("B", "FWC"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
        C5: "D15→35-36→D17",
        C6: "D16→25-26→D18",
      },
      "20314": {
        img: {
          DWBS: getImgZD6("A", "DW"),
          FWBS: getImgZD6("A", "FW"),
          YJCDDWBS: getImgZD6("A", "DWC"),
          YJCDFWBS: getImgZD6("A", "FWC"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
        C5: "D13→35-36→D15",
        C6: "D14→25-26→D16",
      },
      "303A4": {
        img: {
          YJCDDWBS: getImgZD6("C", "DW"),
          YJCDFWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "303B4": {
        img: {
          YJCDDWBS: getImgZD6("D", "DW"),
          YJCDFWBS: getImgZD6("D", "FW"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
      },
      "40314": {
        img: {
          YJCDDWBS: getImgZD6("C", "DW"),
          YJCDFWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
    },
    // 单-单-双
    112: {
      "10314": {
        img: {
          DWBS: getImgZD6("A", "DW"),
          FWBS: getImgZD6("A", "FW"),
          YJCDDWBS: getImgZD6("A", "DWC"),
          YJCDFWBS: getImgZD6("A", "FWC"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
        C5: "D13→35-36→D15",
        C6: "D14→25-26→D16",
      },
      "20314": {
        img: {
          DWBS: getImgZD6("A", "DW"),
          FWBS: getImgZD6("A", "FW"),
          YJCDDWBS: getImgZD6("A", "DWC"),
          YJCDFWBS: getImgZD6("A", "FWC"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
        C5: "D13→35-36→D15",
        C6: "D14→25-26→D16",
      },
      "303A4": {
        img: {
          DWBS: getImgZD6("C", "DW"),
          FWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "303B4": {
        img: {
          DWBS: getImgZD6("D", "DW"),
          FWBS: getImgZD6("D", "FW"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
      },
    },
    // 双-单-单
    211: {
      "103A4": {
        img: {
          DWBS: getImgZD6("C", "DW"),
          FWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "103B4": {
        img: {
          DWBS: getImgZD6("D", "DW"),
          FWBS: getImgZD6("D", "FW"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
      },
      "20314": {
        img: {
          DWBS: getImgZD6("C", "DW"),
          FWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "30314": {
        img: {
          DWBS: getImgZD6("C", "DW"),
          FWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
    },
    // 双-单-双
    212: {
      "103A4": {
        img: {
          DWBS: getImgZD6("A", "DW"),
          FWBS: getImgZD6("A", "FW"),
          YJCDDWBS: getImgZD6("A", "DWC"),
          YJCDFWBS: getImgZD6("A", "FWC"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
        C5: "D13→35-36→D15",
        C6: "D14→25-26→D16",
      },
      "103B4": {
        img: {
          DWBS: getImgZD6("B", "DW"),
          FWBS: getImgZD6("B", "FW"),
          YJCDDWBS: getImgZD6("B", "DWC"),
          YJCDFWBS: getImgZD6("B", "FWC"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
        C5: "D15→35-36→D17",
        C6: "D16→25-26→D18",
      },
      "20314": {
        img: {
          DWBS: getImgZD6("A", "DW"),
          FWBS: getImgZD6("A", "FW"),
          YJCDDWBS: getImgZD6("A", "DWC"),
          YJCDFWBS: getImgZD6("A", "FWC"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
        C5: "D13→35-36→D15",
        C6: "D14→25-26→D16",
      },
      "303A4": {
        img: {
          DWBS: getImgZD6("C", "DW"),
          FWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "303B4": {
        img: {
          DWBS: getImgZD6("D", "DW"),
          FWBS: getImgZD6("D", "FW"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
      },
    },
    // 双-单-单-单
    2111: {
      "103A4": {
        img: {
          DWBS: getImgZD6("C", "DW"),
          FWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "103B4": {
        img: {
          DWBS: getImgZD6("D", "DW"),
          FWBS: getImgZD6("D", "FW"),
        },
        C1: "D13→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D14→21-22→D8",
        C4: "D4→44-43→02-01→24-23→D10",
      },
      "20314": {
        img: {
          DWBS: getImgZD6("C", "DW"),
          FWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "30314": {
        img: {
          DWBS: getImgZD6("C", "DW"),
          FWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
      "40314": {
        img: {
          DWBS: getImgZD6("C", "DW"),
          FWBS: getImgZD6("C", "FW"),
        },
        C1: "D1→41→31-32→D7",
        C2: "D3→04-03→14-13→34-33→D9",
        C3: "D2→11→21-22→D8",
        C4: "D3→D4→44-43→02-01→24-23→D10",
      },
    },
  },
};
