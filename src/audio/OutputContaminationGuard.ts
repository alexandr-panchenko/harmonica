export class OutputContaminationGuard {
  private blockedUntil = 0;
  constructor(private readonly tailMs = 180) {}
  blockFor(durationMs: number, nowMs = performance.now()): void { this.blockedUntil = Math.max(this.blockedUntil, nowMs + durationMs + this.tailMs); }
  releaseAfterTail(nowMs = performance.now()): void { this.blockedUntil = nowMs + this.tailMs; }
  isBlocked(nowMs = performance.now()): boolean { return nowMs < this.blockedUntil; }
  reset(): void { this.blockedUntil = 0; }
}
