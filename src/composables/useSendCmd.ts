import type { UseSocketReturn } from "./useSocket";

interface SendCmdOptions {
  ws: UseSocketReturn;
}

export const useSendCmd = (option: SendCmdOptions) => {
  const { ws } = option;

  const sendCmd = (cmd: string, payload: Record<string, any> = {}) => {
    const sendData = {
      type: cmd,
      payload,
    };
    ws.send(sendData);
  };

  const sendCmdWithDelay = (
    cmd: string,
    payload: Record<string, any> = {},
    delay: number,
  ) => {
    setTimeout(() => {
      sendCmd(cmd, payload);
    }, delay);
  };

  const sendCmdWithInterval = (
    cmd: string,
    payload: Record<string, any> = {},
    interval: number,
    count: number,
  ) => {
    let sentCount = 0;
    const intervalId = setInterval(() => {
      if (sentCount < count) {
        sendCmd(cmd, payload);
        sentCount++;
      } else {
        clearInterval(intervalId);
      }
    }, interval);
  };

  const sendCmdWithTimeout = (
    cmd: string,
    payload: Record<string, any> = {},
    timeout: number,
  ) => {
    const timeoutId = setTimeout(() => {
      sendCmd(cmd, payload);
    }, timeout);

    return () => clearTimeout(timeoutId);
  };

  const sendCmdWithRetry = (
    cmd: string,
    payload: Record<string, any> = {},
    retries: number,
    delay: number,
  ) => {
    let attempt = 0;

    const sendWithRetry = () => {
      if (attempt < retries) {
        sendCmd(cmd, payload);
        attempt++;
        setTimeout(sendWithRetry, delay);
      }
    };

    sendWithRetry();
  };

  const sendCmdWithDebounce = (
    cmd: string,
    payload: Record<string, any> = {},
    delay: number,
  ) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        sendCmd(cmd, payload);
      }, delay);
    };
  };

  const sendCmdWithThrottle = (
    cmd: string,
    payload: Record<string, any> = {},
    interval: number,
  ) => {
    let lastSentTime = 0;

    return () => {
      const now = Date.now();
      if (now - lastSentTime >= interval) {
        sendCmd(cmd, payload);
        lastSentTime = now;
      }
    };
  };

  const sendCmdWithCondition = (
    cmd: string,
    payload: Record<string, any> = {},
    condition: () => boolean,
  ) => {
    if (condition()) {
      sendCmd(cmd, payload);
    }
  };

  const sendCmdWithPromise = (
    cmd: string,
    payload: Record<string, any> = {},
  ) => {
    return new Promise<void>((resolve) => {
      sendCmd(cmd, payload);
      resolve();
    });
  };

  const sendCmdWithCallback = (
    cmd: string,
    payload: Record<string, any> = {},
    callback: () => void,
  ) => {
    sendCmd(cmd, payload);
    callback();
  };

  const sendCmdWithAsyncAwait = async (
    cmd: string,
    payload: Record<string, any> = {},
  ) => {
    await sendCmdWithPromise(cmd, payload);
  };

  const sendCmdWithEvent = (
    cmd: string,
    payload: Record<string, any> = {},
    event: string,
  ) => {
    sendCmd(cmd, payload);
    ws.registerEvent(event, () => {
      console.log(`Event ${event} received after sending command ${cmd}`);
    });
  };

  const sendCmdWithLogging = (
    cmd: string,
    payload: Record<string, any> = {},
  ) => {
    console.log(`Sending command: ${cmd} with payload:`, payload);
    sendCmd(cmd, payload);
  };

  const sendCmdWithErrorHandling = (
    cmd: string,
    payload: Record<string, any> = {},
    errorHandler: (error: any) => void,
  ) => {
    try {
      sendCmd(cmd, payload);
    } catch (error) {
      errorHandler(error);
    }
  };

  const sendCmdWithValidation = (
    cmd: string,
    payload: Record<string, any> = {},
    validator: (payload: Record<string, any>) => boolean,
  ) => {
    if (validator(payload)) {
      sendCmd(cmd, payload);
    } else {
      console.error(`Payload validation failed for command ${cmd}:`, payload);
    }
  };

  const sendCmdWithTransformation = (
    cmd: string,
    payload: Record<string, any> = {},
    transformer: (payload: Record<string, any>) => Record<string, any>,
  ) => {
    const transformedPayload = transformer(payload);
    sendCmd(cmd, transformedPayload);
  };

  const sendCmdWithQueue = (() => {
    const queue: Array<{ cmd: string; payload: Record<string, any> }> = [];
    let isSending = false;

    const processQueue = () => {
      if (queue.length > 0 && !isSending) {
        isSending = true;
        const { cmd, payload } = queue.shift()!;
        sendCmd(cmd, payload);
        isSending = false;
        processQueue();
      }
    };

    return (cmd: string, payload: Record<string, any> = {}) => {
      queue.push({ cmd, payload });
      processQueue();
    };
  })();

  const sendCmdWithBatch = (
    commands: Array<{ cmd: string; payload: Record<string, any> }>,
  ) => {
    commands.forEach(({ cmd, payload }) => {
      sendCmd(cmd, payload);
    });
  };

  const sendCmdWithPriority = (() => {
    const priorityQueue: Array<{
      cmd: string;
      payload: Record<string, any>;
      priority: number;
    }> = [];
    let isSending = false;

    const processQueue = () => {
      if (priorityQueue.length > 0 && !isSending) {
        isSending = true;
        priorityQueue.sort((a, b) => b.priority - a.priority);
        const { cmd, payload } = priorityQueue.shift()!;
        sendCmd(cmd, payload);
        isSending = false;
        processQueue();
      }
    };

    return (
      cmd: string,
      payload: Record<string, any> = {},
      priority: number = 0,
    ) => {
      priorityQueue.push({ cmd, payload, priority });
      processQueue();
    };
  })();

  const sendCmdWithDebounceAndThrottle = (
    cmd: string,
    payload: Record<string, any> = {},
    debounceDelay: number,
    throttleInterval: number,
  ) => {
    let lastSentTime = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return () => {
      const now = Date.now();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        if (now - lastSentTime >= throttleInterval) {
          sendCmd(cmd, payload);
          lastSentTime = now;
        }
      }, debounceDelay);
    };
  };

  const sendCmdWithRetryAndTimeout = (
    cmd: string,
    payload: Record<string, any> = {},
    retries: number,
    delay: number,
    timeout: number,
  ) => {
    let attempt = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const sendWithRetry = () => {
      if (attempt < retries) {
        sendCmd(cmd, payload);
        attempt++;
        timeoutId = setTimeout(sendWithRetry, delay);
      } else {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    timeoutId = setTimeout(() => {
      if (attempt < retries) {
        sendWithRetry();
      }
    }, timeout);

    sendWithRetry();
  };

  const sendCmdWithDebounceAndRetry = (
    cmd: string,
    payload: Record<string, any> = {},
    debounceDelay: number,
    retries: number,
    delay: number,
  ) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const sendWithRetry = () => {
      if (attempt < retries) {
        sendCmd(cmd, payload);
        attempt++;
        timeoutId = setTimeout(sendWithRetry, delay);
      }
    };

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        sendWithRetry();
      }, debounceDelay);
    };
  };

  return {
    sendCmd,
    sendCmdWithDelay,
    sendCmdWithInterval,
    sendCmdWithTimeout,
    sendCmdWithRetry,
    sendCmdWithDebounce,
    sendCmdWithThrottle,
    sendCmdWithCondition,
    sendCmdWithPromise,
    sendCmdWithCallback,
    sendCmdWithAsyncAwait,
    sendCmdWithEvent,
    sendCmdWithLogging,
    sendCmdWithErrorHandling,
    sendCmdWithValidation,
    sendCmdWithTransformation,
    sendCmdWithQueue,
    sendCmdWithBatch,
    sendCmdWithPriority,
  };
};
