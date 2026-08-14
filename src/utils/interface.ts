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
  DCB: string[];
  DCC: string[];
  FCB: string[];
  FCC: string[];
  DWBS: string[];
  EJCDDWBS: string[];
  EJCDFWBS: string[];
  FWBS: string[];
  YJCDDWBS: string[];
  YJCDFWBS: string[];
}

export interface ActionRelaysZYJ7 {
  DC: string[];
  FC: string[];
  DWBS: string[];
  FWBS: string[];
  DCBX: string[];
  DCCX: string[];
  FCBX: string[];
  FCCX: string[];
}

export interface RelayTip {
  name: string;
  path: string;
  closed: boolean;
}

export interface TestItem {
  name: string;
  type: string;
  status: boolean | "NT";
  realCheck: boolean;
  relayName: string[];
  relayTips?: RelayTip[];
}
