type SyncStatusListener = (pendingCount: number) => void;

class SyncStore {
  private pendingCount: number = 0;
  private listeners: Set<SyncStatusListener> = new Set();

  getPendingCount(): number {
    return this.pendingCount;
  }

  setPendingCount(count: number): void {
    this.pendingCount = count;
    this.notifyListeners();
  }

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.pendingCount);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.pendingCount));
  }
}

export const syncStore = new SyncStore();

if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_STATUS') {
      syncStore.setPendingCount(event.data.pendingCount || 0);
    }
  });

  const getSyncStatus = () => {
    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data && event.data.type === 'SYNC_STATUS') {
        syncStore.setPendingCount(event.data.pendingCount || 0);
      }
    };

    navigator.serviceWorker.controller?.postMessage(
      { type: 'GET_SYNC_STATUS' },
      [messageChannel.port2]
    );
  };

  getSyncStatus();
  setInterval(getSyncStatus, 5000);
}
