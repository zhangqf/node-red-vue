import type { StepId } from "./flow";

export const buttonTitle: Partial<Record<StepId, string>> = {
  SETUP: "初始化",
  START_BEFORE_TEST: "启动前测试",
  POWER_ON: "开启动作电源",
};

export const buttonTips: Partial<Record<StepId, string>> = {
  SETUP: "正在初始化...",
  START_BEFORE_TEST: "正在启动前测试...",
  POWER_ON: "正在开启动作电源...",
};
