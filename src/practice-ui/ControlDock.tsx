import type { ReactNode } from "react";

export function ControlDock({label,children}:{label:string;children:ReactNode}){
  return <section className="control-dock" aria-label={label}>{children}</section>;
}

export function ControlGroup({label,children,wide=false}:{label?:string;children:ReactNode;wide?:boolean}){
  return <div className={`control-group${wide?" control-group-wide":""}`}>{label&&<span className="control-group-label">{label}</span>}{children}</div>;
}

export function CompactField({label,children}:{label:string;children:ReactNode}){
  return <label className="compact-field"><span>{label}</span>{children}</label>;
}

export function SettingsPopover({label,summary,children}:{label:string;summary:string;children:ReactNode}){
  return <details className="settings-popover"><summary><span>{label}</span><b>{summary}</b></summary><div className="popover-panel">{children}</div></details>;
}
