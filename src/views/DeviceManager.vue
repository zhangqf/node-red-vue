<script setup lang="ts">
import { onMounted, ref, toRaw } from "vue";
import { HTTP_URL } from "@/config/config";
import { useToast } from "@/composables/useToast";

const { withLoading } = useToast();

interface Device {
  id: string;
  name: string;
  typeName: string;
  location: string;
}

const devices = ref<Device[]>([
  {
    id: "1",
    name: "ZD6 转辙机 #001",
    typeName: "ZD6",
    location: "站场 A 区",
  },
  {
    id: "2",
    name: "ZD6 转辙机 #002",
    typeName: "ZD6",
    location: "站场 B 区",
  },
  {
    id: "3",
    name: "S700K 转辙机 #001",
    typeName: "S700K",
    location: "站场 C 区",
  },
]);

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref("");
const form = ref({ name: "", typeName: "", location: "" });

function openAdd() {
  isEdit.value = false;
  editId.value = "";
  form.value = { name: "", typeName: "", location: "" };
  showModal.value = true;
}

function openEdit(device: Device) {
  isEdit.value = true;
  editId.value = device.id;
  form.value = { ...device };
  showModal.value = true;
}

async function save() {
  if (isEdit.value) {
    const idx = devices.value.findIndex((d) => d.id === editId.value);
    if (idx !== -1) {
      devices.value[idx] = { id: editId.value, ...form.value };
    }
  } else {
    const newId = String(Date.now());
    devices.value.push({ id: newId, ...form.value });
  }
  await withLoading(async () => {
    const response = await fetch(HTTP_URL + "/saveDevice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.value),
    });
    const data = await response.json();
    console.log("Node-RED回应:", data);
  }, "保存成功");
  getList();
  showModal.value = false;
}

const deleteList = async (id: string) => {
  const response = await fetch(`${HTTP_URL}/deleteDevice/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`请求失败，状态码：${response.status}`);
  }

  const data = await response.json();
  console.log("删除接口返回：", data);

  if (data.code !== 200 && data.code !== 0) {
    throw new Error(data.msg || "删除失败");
  }
  return data;
};

async function remove(id: string) {
  // 包装loading
  const delAction = withLoading(async () => {
    const res = await deleteList(id);
    // 接口成功后：1.本地过滤列表 2.成功提示
    devices.value = devices.value.filter((c) => c.id !== id);
    return res;
  }, "正在删除...");
  try {
    await delAction();
  } catch (error: any) {
    console.error("删除操作异常：", error);
  }
}

const getList = async () => {
  const response = await fetch(HTTP_URL + "/getDevice", {
    method: "get",
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
  devices.value = data;
  console.log(data);
};

onMounted(async () => {
  await withLoading(async () => {
    getList();
  }, "数据加载成功");
});
</script>

<template>
  <div class="manager-page">
    <div class="page-header">
      <h2 class="page-title">机型资产管理</h2>
      <button class="add-btn" @click="openAdd">+ 添加设备</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>设备名称</th>
          <th>型号</th>
          <th>位置</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="device in devices" :key="device.id">
          <td>{{ device.name }}</td>
          <td>{{ device.typeName }}</td>
          <td>{{ device.location }}</td>
          <td class="actions">
            <button class="action-btn edit" @click="openEdit(device)">
              编辑
            </button>
            <button class="action-btn delete" @click="remove(device.id)">
              删除
            </button>
          </td>
        </tr>
        <tr v-if="devices.length === 0">
          <td colspan="5" class="empty-row">暂无设备</td>
        </tr>
      </tbody>
    </table>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-card">
        <h3 class="modal-title">{{ isEdit ? "编辑设备" : "添加设备" }}</h3>
        <div class="modal-body">
          <label>设备名称</label>
          <input v-model="form.name" class="modal-input" />
          <label>型号</label>
          <input v-model="form.typeName" class="modal-input" />
          <label>位置</label>
          <input v-model="form.location" class="modal-input" />
        </div>
        <div class="modal-footer">
          <button class="action-btn cancel" @click="showModal = false">
            取消
          </button>
          <button class="action-btn save" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manager-page {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 18px;
  color: #8fb4d8;
}

.add-btn {
  background: #1a6b3c;
  color: #fff;
  border: none;
  font-size: 13px;
  padding: 7px 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.add-btn:hover {
  background: #21884b;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid #1a2d44;
}

.data-table th {
  color: #5a7288;
  font-size: 12px;
  font-weight: 500;
}

.data-table td {
  color: #c0d0e0;
  font-size: 13px;
}

.status-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.status-tag.online {
  color: #34d399;
  background: rgba(52, 211, 153, 0.12);
}

.status-tag.offline {
  color: #f87171;
  background: rgba(248, 113, 113, 0.12);
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  border: none;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn.edit {
  background: #1a3350;
  color: #8fb4d8;
}

.action-btn.edit:hover {
  background: #254670;
}

.action-btn.delete {
  background: rgba(217, 48, 37, 0.2);
  color: #f87171;
}

.action-btn.delete:hover {
  background: rgba(217, 48, 37, 0.4);
}

.action-btn.save {
  background: #1a6b3c;
  color: #fff;
}

.action-btn.save:hover {
  background: #21884b;
}

.action-btn.cancel {
  background: #1a2d44;
  color: #8a9fb0;
}

.empty-row {
  text-align: center;
  color: #5a7288;
  padding: 40px 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-card {
  background: #0b1d33;
  border: 1px solid #1a2d44;
  border-radius: 8px;
  padding: 24px;
  width: 420px;
}

.modal-title {
  font-size: 16px;
  color: #e0e8f0;
  margin-bottom: 20px;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.modal-body label {
  font-size: 12px;
  color: #5a7288;
  margin-top: 8px;
}

.modal-body label:first-child {
  margin-top: 0;
}

.modal-input {
  background: #051424;
  border: 1px solid #1a2d44;
  color: #e0e8f0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.modal-input:focus {
  border-color: #2d5280;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
