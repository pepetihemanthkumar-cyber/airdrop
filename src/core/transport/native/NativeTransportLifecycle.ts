/**
 * NearShare Native Transport Lifecycle State Machine
 *
 * Enforces strict deterministic state transitions:
 *
 * Normal Lifecycle:
 * idle -> discovering -> connecting -> authenticating -> connected -> transferring -> paused -> reconnecting -> completed
 *
 * Terminal / Fault States:
 * disconnected, failed, cancelled
 */

export type NativeTransportLifecycleState =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'transferring'
  | 'paused'
  | 'reconnecting'
  | 'completed'
  | 'disconnected'
  | 'failed'
  | 'cancelled';

export interface LifecycleTransitionEvent {
  from: NativeTransportLifecycleState;
  to: NativeTransportLifecycleState;
  timestamp: number;
  reason?: string;
}

export type LifecycleListener = (event: LifecycleTransitionEvent) => void;

export class NativeTransportLifecycle {
  private currentState: NativeTransportLifecycleState = 'idle';
  private listeners: Set<LifecycleListener> = new Set();
  private history: LifecycleTransitionEvent[] = [];
  private isDestroyed = false;

  private static readonly ALLOWED_TRANSITIONS: Record<
    NativeTransportLifecycleState,
    readonly NativeTransportLifecycleState[]
  > = {
    idle: ['discovering', 'connecting', 'disconnected'],
    discovering: ['idle', 'connecting', 'failed', 'disconnected'],
    connecting: ['authenticating', 'connected', 'failed', 'disconnected', 'cancelled'],
    authenticating: ['connected', 'failed', 'disconnected', 'cancelled'],
    connected: ['transferring', 'idle', 'disconnected', 'failed', 'cancelled'],
    transferring: ['paused', 'completed', 'reconnecting', 'failed', 'cancelled', 'disconnected'],
    paused: ['transferring', 'cancelled', 'failed', 'disconnected'],
    reconnecting: ['authenticating', 'connected', 'failed', 'disconnected', 'cancelled'],
    completed: ['idle', 'disconnected'],
    disconnected: ['idle', 'connecting', 'discovering'],
    failed: ['idle', 'reconnecting', 'connecting'],
    cancelled: ['idle', 'disconnected'],
  };

  public getState(): NativeTransportLifecycleState {
    return this.currentState;
  }

  public getHistory(): readonly LifecycleTransitionEvent[] {
    return [...this.history];
  }

  public canTransitionTo(target: NativeTransportLifecycleState): boolean {
    if (this.isDestroyed) return false;
    const allowed = NativeTransportLifecycle.ALLOWED_TRANSITIONS[this.currentState];
    return allowed.includes(target);
  }

  public transition(to: NativeTransportLifecycleState, reason?: string): boolean {
    if (this.isDestroyed) {
      return false;
    }

    if (this.currentState === to) {
      return true; // No-op idempotent transition
    }

    if (!this.canTransitionTo(to)) {
      console.warn(
        `[NativeTransportLifecycle] Invalid state transition rejected: ${this.currentState} -> ${to} (Reason: ${reason || 'none'})`
      );
      return false;
    }

    const event: LifecycleTransitionEvent = {
      from: this.currentState,
      to,
      timestamp: Date.now(),
      reason,
    };

    this.currentState = to;
    this.history.push(event);

    // Keep history bounded to 100 transitions
    if (this.history.length > 100) {
      this.history.shift();
    }

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[NativeTransportLifecycle] Listener error:', err);
      }
    });

    return true;
  }

  public onTransition(listener: LifecycleListener): () => void {
    if (this.isDestroyed) {
      return () => {};
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public reset(): void {
    this.currentState = 'idle';
    this.history = [];
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.listeners.clear();
    this.history = [];
    this.currentState = 'disconnected';
  }
}
