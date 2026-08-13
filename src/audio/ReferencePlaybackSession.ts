export interface ReferencePlaybackState {
  status: "playing";
  id: number;
  startedAtAudioTime: number;
  startedAtBeat: number;
  endBeat: number;
  tempoQpm: number;
}

export class ReferencePlaybackSession {
  readonly state: ReferencePlaybackState;

  constructor(state: Omit<ReferencePlaybackState, "status">) {
    this.state = { status: "playing", ...state };
  }

  positionBeat(audioTime: number): number {
    const elapsedBeats = Math.max(0, audioTime - this.state.startedAtAudioTime) * this.state.tempoQpm / 60;
    return Math.min(this.state.endBeat, this.state.startedAtBeat + elapsedBeats);
  }

  isComplete(audioTime: number): boolean {
    return this.positionBeat(audioTime) >= this.state.endBeat;
  }
}
