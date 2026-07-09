import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import VChart from "vue-echarts";
import * as echarts from "echarts/core";
// 图表：折线图 LineChart
import { LineChart } from "echarts/charts";
// 正确组件列表，删掉不存在的 AxisComponent
import {
  TitleComponent, // 标题
  TooltipComponent, // 悬浮提示
  GridComponent, // 直角坐标系（包含 xAxis/yAxis 坐标轴能力，核心！）
  LegendComponent, // 图例
  DatasetComponent,
  TransformComponent,
  GraphicComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
// 必须引入渲染器
import { CanvasRenderer } from "echarts/renderers";

import "@/index.css";
// 注册所有模块
echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent,
  GraphicComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

const app = createApp(App);
app.component("v-chart", VChart);
app.use(router);
app.mount("#app");

// createApp(App).use(router).mount("#app");
