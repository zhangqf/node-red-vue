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

// export const ErrorTips: Partial<Record<StepId, string>> = {
//   SETUP: "正在初始化...",
//   START_BEFORE_TEST: "正在启动前测试...",
//   POWER_ON: "正在开启动作电源...",
// };

export const anctionTips: Partial<Record<StepId, string>> = {
  SETUP: "请先点击初始化，即可进行下一步。",
  START_BEFORE_TEST: "请先点击启动前测试，即可进行下一步。",
  POWER_ON: "请先点击开启电源，即可进行下一步。",
};
