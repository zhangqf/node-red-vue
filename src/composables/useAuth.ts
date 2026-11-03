import { ref } from "vue";

const sessionAuthed = ref(false);
const showDialog = ref(false);
const errorMsg = ref("");
const authExpiresAt = ref<number | null>(null);
const ASSET_UNLOCK_TTL = 10 * 60 * 1000;
// 本地设备资产入口密码；仅用于页面入口控制，不能保证真正的安全性。
const LOCAL_ASSET_PASSWORD = "admin888";
let authTimer: number | undefined;
let pendingResolve: ((v: boolean) => void) | null = null;

export function useAuth() {
  async function verifyPassword(password: string): Promise<boolean> {
    const ok = password === LOCAL_ASSET_PASSWORD;
    if (!ok) {
      errorMsg.value = "密码错误，请重试";
    }
    return ok;
  }

  /** 检查并回收已过期的资产授权 */
  function hasValidAuth(): boolean {
    if (
      !sessionAuthed.value ||
      authExpiresAt.value === null ||
      Date.now() < authExpiresAt.value
    ) {
      return sessionAuthed.value;
    }
    clearAuth();
    return false;
  }

  /** 授予资产权限，默认 10 分钟后自动隐藏 */
  function grantAuth(ttl = ASSET_UNLOCK_TTL) {
    window.clearTimeout(authTimer);
    sessionAuthed.value = true;
    authExpiresAt.value = Date.now() + ttl;
    authTimer = window.setTimeout(() => {
      clearAuth();
    }, ttl);
  }

  /** 使用资产密码解锁资产功能，成功后默认显示 10 分钟 */
  async function unlockDeviceAssets(password: string): Promise<boolean> {
    const ok = await verifyPassword(password);
    if (ok) {
      grantAuth();
    }
    return ok;
  }

  /** 弹出密码验证弹窗，返回是否验证通过 */
  function requireAuth(): Promise<boolean> {
    return new Promise((resolve) => {
      // 如果当前会话已通过，直接放行
      if (hasValidAuth()) {
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
        grantAuth();
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
    window.clearTimeout(authTimer);
    authTimer = undefined;
    sessionAuthed.value = false;
    authExpiresAt.value = null;
  }

  return {
    sessionAuthed,
    authExpiresAt,
    assetUnlockTtl: ASSET_UNLOCK_TTL,
    showDialog,
    errorMsg,
    requireAuth,
    verifyPassword,
    unlockDeviceAssets,
    grantAuth,
    hasValidAuth,
    onDialogConfirm,
    onDialogCancel,
    clearAuth,
  };
}
