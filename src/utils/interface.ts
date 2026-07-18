export interface WSSTATUS {
  color: string;
  connected: boolean;
  lastTime: string;
  msg: string;
  type: string;
}

export interface ActionRelays {
  DC: string[];
  FC: string[];
  DWBS: string[];
  EJCDDWBS: string[];
  EJCDFWBS: string[];
  FWBS: string[];
  YJCDDWBS: string[];
  YJCDFWBS: string[];
}

export interface TestItem {
  name: string;
  type: string;
  status: boolean | number | string;
  realCheck: boolean;
  relayName: string[];
}

export interface TestRule {
  min: number | null;
  max: number | null;
  tip: string;
  isNormal: boolean; // 是否属于正常区间
}

export interface ChannelTestItem {
  index: number; // 序号
  name: string; // 测量对象
  rules: TestRule[]; // 分段判断规则
}
