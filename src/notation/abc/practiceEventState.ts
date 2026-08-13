export type PracticeEventState="pending"|"active"|"partial"|"correct"|"wrong"|"missed"|"preview-active"|"preview-complete";
export interface PracticeEventVisual { state:PracticeEventState; progress?:number; earlyReleaseAt?:number }
export type PracticeEventVisuals=Readonly<Record<string,PracticeEventVisual>>;
