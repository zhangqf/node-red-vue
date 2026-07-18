import { StartBeforeTestConfig, StartBeforeTestResult } from "./config";
import type { TestRule } from "./interface";

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

export const handleCauculate = (data: number, params: number) => {
  return data / params;
};

// 公共解析函数
export const parseWsData = (raw: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("WS解析异常", e);
    return null;
  }
};

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

// 单路匹配函数
function getChannelTip(channelRules: TestRule[], val: number) {
  for (const rule of channelRules) {
    // 大于等于超大电阻（无穷大）
    if (rule.min === 10000000 && val >= rule.min) {
      return { tip: rule.tip, isNormal: rule.isNormal };
    }
    // 小于等于0.5
    if (rule.max === 0.5 && val <= rule.max) {
      return { tip: rule.tip, isNormal: rule.isNormal };
    }
    // 区间12~17
    if (
      rule.min === 12 &&
      rule.max === 17 &&
      val >= rule.min &&
      val <= rule.max
    ) {
      return { tip: rule.tip, isNormal: rule.isNormal };
    }
  }
  return { tip: "阻值不在判定区间", isNormal: false };
}

export const startBeforeTestExpress = (
  arr: number[],
  device: keyof typeof StartBeforeTestConfig,
) => {
  let allTrue = true;
  const list = StartBeforeTestResult[device] ?? [];
  const result = arr.map((val, idx) => {
    const channel = list[idx] ?? { name: "", rules: [] };
    const res = getChannelTip(channel.rules, val);
    if (allTrue) {
      allTrue = res.isNormal;
    }
    return {
      channelName: channel.name,
      value: val,
      ...res,
    };
  });

  return { result, allTrue };
};
