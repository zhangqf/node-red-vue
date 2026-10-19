import type { TestItem } from "@/utils/interface";

/**
 * 表示继电器异常的语音播报文案。
 *
 * 触发条件：定位表示与反位表示都不是「通过」，即道岔没有任何有效位置指示。
 * 若其中一个通过，说明位置明确，不打断操作。
 *
 * 两种异常性质不同，需分别播报：
 * - status === false：采到了数据但继电器未吸合 → 播报具体继电器与端子路径；
 * - status === "NT"：本轮采样根本没回来（表示回路未闭合、通讯中断等），
 *   继电器状态未知 → 播报「缺失」。此前这类情况被静默，恰恰漏掉了最需
 *   要提示的场景。
 *
 * 所有表示项共用同一份采样数据（useIndication.handleWsRelayData 一次更新
 * 全部），因此 "NT" 必然成对出现，不存在只有一个缺失的中间态。
 *
 * 播报内容覆盖所有不可用的表示项（含传动、续操等次级项），每项一句；
 * 句内只报未吸合的继电器，避免把正常吸合的也念一遍。
 */

/** 定位/反位表示的 type，用于判定触发条件 */
const GREEN_LIGHT = "GreenLight";
const YELLOW_LIGHT = "YellowLight";

const findItem = (
  items: TestItem[],
  type: string,
): TestItem | undefined => items.find((t) => t.type === type);

/** 继电器未吸合：采到了数据但判定不通过 */
const isFailed = (item?: TestItem): boolean => item?.status === false;

/** 采样缺失：本轮没有收到该表示项的数据 */
const isMissing = (item?: TestItem): boolean => item?.status === "NT";

/** 不可用：未吸合或数据缺失，即 status 不为 true */
const isUnavailable = (item?: TestItem): boolean =>
  !!item && item.status !== true;

/**
 * 取某表示项下未吸合的继电器描述，形如「C1未吸合，D4→21→11-12→42→绕组3」。
 * 已吸合的继电器不播报。
 */
function describeUnclosedRelays(item: TestItem): string {
  const tips = item.relayTips ?? [];
  const failed = tips.filter((t) => !t.closed);
  // 没有 relayTips 时（理论上不该发生），用 relayName 兜底
  const names = failed.length
    ? failed
    : (item.relayName ?? []).map((name) => ({ name, path: "", closed: false }));

  if (!names.length) return "";

  return names
    .map((t) => {
      const path = t.path ? `，${t.path}` : "";
      return `${t.name}未吸合${path}`;
    })
    .join("；");
}

/**
 * 生成播报语句列表。
 *
 * @param testResults 当前表示判定结果
 * @returns 需要播报的句子；不满足触发条件时返回空数组
 */
export function buildExpressAnnouncement(testResults: TestItem[]): string[] {
  const green = findItem(testResults, GREEN_LIGHT);
  const yellow = findItem(testResults, YELLOW_LIGHT);

  // 定位表示与反位表示都不可用才播报：任一通过则位置明确，不打扰操作
  if (!(isUnavailable(green) && isUnavailable(yellow))) return [];

  const failedItems = testResults
    .filter((t) => t.type !== "empty" && isUnavailable(t))
    // 定位表示在前，反位表示紧随其后，其余按原有顺序
    .sort((a, b) => {
      const rank = (t: string) =>
        t === GREEN_LIGHT ? 0 : t === YELLOW_LIGHT ? 1 : 2;
      return rank(a.type) - rank(b.type);
    });

  const sentences: string[] = [];

  for (const item of failedItems) {
    // 采样缺失：无法得知继电器状态，只能报缺失，不能报未吸合
    if (isMissing(item)) {
      sentences.push(`${item.name}缺失`);
      continue;
    }
    const detail = describeUnclosedRelays(item);
    sentences.push(detail ? `${item.name}异常，${detail}` : `${item.name}异常`);
  }

  return sentences;
}