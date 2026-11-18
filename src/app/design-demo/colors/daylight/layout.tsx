import { ColorDemoShell } from "../_shared/color-demo-shell";

export default function DaylightLayout({ children }: { children: React.ReactNode }) {
  return <ColorDemoShell themeClass="theme-daylight">{children}</ColorDemoShell>;
}
