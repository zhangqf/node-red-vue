<script setup lang="ts">
import { HTTP_URL } from "@/config/config";
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import * as XLSX from "xlsx";
import { Workbook } from "exceljs";
import { fetchWithTimeout as fetch } from "@/utils/http";
import { Capacitor, registerPlugin } from "@capacitor/core";

const { withLoading, showToast } = useToast();
const router = useRouter();

interface Device {
  id: string;
  name: string;
  typeName?: string;
  location?: string;
  combination?: string;
  config?: string;
  combinationId?: string;
  configId?: string;
  closeType?: string;
}

const devices = ref<Device[]>([]);
const showImportMenu = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

interface StationFilePlugin {
  saveFile(options: {
    fileName: string;
    mimeType: string;
    dataBase64: string;
  }): Promise<{ cancelled: boolean }>;
  openFile(): Promise<{
    cancelled: boolean;
    fileName?: string;
    dataBase64?: string;
  }>;
}

const stationFilePlugin = registerPlugin<StationFilePlugin>("StationFile");
const isAndroidApp =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const excelMimeType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const latestStatus = ref<Record<string, { DC?: string; FC?: string }>>({});

async function fetchLatestStatus() {
  try {
    const response = await fetch(HTTP_URL + "/latestOperationRecords", {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    const rows = await response.json();
    const map: Record<string, { DC?: string; FC?: string }> = {};
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const name = r.device_name;
        if (!name) continue;
        if (!map[name]) map[name] = {};
        if (r.op_type === "DC") map[name].DC = r.status;
        else if (r.op_type === "FC") map[name].FC = r.status;
      }
    }
    latestStatus.value = map;
  } catch {
    latestStatus.value = {};
  }
}

function isDeviceSuccess(name: string): boolean {
  const s = latestStatus.value[name];
  return !!s && s.DC === "success" && s.FC === "success";
}

// function extractZone(location?: string): string {
//   if (!location) return "";
//   const match = location.match(/[A-C]区?/);
//   return match ? match[0].replace("区", "") + " 区" : "";
// }

// function getStrContent(str?: string): string {
//   if (!str) return "";
//   const match = str.match(/\/(.+)/);
//   return match ? match[1] : "";
// }

function deviceModel(name: string): string {
  if (name.includes("ZD6")) return "ZD6";
  if (name.includes("ZDJ9")) return "ZDJ9";
  if (name.includes("ZYJ7")) return "ZYJ7";
  if (name.includes("S700K")) return "S700K";
  return "";
}

function mapCloseType(v: string): string {
  if (v.includes("1、3") || v === "contact13Closed") return "contact13Closed";
  if (v.includes("2、4") || v === "contact24Closed") return "contact24Closed";
  return "";
}

const groupedDevices = computed(() => {
  const groups: Record<string, Device[]> = {};
  for (const d of devices.value) {
    // const zone = extractZone(d.location) || getStrContent(d.location);
    const zone = d.location || "未分区";
    if (!groups[zone]) groups[zone] = [];
    groups[zone].push(d);
  }
  return Object.entries(groups);
});

function onDeviceClick(device: Device) {
  router.push({
    name: "work",
    params: {
      combinationId: device.combinationId,
      configId: device.configId,
      deviceId: device.id,
    },
    query: {
      opeModel: "code",
      name: device.name,
      closeType: device.closeType || "",
    },
  });
}

async function fetchDevices() {
  try {
    const response = await fetch(HTTP_URL + "/codeDeviceList", {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    devices.value = await response.json();
  } catch {
    devices.value = [];
  }
}

interface TemplateCombination {
  id: string;
  name: string;
  deviceType: string;
}

interface TemplateConfig {
  id: string;
  name: string;
}

interface ModelDevice {
  id: string;
  name: string;
  typeName: string;
}

interface BindingGroup {
  deviceId: string;
  bindings: { combinationId: string; configIds: string[] }[];
}

const combinationOptions = ref<TemplateCombination[]>([]);
const configOptions = ref<TemplateConfig[]>([]);
const typeOptions = ref<{ typeName: string }[]>([]);
/** 机型记录（device 表），用于把绑定关系里的 deviceId 还原成 typeName */
const modelDevices = ref<ModelDevice[]>([]);
/** 绑定关系（/getBingings），记录每个机型绑定了哪些组合方式、每个组合方式下有哪些配置 */
const bindingGroups = ref<BindingGroup[]>([]);

async function fetchTemplateData() {
  try {
    const response = await fetch(HTTP_URL + "/getCombinationAndConfig", {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    const { combination, config, type } = await response.json();
    combinationOptions.value = combination || [];
    configOptions.value = config || [];
    typeOptions.value = type || [];
  } catch {
    console.error("Failed to fetch combination and config data");
    showToast("加载模板数据失败", "error");
  }

  // 绑定关系是“组合方式 -> 配置”联动的一部分，拿不到时降级为按配置名匹配
  try {
    const [deviceRes, bindingRes] = await Promise.all([
      fetch(HTTP_URL + "/getDevice", {
        method: "get",
        headers: { "Content-Type": "application/json" },
      }),
      fetch(HTTP_URL + "/getBingings", {
        method: "get",
        headers: { "Content-Type": "application/json" },
      }),
    ]);
    modelDevices.value = (await deviceRes.json()) || [];
    bindingGroups.value = (await bindingRes.json()) || [];
  } catch {
    console.error("Failed to fetch device bindings");
    modelDevices.value = [];
    bindingGroups.value = [];
  }
}

/** 配置名形如「三动A机【双-单-双】」，取出【】里的组合方式（可能用 / 列出多个） */
function getConfigCombinationNames(name: string): string[] {
  const match = String(name || "").match(/【([^】]+)】/);
  if (!match || !match[1]) return [];
  return match[1]
    .split(/[\/／]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const CASCADE_KEY_SEPARATOR = "\u0001";

function cascadeKey(type: string, combination: string): string {
  return type + CASCADE_KEY_SEPARATOR + combination;
}

interface TemplateCascade {
  types: string[];
  combinationsByType: Record<string, string[]>;
  /** key = `${type}\u0001${combination}` */
  configsByTypeCombination: Record<string, string[]>;
  /** 已经有绑定关系、导入时能真正查到配置的组合方式 */
  importableKeys: Set<string>;
}

/**
 * 生成模板用的三级联动数据：type -> 该类型下的 combination -> 该组合方式下的 config。
 *
 * 配置归属优先用绑定关系（combination_config_bindings）判断；没有绑定记录的
 * 配置（例如 ZDJ9 目前还没绑定到机型）再退化为看配置名【】里的组合方式，避免
 * 这些配置在模板里消失。
 */
function buildTemplateCascade(): TemplateCascade {
  const types: string[] = [];
  const addType = (type: string) => {
    if (type && !types.includes(type)) types.push(type);
  };
  typeOptions.value.forEach((t) => addType(t.typeName));

  const combinationsByType: Record<string, string[]> = {};
  for (const combo of combinationOptions.value) {
    if (!combo.deviceType || !combo.name) continue;
    addType(combo.deviceType);
    const list =
      combinationsByType[combo.deviceType] ||
      (combinationsByType[combo.deviceType] = []);
    if (!list.includes(combo.name)) list.push(combo.name);
  }

  const comboById = new Map(
    combinationOptions.value.map((combo) => [combo.id, combo] as const),
  );
  const configById = new Map(
    configOptions.value.map((cfg) => [cfg.id, cfg] as const),
  );
  const typeByDeviceId = new Map(
    modelDevices.value.map((d) => [d.id, d.typeName] as const),
  );

  /** config.id -> 通过绑定关系反推出的适用机型 */
  const configTypes = new Map<string, Set<string>>();
  /** `${type}\u0001${combination}` -> 已绑定的配置名 */
  const boundNames = new Map<string, Set<string>>();
  /** type -> 该机型下出现过绑定关系的配置名（不区分组合方式） */
  const boundNamesByType = new Map<string, Set<string>>();

  for (const group of bindingGroups.value) {
    const type = typeByDeviceId.get(group.deviceId);
    if (!type) continue;
    for (const binding of group.bindings || []) {
      const combo = comboById.get(binding.combinationId);
      if (!combo || !combo.name) continue;
      // 历史数据里可能存在跨机型绑定，按组合方式自己的机型过滤
      if (combo.deviceType && combo.deviceType !== type) continue;
      const key = cascadeKey(type, combo.name);
      for (const configId of binding.configIds || []) {
        const cfg = configById.get(configId);
        if (!cfg) continue;
        let names = boundNames.get(key);
        if (!names) {
          names = new Set();
          boundNames.set(key, names);
        }
        names.add(cfg.name);
        let typeNames = boundNamesByType.get(type);
        if (!typeNames) {
          typeNames = new Set();
          boundNamesByType.set(type, typeNames);
        }
        typeNames.add(cfg.name);
        let models = configTypes.get(configId);
        if (!models) {
          models = new Set();
          configTypes.set(configId, models);
        }
        models.add(type);
      }
    }
  }

  const configsByTypeCombination: Record<string, string[]> = {};
  const importableKeys = new Set<string>();
  for (const type of types) {
    for (const combination of combinationsByType[type] || []) {
      const key = cascadeKey(type, combination);
      const bound = boundNames.get(key);
      const boundForType = boundNamesByType.get(type);
      const names: string[] = [];
      const seen = new Set<string>();
      // 按 config 表原始顺序输出，保证每次生成的模板一致
      for (const cfg of configOptions.value) {
        if (seen.has(cfg.name)) continue;
        let include = bound?.has(cfg.name) ?? false;
        if (!include) {
          const comboNames = getConfigCombinationNames(cfg.name);
          if (comboNames.includes(combination)) {
            const models = configTypes.get(cfg.id);
            // 有绑定记录的配置按机型判断；没有绑定记录的（例如另存的副本），
            // 只有当同名配置在该机型下确实绑定过才列出，保证导入时能查到。
            include = models
              ? models.has(type)
              : (boundForType?.has(cfg.name) ?? false);
          }
        }
        if (include) {
          seen.add(cfg.name);
          names.push(cfg.name);
        }
      }
      if (names.length > 0) {
        configsByTypeCombination[key] = names;
        if (bound && bound.size > 0) importableKeys.add(key);
      }
    }
  }

  return {
    types,
    combinationsByType,
    configsByTypeCombination,
    importableKeys,
  };
}

/** 把 1、2、3… 转成 A、B、…、AA 这样的列号 */
function excelColumnName(index: number): string {
  let n = index;
  let name = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function toggleImportMenu() {
  showImportMenu.value = !showImportMenu.value;
}

function closeImportMenu() {
  showImportMenu.value = false;
}

async function createExcelTemplate() {
  const workbook = new Workbook();
  const cascade = buildTemplateCascade();
  const types = cascade.types;
  // 下拉框和辅助公式覆盖到 501 行，够站场批量导入使用
  const lastRow = 501;

  // ---- 隐藏选项页：类型 ----
  const typeSheet = workbook.addWorksheet("设备类型选项");
  typeSheet.getCell("A1").value = "设备类型";
  types.forEach((type, i) => {
    typeSheet.getCell(`A${i + 2}`).value = type;
  });
  typeSheet.state = "hidden";
  // ExcelJS 不支持整列命名区域，这里用实际行数收尾
  workbook.definedNames.add(
    `'设备类型选项'!$A$2:$A$${Math.max(2, types.length + 1)}`,
    "selType",
  );

  // ---- 隐藏选项页：组合方式（一个类型一列） ----
  const comboSheet = workbook.addWorksheet("组合方式选项");
  const comboRangeNames = new Map<string, string>();
  types.forEach((type, index) => {
    const col = index + 1;
    const letter = excelColumnName(col);
    comboSheet.getCell(`${letter}1`).value = type;
    const list = cascade.combinationsByType[type] || [];
    list.forEach((name, i) => {
      comboSheet.getCell(`${letter}${i + 2}`).value = name;
    });
    const rangeName = `selCombo${col}`;
    workbook.definedNames.add(
      `'组合方式选项'!$${letter}$2:$${letter}$${Math.max(2, list.length + 1)}`,
      rangeName,
    );
    comboRangeNames.set(type, rangeName);
  });
  comboSheet.state = "hidden";

  // ---- 隐藏选项页：配置（一个「类型 + 组合方式」一列） ----
  const configSheet = workbook.addWorksheet("配置选项");
  const configRangeNames = new Map<string, string>();
  let configCol = 0;
  for (const type of types) {
    for (const combination of cascade.combinationsByType[type] || []) {
      const list =
        cascade.configsByTypeCombination[cascadeKey(type, combination)] || [];
      if (list.length === 0) continue;
      configCol += 1;
      const letter = excelColumnName(configCol);
      configSheet.getCell(`${letter}1`).value = `${type}|${combination}`;
      list.forEach((name, i) => {
        configSheet.getCell(`${letter}${i + 2}`).value = name;
      });
      const rangeName = `selConfig${configCol}`;
      workbook.definedNames.add(
        `'配置选项'!$${letter}$2:$${letter}$${list.length + 1}`,
        rangeName,
      );
      configRangeNames.set(cascadeKey(type, combination), rangeName);
    }
  }
  configSheet.state = "hidden";

  // ---- 隐藏映射页：把「类型 / 类型+组合方式」翻译成对应的命名区域 ----
  const mapSheet = workbook.addWorksheet("级联映射");
  mapSheet.getCell("A1").value = "type";
  mapSheet.getCell("B1").value = "组合方式范围";
  mapSheet.getCell("C1").value = "type|combination";
  mapSheet.getCell("D1").value = "配置范围";
  types.forEach((type, i) => {
    const row = i + 2;
    mapSheet.getCell(`A${row}`).value = type;
    mapSheet.getCell(`B${row}`).value = comboRangeNames.get(type) || "";
  });
  let mapRow = 2;
  for (const [key, rangeName] of configRangeNames) {
    const separatorIndex = key.indexOf(CASCADE_KEY_SEPARATOR);
    const type = key.slice(0, separatorIndex);
    const combination = key.slice(separatorIndex + 1);
    mapSheet.getCell(`C${mapRow}`).value = `${type}|${combination}`;
    mapSheet.getCell(`D${mapRow}`).value = rangeName;
    mapRow += 1;
  }
  // 空选项：选不到时让下拉列表为空，而不是直接报公式错误
  mapSheet.getCell("H1").value = "";
  mapSheet.state = "hidden";

  workbook.definedNames.add(
    `'级联映射'!$A$2:$B$${Math.max(2, types.length + 1)}`,
    "selMapCombo",
  );
  workbook.definedNames.add(
    `'级联映射'!$C$2:$D$${Math.max(2, configRangeNames.size + 1)}`,
    "selMapConfig",
  );
  workbook.definedNames.add("'级联映射'!$H$1", "selNone");

  const ws = workbook.addWorksheet("设备信息");

  ws.columns = [
    { header: "name", key: "name", width: 25 },
    { header: "type", key: "type", width: 12 },
    { header: "combination", key: "combination", width: 20 },
    { header: "config", key: "config", width: 30 },
    { header: "闭合方式", key: "closeType", width: 15 },
    { header: "location", key: "location", width: 15 },
  ];

  // 示例行优先取「已绑定、导入时能查到配置」的组合，避免示例本身导入失败
  const sampleKey =
    [...cascade.importableKeys][0] ||
    Object.keys(cascade.configsByTypeCombination)[0] ||
    "";
  let sampleType = types[0] || "";
  let sampleCombination = "";
  let sampleConfig = "";
  if (sampleKey) {
    const separatorIndex = sampleKey.indexOf(CASCADE_KEY_SEPARATOR);
    sampleType = sampleKey.slice(0, separatorIndex);
    sampleCombination = sampleKey.slice(separatorIndex + 1);
    sampleConfig = cascade.configsByTypeCombination[sampleKey]?.[0] || "";
  }

  ws.addRow({
    name: "01转辙机",
    type: sampleType,
    combination: sampleCombination,
    config: sampleConfig,
    closeType: "1、3闭合",
    location: "站场 A 区",
  });

  // 辅助列：先算出当前行应该使用哪个命名区域，下拉框再用 INDIRECT($H2) 取范围。
  // 这是 Excel / WPS 都支持的“省市区”式写法。不要直接把
  // INDIRECT(VLOOKUP(...)) 写进下拉公式，部分 WPS 版本会把它当成一个普通值，
  // 结果下拉框里只剩一项。
  ws.getCell("H1").value = "辅助-组合范围";
  ws.getCell("I1").value = "辅助-配置范围";
  ws.getCell("J1").value = "辅助-C无效";
  ws.getCell("K1").value = "辅助-D无效";
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`H${r}`).value = {
      formula: `IFERROR(VLOOKUP($B${r},selMapCombo,2,FALSE),"selNone")`,
    };
    ws.getCell(`I${r}`).value = {
      formula: `IFERROR(VLOOKUP($B${r}&"|"&$C${r},selMapConfig,2,FALSE),"selNone")`,
    };
    // 1 表示当前值已经不在上级列表里，需要重新选择
    ws.getCell(`J${r}`).value = {
      formula: `IF($C${r}="",0,IF(ISNA(MATCH($C${r},INDIRECT($H${r}),0)),1,0))`,
    };
    ws.getCell(`K${r}`).value = {
      formula: `IF($D${r}="",0,IF(ISNA(MATCH($D${r},INDIRECT($I${r}),0)),1,0))`,
    };
  }
  ws.getColumn(8).hidden = true;
  ws.getColumn(9).hidden = true;
  ws.getColumn(10).hidden = true;
  ws.getColumn(11).hidden = true;

  // Header row styling
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, size: 16, color: { argb: "FFE0E8F0" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "C0338BCE" },
  };
  headerRow.alignment = { horizontal: "center" };
  headerRow.height = 22;
  await headerRow.commit();

  // ExcelJS 的类型声明里没有 dataValidations，但运行时支持整段区域校验；
  // 整段区域比逐格设置更小，也能让相对引用按行自动偏移。
  const validations = (
    ws as unknown as {
      dataValidations: {
        add: (
          address: string,
          validation: {
            type: "list";
            allowBlank?: boolean;
            formulae: string[];
            showErrorMessage?: boolean;
            errorStyle?: string;
            errorTitle?: string;
            error?: string;
            showInputMessage?: boolean;
            promptTitle?: string;
            prompt?: string;
          },
        ) => void;
      };
    }
  ).dataValidations;

  // type：全部类型
  validations.add(`B2:B${lastRow}`, {
    type: "list",
    allowBlank: true,
    formulae: ["selType"],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: "类型无效",
    error: "请从下拉列表中选择设备类型",
  });

  // combination：只列当前 type 下的组合方式。
  // 这里只引用辅助列 H，保持最基础的 INDIRECT(单元格) 写法。
  validations.add(`C2:C${lastRow}`, {
    type: "list",
    allowBlank: true,
    formulae: ["INDIRECT($H2)"],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: "组合方式无效",
    error: "请先选择 type，再选择该类型下的组合方式",
    showInputMessage: true,
    promptTitle: "组合方式",
    prompt:
      "修改 type 后，如果此单元格变红，说明原组合方式已失效，请重新选择。",
  });

  // config：只列当前 type + combination 下已绑定的配置
  validations.add(`D2:D${lastRow}`, {
    type: "list",
    allowBlank: true,
    formulae: ["INDIRECT($I2)"],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: "配置无效",
    error: "请先选择 combination，再选择该组合方式下的配置",
    showInputMessage: true,
    promptTitle: "配置",
    prompt:
      "修改 combination 后，如果此单元格变红，说明原配置已失效，请重新选择。",
  });

  // 闭合方式
  validations.add(`E2:E${lastRow}`, {
    type: "list",
    allowBlank: true,
    formulae: ['"1、3闭合,2、4闭合"'],
  });

  // 数据验证不会自动清空下级单元格。用户在已有行上改了 type / combination 后，
  // 原来选的组合方式或配置可能已经不在新列表里，这里用条件格式把它们标红，
  // 提示用户重新选择。
  const invalidStyle = {
    fill: {
      type: "pattern",
      pattern: "solid",
      bgColor: { argb: "FFFFC7CE" },
    },
    font: { color: { argb: "FF9C0006" } },
  } as const;
  ws.addConditionalFormatting({
    ref: `C2:C${lastRow}`,
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: ["$J2=1"],
        style: invalidStyle,
      },
    ],
  });
  ws.addConditionalFormatting({
    ref: `D2:D${lastRow}`,
    rules: [
      {
        type: "expression",
        priority: 2,
        formulae: ["$K2=1"],
        style: invalidStyle,
      },
    ],
  });

  ws.getCell("C1").note =
    "修改 type 后，如果此列出现红色，说明原组合方式已失效，请重新选择。";
  ws.getCell("D1").note =
    "修改 combination 后，如果此列出现红色，说明原配置已失效，请重新选择。";

  ws.views = [{ state: "frozen", ySplit: 1 }];

  // 打开工作簿时定位到“设备信息”。如果不设置，activeTab 默认是 0，
  // 正好落在隐藏的“设备类型选项”上；部分 Excel/WPS 版本遇到“活动表被隐藏”
  // 会把这个表重新显示出来，看起来就像隐藏时有时无。
  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 10000,
      height: 20000,
      firstSheet: 0,
      activeTab: workbook.worksheets.length - 1,
      visibility: "visible",
    },
  ];

  return workbook.xlsx.writeBuffer();
}

async function downloadExcelTemplate() {
  try {
    const buf = await createExcelTemplate();
    if (isAndroidApp) {
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const result = await stationFilePlugin.saveFile({
        fileName: "设备导入模板.xlsx",
        mimeType: excelMimeType,
        dataBase64: btoa(binary),
      });
      closeImportMenu();
      if (!result.cancelled) {
        showToast("Excel 模板已保存", "success");
      }
      return;
    }

    const blob = new Blob([buf], { type: excelMimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "设备导入模板.xlsx";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    closeImportMenu();
    showToast("Excel 模板下载成功", "success");
  } catch (error) {
    console.error("Failed to save Excel template", error);
    closeImportMenu();
    showToast("模板生成或保存失败，请重试", "error");
  }
}

function triggerFileInput() {
  closeImportMenu();
  if (isAndroidApp) {
    void pickAndroidFile();
  } else {
    fileInput.value?.click();
  }
}

function decodeBase64File(fileName: string, dataBase64: string): File {
  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: "application/octet-stream" });
}

async function pickAndroidFile() {
  try {
    const result = await stationFilePlugin.openFile();
    if (result.cancelled) return;
    if (!result.fileName || !result.dataBase64) {
      throw new Error("文件选择器未返回有效文件内容");
    }
    await importFile(decodeBase64File(result.fileName, result.dataBase64));
  } catch (error) {
    console.error("Failed to select import file", error);
    showToast(
      error instanceof Error ? error.message : "选择文件失败，请重试",
      "error",
    );
  }
}

function parseRows(rows: Record<string, string>[]): Device[] {
  const imported: Device[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const name = String(
      row["name"] || row["Name"] || row["设备名称"] || row["设备名"] || "",
    ).trim();
    if (!name) continue;
    imported.push({
      id: "imported-" + Date.now() + "-" + i,
      name,
      typeName: String(
        row["type"] || row["Type"] || row["型号"] || row["设备型号"] || "",
      ),
      location: String(
        row["location"] ||
          row["Location"] ||
          row["位置"] ||
          row["设备位置"] ||
          "",
      ),
      combination: String(
        row["combination"] ||
          row["Combination"] ||
          row["组合方式"] ||
          row["设备组合"] ||
          "",
      ),
      config: String(
        row["config"] || row["Config"] || row["配置"] || row["设备配置"] || "",
      ),
      closeType: mapCloseType(
        String(row["闭合方式"] || row["closeType"] || "").trim(),
      ),
    });
  }
  return imported;
}

async function parseCsvFile(file: File): Promise<Device[]> {
  const text = await file.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("至少需要标题行和一条数据");
  }
  const headerLine = lines[0];
  if (!headerLine) throw new Error("至少需要标题行和一条数据");
  const headers = headerLine
    .trim()
    .split(",")
    .map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line
      .trim()
      .split(",")
      .map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || "";
    });
    rows.push(row);
  }
  return parseRows(rows);
}

async function parseExcelFile(file: File): Promise<Device[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  // 优先查找"设备信息" sheet，否则用第一个有数据的 sheet
  let sheetName = "设备信息";
  if (!wb.SheetNames.includes(sheetName)) {
    const found = wb.SheetNames.find((n) => {
      const s = wb.Sheets[n];
      if (!s) return false;
      const tryRows = XLSX.utils.sheet_to_json<Record<string, string>>(s, {
        defval: "",
        header: 1,
      });
      return tryRows.some((r: any) => String(r[0] || "").trim());
    });
    sheetName = found ?? wb.SheetNames[0] ?? "设备信息";
  }

  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("文件中无工作表");
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  });
  if (rows.length === 0) throw new Error("工作表中无数据");
  return parseRows(rows);
}

async function importFile(file: File) {
  if (!file) return;

  try {
    const ext = file.name.split(".").pop()?.toLowerCase();
    let imported: Device[];

    if (ext === "csv") {
      imported = await parseCsvFile(file);
    } else if (ext === "xlsx" || ext === "xls") {
      imported = await parseExcelFile(file);
    } else {
      showToast("不支持的文件格式，请上传 CSV 或 Excel 文件", "error");
      return;
    }

    if (imported.length === 0) {
      showToast("未解析到有效设备数据", "error");
      return;
    }

    // 逐条保存到数据库
    let successCount = 0;
    let skipCount = 0;
    let errorList: string[] = [];
    for (const device of imported) {
      try {
        const res = await fetch(HTTP_URL + "/saveCodeDevice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: device.name,
            typeName: device.typeName,
            location: device.location || "",
            combination: device.combination || "",
            config: device.config || "",
            closeType: device.closeType || "",
          }),
        });
        const data = await res.json().catch(() => ({}));
        // HTTP 200 且业务 code 为 200 才算成功
        if (res.ok && data.code === 200) {
          if (data.skipped) {
            skipCount++;
          } else {
            successCount++;
          }
        } else {
          errorList.push(`${device.name}: ${data.message || res.statusText}`);
        }
      } catch (e: any) {
        errorList.push(`${device.name}: ${e.message || "网络错误"}`);
      }
    }

    // 从数据库刷新列表
    await fetchDevices();
    if (errorList.length > 0) {
      showToast(
        `导入完成：成功 ${successCount} 台，跳过 ${skipCount} 台，失败 ${errorList.length} 台`,
        "warning",
      );
      console.error("导入失败详情:", errorList.join("; "));
    } else {
      const msg =
        skipCount > 0
          ? `成功导入 ${successCount} 台，${skipCount} 台重复已跳过`
          : `成功导入 ${successCount} 台设备`;
      showToast(msg, "success");
    }
  } catch (error) {
    showToast(
      error instanceof Error ? error.message : "文件读取失败，请检查文件格式",
      "error",
    );
  }
}

async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) await importFile(file);
  target.value = "";
}

onMounted(async () => {
  await withLoading(async () => {
    await fetchDevices();
    await fetchTemplateData();
    await fetchLatestStatus();
  }, "站场数据加载成功");
});
</script>

<template>
  <div class="station-page">
    <div class="page-header">
      <button class="back-btn" @click="router.push({ name: 'home' })">
        ← 返回首页
      </button>
      <h2 class="page-title">站场模式</h2>
      <div class="header-info">
        <div class="import-wrapper">
          <button class="import-btn" @click="toggleImportMenu">
            <svg viewBox="0 0 16 16" fill="none" class="import-icon">
              <path
                d="M8 2V11"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round" />
              <path
                d="M4 7L8 11L12 7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M2 12V13.5H14V12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round" />
            </svg>
            导入
          </button>
          <div v-if="showImportMenu" class="import-menu" @click.stop>
            <div class="import-menu-label">下载模板</div>
            <button class="import-menu-item" @click="downloadExcelTemplate">
              <svg viewBox="0 0 16 16" fill="none" class="menu-item-icon">
                <rect
                  x="2"
                  y="2"
                  width="12"
                  height="12"
                  rx="1.5"
                  stroke="currentColor"
                  stroke-width="1.3"
                  fill="none" />
                <path
                  d="M5 6H11"
                  stroke="currentColor"
                  stroke-width="1"
                  opacity="0.5" />
                <path
                  d="M5 9H11"
                  stroke="currentColor"
                  stroke-width="1"
                  opacity="0.5" />
                <path
                  d="M5 12H8"
                  stroke="currentColor"
                  stroke-width="1"
                  opacity="0.3" />
              </svg>
              Excel 格式 (.xlsx)
            </button>
            <div class="import-menu-divider"></div>
            <button class="import-menu-item primary" @click="triggerFileInput">
              <svg viewBox="0 0 16 16" fill="none" class="menu-item-icon">
                <path
                  d="M8 10V3"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round" />
                <path
                  d="M5 6L8 3L11 6"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
                <path
                  d="M3 11V13H13V11"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round" />
              </svg>
              上传文件导入
              <span class="item-hint"> Excel</span>
            </button>
          </div>
        </div>
        <span class="info-badge">
          <span class="badge-dot online"></span>
          {{ devices.length }} 台设备
        </span>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".xlsx,.xls,.csv"
      class="file-input-hidden"
      @change="handleFileImport" />

    <!-- Click-outside overlay -->
    <div
      v-if="showImportMenu"
      class="menu-overlay"
      @click="closeImportMenu"></div>

    <div class="dashboard">
      <div
        v-for="[zone, zoneDevices] in groupedDevices"
        :key="zone"
        class="zone-section">
        <div class="zone-header">
          <span class="zone-title">{{ zone }}</span>
          <span class="zone-count">{{ zoneDevices.length }} 台</span>
        </div>
        <div class="device-grid">
          <div
            v-for="device in zoneDevices"
            :key="device.id"
            class="device-card"
            @click="onDeviceClick(device)">
            <div class="card-icon">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <rect
                  x="8"
                  y="10"
                  width="32"
                  height="28"
                  rx="4"
                  stroke="#5a92d0"
                  stroke-width="1.5"
                  fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="6"
                  stroke="#5a92d0"
                  stroke-width="1.5"
                  fill="none" />
                <circle cx="24" cy="24" r="2.5" fill="#34d399" />
                <line
                  x1="24"
                  y1="4"
                  x2="24"
                  y2="10"
                  stroke="#5a92d0"
                  stroke-width="1.5" />
                <line
                  x1="24"
                  y1="38"
                  x2="24"
                  y2="44"
                  stroke="#5a92d0"
                  stroke-width="1.5" />
                <line
                  x1="8"
                  y1="24"
                  x2="14"
                  y2="24"
                  stroke="#5a92d0"
                  stroke-width="1.5" />
                <line
                  x1="34"
                  y1="24"
                  x2="40"
                  y2="24"
                  stroke="#5a92d0"
                  stroke-width="1.5" />
              </svg>
            </div>
            <div class="card-body">
              <div class="device-model">
                {{ device.typeName || deviceModel(device.name) }}系列
              </div>
              <div class="device-name">编号：{{ device.name }}</div>
              <div class="device-location">地址：{{ device.location }}</div>
            </div>
            <!-- <div class="card-status">
              <span class="status-dot online"></span>
              <span class="status-text">在线</span>
            </div> -->
            <div
              v-if="isDeviceSuccess(device.name)"
              class="success-badge"
              title="最近一次定操、反操均成功">
              <span class="success-dot"></span>
              定反操成功
            </div>
            <div class="card-arrow">→</div>
          </div>
        </div>
      </div>

      <div v-if="devices.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <rect
              x="12"
              y="20"
              width="40"
              height="28"
              rx="4"
              stroke="#1a3350"
              stroke-width="2" />
            <circle cx="32" cy="28" r="12" stroke="#1a3350" stroke-width="2" />
            <line
              x1="32"
              y1="16"
              x2="32"
              y2="20"
              stroke="#1a3350"
              stroke-width="2" />
          </svg>
        </div>
        <p class="empty-text">暂无设备数据</p>
        <p class="empty-hint">
          请先在设备资产中添加转辙机设备，或通过导入功能批量添加
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.station-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 24px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.back-btn {
  background: transparent;
  border: 1px solid #1a2d44;
  color: #8fb4d8;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(90, 146, 208, 0.1);
  border-color: #2d5280;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e8f0;
  flex: 1;
}

.header-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* ---- Import button & menu ---- */
.import-wrapper {
  position: relative;
}

.import-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(90, 146, 208, 0.1);
  border: 1px solid #2a4a68;
  color: #8fb4d8;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.import-btn:hover {
  background: rgba(90, 146, 208, 0.2);
  border-color: #5a92d0;
  color: #b8d4f0;
}

.import-icon {
  width: 14px;
  height: 14px;
}

.import-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
  padding: 4px;
  min-width: 200px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.import-menu-label {
  font-size: 10px;
  color: #5a7288;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 8px 12px 4px;
}

.import-menu-divider {
  height: 1px;
  background: #1a2d44;
  margin: 4px 8px;
}

.import-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: #8fb4d8;
  font-size: 13px;
  padding: 9px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.import-menu-item:hover {
  background: #1a3350;
  color: #e0e8f0;
}

.import-menu-item.primary {
  color: #5a92d0;
}

.import-menu-item.primary:hover {
  color: #8fb4d8;
}

.item-hint {
  font-size: 11px;
  color: #5a7288;
  margin-left: auto;
}

.menu-item-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 199;
}

.file-input-hidden {
  display: none;
}

/* ---- Badge ---- */
.info-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 12px;
  color: #8fb4d8;
}

.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.badge-dot.online {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
}

.dashboard {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #1a2d44 transparent;
}

.dashboard::-webkit-scrollbar {
  width: 4px;
}

.dashboard::-webkit-scrollbar-track {
  background: transparent;
}

.dashboard::-webkit-scrollbar-thumb {
  background: #1a2d44;
  border-radius: 2px;
}

.zone-section {
  margin-bottom: 20px;
}

.zone-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #0a1628;
  border: 1px solid #152238;
  border-radius: 6px;
  margin-bottom: 12px;
}

.zone-title {
  font-size: 14px;
  font-weight: 600;
  color: #8fb4d8;
}

.zone-count {
  font-size: 12px;
  color: #5a7288;
  background: #0b1d33;
  padding: 1px 10px;
  border-radius: 10px;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.device-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 10px;
  padding: 16px 18px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.device-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at top left,
    rgba(90, 146, 208, 0.04) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s;
}

.device-card:hover {
  border-color: #2d5280;
  background: #0f2240;
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.device-card:hover::after {
  opacity: 1;
}

.device-card:hover .card-arrow {
  opacity: 1;
  transform: translateX(0);
}

.card-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.device-model {
  font-size: 10px;
  font-weight: 700;
  color: #5a92d0;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.device-name {
  font-size: 14px;
  font-weight: 600;
  color: #e0e8f0;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-location {
  font-size: 11px;
  color: #5a7288;
}

.card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-dot.online {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.6);
}

.status-text {
  font-size: 11px;
  color: #5a7288;
}

.card-arrow {
  font-size: 18px;
  color: #5a92d0;
  opacity: 0;
  transform: translateX(-6px);
  transition: all 0.3s;
  flex-shrink: 0;
}

.success-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  background: rgba(52, 211, 153, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.35);
  color: #34d399;
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 12px;
  white-space: nowrap;
}

.success-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.6);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  opacity: 0.4;
}

.empty-text {
  font-size: 15px;
  color: #5a7288;
}

.empty-hint {
  font-size: 12px;
  color: #3a5068;
}

@media (max-width: 1200px) {
  .device-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .device-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
