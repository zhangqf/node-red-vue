import { computed, ref, type Ref } from "vue";
import { relayConfigList, DC_GROUP_TYPES, FC_GROUP_TYPES } from "@/utils/config";
import type { ActionRelays, TestItem, RelayTip } from "@/utils/interface";
import { circuitPath, findRelayIndex, type CircuitConfig } from "@/utils/utils";

interface UseIndicationOptions {
  /** 当前闭合方式对应的继电器分组（来自 config 表） */
  configActionRelays: Ref<ActionRelays | null>;
  /** 继电器采样排序表，来自 /getConfigRelays/:id */
  indicationRelay: Ref<any[]>;
  deviceType: Ref<string>;
  configName: Ref<string>;
  /** 按 field 取当前机型+配置的电路图与端子路径 */
  handleFindCollect: (field: string) => CircuitConfig | undefined;
}

/**
 * 表示继电器判定：维护 testResults 列表，接收实时采样更新每一项的吸合状态。
 *
 * 表示项按定位侧/反位侧分组：DC_GROUP_TYPES 是定位侧（定位传动+定操B/C），
 * FC_GROUP_TYPES 是反位侧（反位传动+反操B/C）。操动完成后的判定范围与
 * 操作方向同侧，见 config.ts 的 DC_RECORD_TYPES / FC_RECORD_TYPES。
 */
export function useIndication(options: UseIndicationOptions) {
  const {
    configActionRelays,
    indicationRelay,
    deviceType,
    configName,
    handleFindCollect,
  } = options;

  const testResults = ref<TestItem[]>([]);

  /** 表示项 type → 继电器分组字段 */
  const typeToFieldMap: Record<string, keyof ActionRelays> = {};
  relayConfigList.forEach((item) => {
    typeToFieldMap[item.type] = item.field;
  });

  /** 定位表示（GreenLight）/ 反位表示（YellowLight）实时状态 */
  const positioningTrue = computed(() => {
    const item = testResults.value.find((t) => t.type === "GreenLight");
    return item?.status === true;
  });
  const reverseTrue = computed(() => {
    const item = testResults.value.find((t) => t.type === "YellowLight");
    return item?.status === true;
  });

  const resetAllLock = () => {
    testResults.value = [];
  };

  /**
   * 依据 configActionRelays 生成初始结果列表（不依赖 WS 数据）。
   * config 里没配继电器的项直接不出现；全部为空时给一条占位提示。
   */
  function initTestResults() {
    const relayData = configActionRelays.value;
    if (!relayData) {
      testResults.value = [];
      return;
    }

    testResults.value = relayConfigList
      .filter((item) => relayData[item.field] && relayData[item.field].length > 0)
      .map((item) => {
        const field = typeToFieldMap[item.type];
        const resCollect = field ? handleFindCollect(field) : undefined;

        return {
          type: item.type,
          name: item.name,
          status: "NT" as const,
          realCheck: false,
          relayName: relayData[item.field],
          img: field ? (resCollect?.img?.[field] ?? "") : "",
        };
      });

    if (testResults.value.length === 0) {
      testResults.value = [
        {
          type: "empty",
          name: "无所需的表示项",
          status: "NT",
          realCheck: false,
          relayName: [],
        },
      ];
    }
  }

  /** ZYJ7-SH6 的 B/C 项端子路径与通用配置不同，在此特判 */
  const buildRelayTips = (
    type: string,
    relayNames: string[],
    resCollect: CircuitConfig | undefined,
    relayStates: Record<string, boolean>,
  ): RelayTip[] => {
    const tips: RelayTip[] = [];
    const cfg = configName.value.replace(/(【.+?】)$/, "");
    const isSH6 = deviceType.value === "ZYJ7" && cfg === "SH6";

    for (const v of relayNames) {
      const closed = relayStates[v] === true;
      if (isSH6) {
        if (type === "DCBX") {
          tips.push({ name: v, path: "D7→43-44→D3", closed });
          continue;
        }
        if (type === "DCCX") {
          tips.push({ name: v, path: "D8→23→13-14→44→D3", closed });
          continue;
        }
      }
      tips.push({ name: v, path: circuitPath(resCollect, v), closed });
    }
    return tips;
  };

  /** 收到表示采样：逐项更新吸合状态与端子路径 */
  const handleWsRelayData = (data: number[]) => {
    const relayData = configActionRelays.value;
    if (!relayData) return;

    const sampleData = indicationRelay.value;
    if (!Array.isArray(sampleData) || sampleData.length < 1) return;

    const realData = data.map((item) => (item ? 1 : 0));

    testResults.value = testResults.value.map((item) => {
      if (item.type === "empty") return item;

      const field = typeToFieldMap[item.type];
      if (!field) return item;

      const targetArr = relayData[field];
      if (targetArr.length < 1) return item;

      const resCollect = handleFindCollect(field);
      const res = findRelayIndex(targetArr, realData, sampleData);
      const relayTips = buildRelayTips(
        item.type,
        item.relayName,
        resCollect,
        res.relayStates,
      );

      return {
        ...item,
        relayTips,
        img: resCollect?.img?.[field] || "",
        status: res.allClosed,
        realCheck: res.allClosed,
      };
    });
  };

  /**
   * 定位表示/反位表示始终显示；对应的传动与 B/C 项只有该侧表示成功后才有意义，
   * 否则隐藏，避免展示尚未成立的判定结果。
   */
  const displayedTestResults = computed(() => {
    return testResults.value.filter((item) => {
      if (item.type === "GreenLight" || item.type === "YellowLight") {
        return true;
      }
      if (DC_GROUP_TYPES.has(item.type)) return positioningTrue.value;
      if (FC_GROUP_TYPES.has(item.type)) return reverseTrue.value;
      return true;
    });
  });

  return {
    testResults,
    typeToFieldMap,
    positioningTrue,
    reverseTrue,
    initTestResults,
    handleWsRelayData,
    resetAllLock,
    displayedTestResults,
  };
}