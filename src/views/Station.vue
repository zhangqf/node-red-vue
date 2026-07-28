<script setup lang="ts">
import { HTTP_URL } from "@/config/config";
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import * as XLSX from "xlsx";
import { Workbook } from "exceljs";

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
}

const devices = ref<Device[]>([]);
const showImportMenu = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function extractZone(location?: string): string {
  if (!location) return "";
  const match = location.match(/[A-C]区?/);
  return match ? match[0].replace("区", "") + " 区" : "";
}

function getStrContent(str?: string): string {
  if (!str) return "";
  const match = str.match(/\/(.+)/);
  return match ? match[1] : "";
}

function deviceModel(name: string): string {
  if (name.includes("ZD6")) return "ZD6";
  if (name.includes("ZDJ9")) return "ZDJ9";
  if (name.includes("ZYJ7")) return "ZYJ7";
  if (name.includes("S700K")) return "S700K";
  return "";
}

const groupedDevices = computed(() => {
  const groups: Record<string, Device[]> = {};
  for (const d of devices.value) {
    const zone =
      extractZone(d.location) || getStrContent(d.location) || "未分区";
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
    devices.value = [
      { id: "device-001", name: "ZD6 转辙机 #001", location: "站场 A 区" },
      { id: "device-002", name: "ZD6 转辙机 #002", location: "站场 B 区" },
      { id: "device-003", name: "ZD6 转辙机 #003", location: "站场 C 区" },
      { id: "device-004", name: "S700K 转辙机 #001", location: "站场 A 区" },
    ];
  }
}

const combinationOptions = ref<string[]>([]);
const configOptions = ref<string[]>([]);
const typeOptions = ref<string[]>([]);
async function fetchTemplateData() {
  try {
    const response = await fetch(HTTP_URL + "/getCombinationAndConfig", {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });
    const { combination, config, type } = await response.json();
    combinationOptions.value = combination;
    configOptions.value = config;
    typeOptions.value = type;
  } catch {
    console.error("Failed to fetch combination and config data");
    showToast("加载模板数据失败", "error");
  }
}

function toggleImportMenu() {
  showImportMenu.value = !showImportMenu.value;
}

function closeImportMenu() {
  showImportMenu.value = false;
}

async function downloadExcelTemplate() {
  const workbook = new Workbook();

  // ---- Hidden options sheets ----
  const typeSheet1 = workbook.addWorksheet("设备类型选项");
  typeSheet1.addRows([
    ["请替换为系统中的类型信息"],
    ...typeOptions.value.map((v) => [v.typeName]),
  ]);
  typeSheet1.state = "veryHidden";

  const comboSheet = workbook.addWorksheet("组合方式选项");

  const comboData = combinationOptions.value.map((v) => {
    return [v.name];
  });
  comboSheet.addRows([["请替换为系统中的配置信息"], ...comboData]);
  comboSheet.state = "veryHidden";

  const configSheet = workbook.addWorksheet("配置选项");
  configSheet.addRows([
    ["请替换为系统中的配置信息"],
    ...configOptions.value.map((v) => [v.name]),
  ]);
  configSheet.state = "veryHidden";

  const ws = workbook.addWorksheet("设备信息");

  ws.columns = [
    { header: "name", key: "name", width: 25 },
    { header: "type", key: "type", width: 12 },
    { header: "combination", key: "combination", width: 20 },
    { header: "config", key: "config", width: 20 },
    { header: "location", key: "location", width: 15 },
  ];

  ws.addRows([
    {
      name: "01转辙机",
      type: "ZD6",
      combination: "单动单机",
      config: "ZD6-D",
      location: "站场 A 区",
    },
  ]);

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
  // Data validation: type (column B)
  // ws.getCell("B2").dataValidation = {
  //   type: "list",
  //   allowBlank: true,
  //   formulae: ['"ZD6,ZDJ9,ZYJ7,S700K,ZD9"'],
  // };
  // Copy validation to all type cells
  for (let r = 2; r <= 100; r++) {
    ws.getCell(`B${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'设备类型选项'!$A$2:$A$100"],
    };
  }

  // Data validation: combination (column C) - reference hidden sheet
  for (let r = 2; r <= 100; r++) {
    ws.getCell(`C${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'组合方式选项'!$A$2:$A$100"],
    };
  }

  // Data validation: config (column D) - reference hidden sheet
  for (let r = 2; r <= 100; r++) {
    ws.getCell(`D${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["'配置选项'!$A$2:$A$100"],
    };
  }

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "设备导入模板.xlsx";
  a.click();
  URL.revokeObjectURL(url);
  closeImportMenu();
  showToast("Excel 模板下载成功", "success");
}

function triggerFileInput() {
  fileInput.value?.click();
  closeImportMenu();
}

function parseRows(rows: Record<string, string>[]): Device[] {
  const imported: Device[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
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
  const headers = lines[0]
    .trim()
    .split(",")
    .map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
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
    sheetName =
      wb.SheetNames.find((n) => {
        const s = wb.Sheets[n];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(s, {
          defval: "",
          header: 1,
        });
        return rows.some((r: any) => String(r[0] || "").trim());
      }) || wb.SheetNames[0];
  }
  if (!sheetName) throw new Error("文件中无工作表");

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  });
  if (rows.length === 0) throw new Error("工作表中无数据");
  return parseRows(rows);
}

async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
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
      target.value = "";
      return;
    }

    if (imported.length === 0) {
      showToast("未解析到有效设备数据", "error");
      target.value = "";
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
  } catch (e: any) {
    showToast(e.message || "文件读取失败，请检查文件格式", "error");
  }

  target.value = "";
}

onMounted(async () => {
  await withLoading(async () => {
    await fetchDevices();
    await fetchTemplateData();
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
      accept=".xlsx,.xls"
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
