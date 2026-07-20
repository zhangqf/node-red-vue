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

