/**
 * 测试流程状态机步骤定义（纯配置，可读可扩展）
 *
 * 业务流：
 *   SETUP（选闭合方式/加载配置）
 *   → START_BEFORE_TEST（启动前测试，电阻与表示判定）
 *   → READY（待操作）
 *   → OPERATING（定操/反操动作中）
 */

export type StepId =
  | "SETUP"
  | "START_BEFORE_TEST"
  | "READY"
  | "OPERATING";

export interface Step {
  id: StepId;
  /** 本步判定合格后跳转的下一步 */
  onPass: StepId;
  /** 本步判定不合格后跳转的目标步骤（需求：跳转到指定操作） */
  onFail?: StepId;
}

export const STEP_TABLE: Record<StepId, Step> = {
  SETUP: { id: "SETUP", onPass: "START_BEFORE_TEST" },
  START_BEFORE_TEST: {
    id: "START_BEFORE_TEST",
    onPass: "READY",
    onFail: "START_BEFORE_TEST",
  },

  READY: { id: "READY", onPass: "OPERATING" },
  OPERATING: {
    id: "OPERATING",
    onPass: "READY",
    // 操动判定不合格 → 跳回启动前测试重新来
    onFail: "START_BEFORE_TEST",
  },
};
