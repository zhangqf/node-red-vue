import { ref } from "vue";

const sessionAuthed = ref(false);
const showDialog = ref(false);
const errorMsg = ref("");
let pendingResolve: ((v: boolean) => void) | null = null;

export function useAuth() {
  async function verifyPassword(password: string): Promise<boolean> {
    const api = window.electronAPI;
    if (!api) return true; // 非 Electron 环境直接放行
    const ok = await api.verifyAuthPassword(password);
    if (!ok) {
      errorMsg.value = "密码错误，请重试";
    }
    return ok;
  }

  async function changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    const api = window.electronAPI;
    if (!api) return { success: false, error: "非桌面环境" };
    return api.setAuthPassword(oldPassword, newPassword);
  }

  /** 弹出密码验证弹窗，返回是否验证通过 */
  function requireAuth(): Promise<boolean> {
    return new Promise((resolve) => {
      // 如果当前会话已通过，直接放行
      if (sessionAuthed.value) {
        resolve(true);
        return;
      }
      errorMsg.value = "";
      showDialog.value = true;
      pendingResolve = resolve;
    });
  }

  function onDialogConfirm(password: string) {
    verifyPassword(password).then((ok) => {
      if (ok) {
        sessionAuthed.value = true;
        showDialog.value = false;
        errorMsg.value = "";
        pendingResolve?.(true);
        pendingResolve = null;
      }
    });
  }

  function onDialogCancel() {
    showDialog.value = false;
    errorMsg.value = "";
    pendingResolve?.(false);
    pendingResolve = null;
  }

  function clearAuth() {
    sessionAuthed.value = false;
  }

  return {
    sessionAuthed,
    showDialog,
    errorMsg,
    requireAuth,
    verifyPassword,
    changePassword,
    onDialogConfirm,
    onDialogCancel,
    clearAuth,
  };
}
