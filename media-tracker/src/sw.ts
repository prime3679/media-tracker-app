import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { Queue } from 'workbox-background-sync';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
self.clients.claim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

interface QueuedRequest {
  request: Request;
  timestamp?: number;
  metadata?: {
    attemptCount?: number;
  };
}

const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 32000;
const MAX_RETENTION_TIME = 24 * 60;

const writeQueue = new Queue('writeQueue', {
  maxRetentionTime: MAX_RETENTION_TIME,
  onSync: async ({ queue }) => {
    let entry: QueuedRequest | undefined;
    const pendingRequests: QueuedRequest[] = [];
    
    while ((entry = await queue.shiftRequest())) {
      pendingRequests.push(entry);
    }

    for (const entry of pendingRequests) {
      const attemptCount = (entry.metadata?.attemptCount || 0) + 1;
      const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attemptCount - 1), MAX_RETRY_DELAY);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        const clonedRequest = entry.request.clone();
        const response = await fetch(clonedRequest);
        
        if (!response.ok) {
          if (response.status >= 500 || response.status === 429) {
            entry.metadata = { attemptCount };
            await queue.unshiftRequest(entry);
            throw new Error(`Server error: ${response.status}`);
          }
        } else {
          await broadcastSyncStatus();
        }
      } catch (error) {
        entry.metadata = { attemptCount };
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
    
    await broadcastSyncStatus();
  },
});

registerRoute(
  ({ url, request }) => {
    return (
      (url.pathname.startsWith('/api/v1/media') && request.method === 'POST') ||
      (url.pathname.match(/\/api\/v1\/media\/\d+\/tracking/) && request.method === 'PUT')
    );
  },
  async ({ request }) => {
    const idempotencyKey = request.headers.get('idempotency-key');
    
    let requestToSend = request;
    if (!idempotencyKey) {
      const newHeaders = new Headers(request.headers);
      newHeaders.set('idempotency-key', crypto.randomUUID());
      
      requestToSend = new Request(request, {
        headers: newHeaders,
      });
    }
    
    try {
      const response = await fetch(requestToSend.clone());
      await broadcastSyncStatus();
      return response;
    } catch {
      await writeQueue.pushRequest({ request: requestToSend });
      await broadcastSyncStatus();
      
      return new Response(
        JSON.stringify({ 
          queued: true, 
          message: 'Request queued for background sync' 
        }),
        { 
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
);

async function broadcastSyncStatus() {
  const queueSize = await writeQueue.size();
  const clients = await self.clients.matchAll();
  
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_STATUS',
      pendingCount: queueSize,
    });
  });
}

self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'GET_SYNC_STATUS') {
    const queueSize = await writeQueue.size();
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        type: 'SYNC_STATUS',
        pendingCount: queueSize,
      });
    }
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'writeQueue') {
    event.waitUntil(writeQueue.replayRequests());
  }
});

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ request }) => {
    try {
      return await fetch(request);
    } catch {
      const cache = await caches.open('workbox-precache-v2');
      const cachedResponse = await cache.match('/index.html');
      if (cachedResponse) {
        return cachedResponse;
      }
      throw new Error('Failed to fetch navigation request');
    }
  }
);
