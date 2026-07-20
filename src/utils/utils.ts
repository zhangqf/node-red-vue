import { StartBeforeTestConfig, CHANNEL_CONFIG } from "./config";
import type {
  ChannelExpect,
  ResistanceState,
  StartBeforeTestReturn,
  ChannelResult,
} from "./config";

/**
 * @description 生成长度固定32位的二进制数字数组，默认填充0
 * 两种方式置1：1. bitArr 按下标顺序赋值；2. indexList 指定下标强制置1
 * @param bitArr 二进制位数组，数组下标对应32位数组下标，值为1则对应位置1，不传默认为空数组
 * @param indexList 需要强制置1的下标集合，下标范围0~31，超出范围自动忽略，不传默认为空数组
 * @returns number[] 长度32的二进制数组，元素仅为0/1
 */
export const gen32BitArray = (
  bitArr: number[] = [],
  indexList: number[] = [],
): number[] => {
  const result = new Array(32).fill(0);
  for (let i = 0; i < bitArr.length; i++) {
    if (bitArr[i] === 1) {
      result[i] = 1;
    }
  }
  indexList.forEach((idx) => {
    if (idx >= 0 && idx < 32) {
      result[idx] = 1;
    }
  });

  return result;
};

/**
 * @description 数值除法计算，除数为0返回0避免无穷值
 * @param data 被除数
 * @param params 除数
 * @returns number 两数相除结果
 */
export const handleCalculate = (data: number, params: number) => {
  if (params === 0) return 0;
  return data / params;
};

/**
 * @description 解析WebSocket原始字符串数据，捕获JSON解析异常
 * @param raw websocket原始文本，可为null/空字符串
 * @returns 解析后的泛型对象 | null，解析失败/无数据返回null
 */
export const parseWsData = <T = any>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("WebSocket JSON解析失败，原始数据：", raw, err);
    return null;
  }
};

/**
 * @description 根据继电器名称列表，匹配采样排序下标，并校验对应继电器是否全部吸合（值为1）
 * @param expectedData 需要校验的继电器名称数组
 * @param realData 继电器实时状态数值数组，1=吸合，0=未吸合，下标与排序后采样表一一对应
 * @param sampleData 继电器采样配置数组，包含继电器名称、排序序号sort_order
 * @returns { matchIndexes: number[], allClosed: boolean, expectedData: string[] }
 * matchIndexes：匹配到的继电器在排序后realData中的下标集合；
 * allClosed：所有匹配继电器状态是否全部为1（全部吸合）；
 * expectedData：入参原始继电器名称数组
 */

export const findRelayIndex = (
  expectedData: string[],
  realData: number[],
  sampleData: Array<{ relay_name: string; sort_order: number }>,
) => {
  const sortedSample = [...sampleData].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const nameToIndex = new Map<string, number>();
  sortedSample.forEach((item, idx) => nameToIndex.set(item.relay_name, idx));

  const matchIndexes: number[] = [];
  for (const name of expectedData) {
    const idx = nameToIndex.get(name);
    if (idx !== undefined) matchIndexes.push(idx);
  }
  if (matchIndexes.length === 0) {
    return { matchIndexes: [], allClosed: false };
  }
  let allClosed = true;
  for (const idx of matchIndexes) {
    if (realData[idx] !== 1) {
      allClosed = false;
      break;
    }
  }
  return { matchIndexes, allClosed, expectedData };
};

/**
 * @description 对测量电阻值进行状态分类
 * @param val 实测电阻阻值(单位Ω)
 * @returns ResistanceState 状态枚举
 * NORMAL：12~17Ω 绕组正常区间
 * OPEN：≥10000000Ω 断线/无穷大
 * SHORT：≤0.5Ω 混线短路
 * UNKNOWN：不在以上区间，阻值异常无法判定
 */
function classifyResistance(val: number): ResistanceState {
  if (val >= 12 && val <= 17) return "NORMAL";
  if (val >= 10000000) return "OPEN";
  if (val <= 0.5) return "SHORT";
  return "UNKNOWN";
}

/**
 * @description 根据电阻实测状态、预期状态生成提示文案与是否正常标记
 * @param state 电阻实测分类状态 NORMAL/OPEN/SHORT/UNKNOWN
 * @param expect 通道预期状态，仅支持 NORMAL 或 OPEN
 * @param cfg 通道配置对象，包含短路提示、开路故障提示文本
 * @returns { tip: string; isNormal: boolean } 提示文字 + 是否判定正常
 * 逻辑分支：
 * 1. 实测短路SHORT：直接返回短路异常提示
 * 2. 阻值无法判定UNKNOWN：统一返回区间异常文案
 * 3. 实测状态与预期一致：判定正常
 * 4. 预期正常但实测开路：返回开路故障提示
 * 5. 预期开路但实测正常：返回“阻值正常但应为开路”异常文案
 */
function getDirectionTip(
  state: ResistanceState,
  expect: "NORMAL" | "OPEN",
  cfg: ChannelExpect,
): { tip: string; isNormal: boolean } {
  if (state === "SHORT") return { tip: cfg.shortTip, isNormal: false };
  if (state === "UNKNOWN") return { tip: "阻值不在判定区间", isNormal: false };
  if (state === expect) return { tip: "正常", isNormal: true };
  // state 与 expect 不匹配
  if (state === "OPEN" /* && expect === "NORMAL" */)
    return { tip: cfg.openFaultTip, isNormal: false };
  // state === "NORMAL" && expect === "OPEN"
  return { tip: "阻值正常但应为开路", isNormal: false };
}

/**
 * @description 道岔启动前电阻检测统一计算入口
 * @param arr 四路通道实测电阻数组 [第1路,第2路,第3路,第4路]
 * @returns StartBeforeTestReturn 定操/反操检测结果、是否合格、故障诊断信息
 * 核心逻辑：
 * 1. 批量将四路阻值转为电阻状态 NORMAL/OPEN/SHORT/UNKNOWN
 * 2. 分别计算【定操DC】、【反操FC】两套判定结果
 * 3. 满足全部通道NORMAL，或单套方向全部合格，则该方向判定通过
 * 4. 定操、反操均不合格时，汇总所有异常通道诊断文案
 * 5. allTrue：定操/反操任意一个方向合格即为整机检测通过
 */

export const startBeforeTestExpress = (
  arr: number[],
): StartBeforeTestReturn => {
  const states = arr.map(classifyResistance);

  const dcResult: ChannelResult[] = CHANNEL_CONFIG.map((cfg, i) => {
    const { tip, isNormal } = getDirectionTip(
      states[i] ?? "UNKNOWN",
      cfg.dcExpect,
      cfg,
    );
    return {
      channelName: cfg.name,
      value: arr[i],
      state: states[i] ?? "UNKNOWN",
      tip,
      isNormal,
    };
  });

  const fcResult: ChannelResult[] = CHANNEL_CONFIG.map((cfg, i) => {
    const { tip, isNormal } = getDirectionTip(
      states[i] ?? "UNKNOWN",
      cfg.fcExpect,
      cfg,
    );
    return {
      channelName: cfg.name,
      value: arr[i],
      state: states[i] ?? "UNKNOWN",
      tip,
      isNormal,
    };
  });

  // 全路12-17Ω → 两种方向均可用
  const allNormal = states.slice(0, 4).every((s) => s === "NORMAL");

  const dcPassed = allNormal || dcResult.every((r) => r.isNormal);
  const fcPassed = allNormal || fcResult.every((r) => r.isNormal);

  const diagnosis: string[] = [];

  if (!dcPassed && !fcPassed) {
    dcResult.forEach((r) => {
      if (!r.isNormal)
        diagnosis.push(`定操-${r.channelName}: ${r.tip}(${r.value}Ω)`);
    });
    fcResult.forEach((r) => {
      if (!r.isNormal)
        diagnosis.push(`反操-${r.channelName}: ${r.tip}(${r.value}Ω)`);
    });
  }

  return {
    dcResult,
    fcResult,
    allTrue: dcPassed || fcPassed,
    direction: { DC: dcPassed, FC: fcPassed, diagnosis },
  };
};

/**
 * @description: 根据继电器的实测状态，判断启动与停止状态
 * @param arr 继电器状态数组
 * @param idxArr 需要判断继电器的下标值
 * @return {*}
 */

export const powerStatusJudgmen = (arr: number[], idxArr: number[]) => {
  console.log(arr);
  console.log(idxArr);
  let allPullIn = true;
  for (const idx of idxArr) {
    if (idx < 0 || idx >= arr.length || arr[idx] !== 1) {
      allPullIn = false;
      break;
    }
  }
  return {
    isRunning: allPullIn,
    desc: allPullIn ? "电源已开启" : "请先开启电源",
  };
};
