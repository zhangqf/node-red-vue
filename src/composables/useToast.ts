import { ref } from "vue";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error";
}

const toasts = ref<ToastItem[]>([]);
const loading = ref(false);
let toastId = 0;

export function useToast() {
  function showToast(message: string, type: "success" | "error" = "success") {
    const id = ++toastId;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3000);
  }

  function showLoading() {
    loading.value = true;
  }

  function hideLoading() {
    loading.value = false;
  }

  async function withLoading<T>(fn: () => Promise<T>, okMsg?: string): Promise<T> {
    showLoading();
    try {
      const result = await fn();
      if (okMsg) showToast(okMsg, "success");
      return result;
    } catch (e: any) {
      showToast(e?.message || "请求失败", "error");
      throw e;
    } finally {
      hideLoading();
    }
  }

  return { toasts, loading, showToast, showLoading, hideLoading, withLoading };
}
