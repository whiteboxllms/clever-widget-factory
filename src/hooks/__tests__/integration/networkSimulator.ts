/**
 * Network Simulator for Integration Tests
 * 
 * Simulates network conditions for testing offline/online scenarios
 */

export interface NetworkCondition {
  online: boolean;
  latency?: number; // milliseconds
  errorRate?: number; // 0-1 probability of request failure
  bandwidth?: number; // bytes per second (for future use)
}

export class NetworkSimulator {
  private originalFetch: typeof fetch;
  private isSimulating: boolean = false;
  private currentCondition: NetworkCondition = { online: true };
  private interceptedRequests: Array<{
    url: string;
    options: RequestInit;
    timestamp: number;
    resolve: (response: Response) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor() {
    this.originalFetch = window.fetch;
  }

  /**
   * Start network simulation with given conditions
   */
  startSimulation(condition: NetworkCondition): void {
    if (this.isSimulating) {
      throw new Error('Network simulation already active');
    }

    this.isSimulating = true;
    this.currentCondition = condition;
    
    // Replace global fetch with our simulator
    window.fetch = this.simulatedFetch.bind(this);
    
    console.log('Network simulation started:', condition);
  }

  /**
   * Stop network simulation and restore original fetch
   */
  stopSimulation(): void {
    if (!this.isSimulating) {
      return;
    }

    this.isSimulating = false;
    window.fetch = this.originalFetch;
    
    console.log('Network simulation stopped');
  }

  /**
   * Simulate going offline
   */
  goOffline(): void {
    if (!this.isSimulating) {
      this.startSimulation({ online: false });
    } else {
      this.currentCondition.online = false;
      console.log('Network simulation: went offline');
    }
  }

  /**
   * Simulate going online and process queued requests
   */
  async goOnline(): Promise<void> {
    if (!this.isSimulating) {
      this.startSimulation({ online: true });
    } else {
      this.currentCondition.online = true;
      console.log('Network simulation: went online');
      
      // Process any queued requests
      await this.processQueuedRequests();
    }
  }

  /**
   * Get the number of requests currently queued (offline)
   */
  getQueuedRequestCount(): number {
    return this.interceptedRequests.length;
  }

  /**
   * Clear all queued requests (simulate network failure)
   */
  clearQueuedRequests(): void {
    this.interceptedRequests.forEach(req => {
      req.reject(new Error('Network request cleared'));
    });
    this.interceptedRequests = [];
    console.log('Network simulation: cleared queued requests');
  }

  /**
   * Simulated fetch function
   */
  private async simulatedFetch(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
    const urlString = url.toString();
    
    // Check if we should simulate an error
    if (this.currentCondition.errorRate && Math.random() < this.currentCondition.errorRate) {
      throw new Error('Simulated network error');
    }

    // If offline, queue the request
    if (!this.currentCondition.online) {
      return new Promise((resolve, reject) => {
        this.interceptedRequests.push({
          url: urlString,
          options,
          timestamp: Date.now(),
          resolve,
          reject
        });
        console.log(`Network simulation: queued request to ${urlString}`);
      });
    }

    // If online, add latency if specified
    if (this.currentCondition.latency && this.currentCondition.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.currentCondition.latency));
    }

    // Make the actual request
    return this.originalFetch(url, options);
  }

  /**
   * Process all queued requests when going back online
   */
  private async processQueuedRequests(): Promise<void> {
    const requests = [...this.interceptedRequests];
    this.interceptedRequests = [];

    console.log(`Network simulation: processing ${requests.length} queued requests`);

    // Process requests in order (FIFO)
    for (const request of requests) {
      try {
        const response = await this.originalFetch(request.url, request.options);
        request.resolve(response);
        console.log(`Network simulation: processed queued request to ${request.url}`);
      } catch (error) {
        request.reject(error as Error);
        console.error(`Network simulation: failed to process queued request to ${request.url}:`, error);
      }
    }
  }

  /**
   * Simulate network conditions for a specific duration
   */
  async simulateConditionForDuration(condition: NetworkCondition, durationMs: number): Promise<void> {
    const wasSimulating = this.isSimulating;
    const previousCondition = { ...this.currentCondition };

    if (!wasSimulating) {
      this.startSimulation(condition);
    } else {
      this.currentCondition = condition;
    }

    await new Promise(resolve => setTimeout(resolve, durationMs));

    if (!wasSimulating) {
      this.stopSimulation();
    } else {
      this.currentCondition = previousCondition;
    }
  }

  /**
   * Cleanup - ensure simulation is stopped
   */
  cleanup(): void {
    if (this.isSimulating) {
      this.clearQueuedRequests();
      this.stopSimulation();
    }
  }
}