export type PracticeEventState="pending"|"active"|"partial"|"correct"|"wrong"|"missed";
export interface PracticeEventVisual { state:PracticeEventState; progress?:number; earlyReleaseAt?:number }
export type PracticeEventVisuals=Readonly<Record<string,PracticeEventVisual>>;

