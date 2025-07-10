export class KeepAliveTimer {
  private keepAliveTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private isRetry = false;
  private retryCount = 0;
  private readonly onTimeout: () => void;
  private readonly onKeepAlive: () => void;

/** The amount of milliseconds we wait before sending the initial keepalive packet  */
  static readonly INITIAL_TIMEOUT = 5000;
/** The amount of milliseconds we wait after sending a new retry packet  */
  static readonly RETRY_TIMEOUT = 2500;
/** The amount of retries we do before we declare the socket dead */
  static readonly RETRY_COUNT = 3;

  constructor(onKeepAlive: () => void, onTimeout: () => void) {
    this.onKeepAlive = onKeepAlive;
    this.onTimeout = onTimeout;
  }

  start() {
    this.clear();
    this.isRetry = false;
    this.retryCount = 0;

    this.retryTimer = setTimeout(() => {
      if (!this.isRetry) return;
      this.onKeepAlive();
      this.retryCount++;
      if (this.retryCount >= KeepAliveTimer.RETRY_COUNT) {
        this.clear();
        this.onTimeout();
      } else {
        this.retryTimer?.refresh();
      }
    }, KeepAliveTimer.RETRY_TIMEOUT);

    this.keepAliveTimer = setTimeout(() => {
      this.onKeepAlive();
      this.isRetry = true;
      this.retryTimer?.refresh();
    }, KeepAliveTimer.INITIAL_TIMEOUT);
  }

  refresh() {
    this.isRetry = false;
    this.retryCount = 0;
    this.keepAliveTimer?.refresh();
  }

  clear() {
    if (this.keepAliveTimer) clearTimeout(this.keepAliveTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
}