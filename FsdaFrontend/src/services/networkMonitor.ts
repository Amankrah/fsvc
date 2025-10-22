/**
 * Network Monitor Service
 * Monitors internet connectivity and triggers sync on reconnection
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkChangeCallback = (isConnected: boolean) => void;

class NetworkMonitor {
  private isConnected: boolean = true;
  private listeners: Set<NetworkChangeCallback> = new Set();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Subscribe to network state changes
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected ?? false;

      // Notify listeners on state change
      if (wasConnected !== this.isConnected) {
        console.log(`Network status changed: ${this.isConnected ? 'ONLINE' : 'OFFLINE'}`);
        this.notifyListeners();
      }
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      this.isConnected = state.isConnected ?? false;
      console.log(`Initial network status: ${this.isConnected ? 'ONLINE' : 'OFFLINE'}`);
    });
  }

  /**
   * Check if device is currently connected to internet
   */
  async checkConnection(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.isConnected = state.isConnected ?? false;
    return this.isConnected;
  }

  /**
   * Get current connection status (synchronous)
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Subscribe to network status changes
   */
  addListener(callback: NetworkChangeCallback): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Remove a specific listener
   */
  removeListener(callback: NetworkChangeCallback): void {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of network change
   */
  private notifyListeners(): void {
    this.listeners.forEach((callback) => {
      try {
        callback(this.isConnected);
      } catch (error) {
        console.error('Error in network listener callback:', error);
      }
    });
  }

  /**
   * Clean up subscriptions
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners.clear();
  }

  /**
   * Get detailed connection info
   */
  async getConnectionInfo(): Promise<{
    isConnected: boolean;
    type: string;
    isInternetReachable: boolean | null;
    details: any;
  }> {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected ?? false,
      type: state.type,
      isInternetReachable: state.isInternetReachable,
      details: state.details,
    };
  }
}

export const networkMonitor = new NetworkMonitor();
export default networkMonitor;
