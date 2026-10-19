import type { TestItem } from "@/utils/interface";

/**
 * 表示继电器异常的语音播报文案。
 *
 * 仅在「定位表示与反位表示同时未通过」时播报——此时道岔没有任何有效
 * 位置指示，操作员必须介入处理。若其中一个通过，说明道岔仍有确定位置，
 * 不打断操作。
 *
 * 播报内容覆盖所有未通过的表示项（含传动、续操等次级项），每项一句，
 * 句内只报未吸合的继电器，避免把正常吸合的也念一遍。
 */

/** 定位/反位表示的 type，用于判定触发条件 */
const GREEN_LIGHT = "GreenLight";
const YELLOW_LIGHT = "YellowLight";

const findItem = (
  items: TestItem[],
  type: string,
): TestItem | undefined => items.find((t) => t.type === type);

/** 某表示项是否未通过（status 为 true 或尚未判定 "NT" 都不算失败） */
const isFailed = (item?: TestItem): boolean => item?.status === false;

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

  // 只有定位表示与反位表示同时未通过才播报
  if (!(isFailed(green) && isFailed(yellow))) return [];

  const failedItems = testResults
    .filter((t) => t.type !== "empty" && isFailed(t))
    // 定位表示在前，反位表示紧随其后，其余按原有顺序
    .sort((a, b) => {
      const rank = (t: string) =>
        t === GREEN_LIGHT ? 0 : t === YELLOW_LIGHT ? 1 : 2;
      return rank(a.type) - rank(b.type);
    });

  const sentences: string[] = [];

  for (const item of failedItems) {
    const detail = describeUnclosedRelays(item);
    sentences.push(detail ? `${item.name}异常，${detail}` : `${item.name}异常`);
  }

  return sentences;
}