import { ColorDemoShell } from "../_shared/color-demo-shell";

export default function SlateLayout({ children }: { children: React.ReactNode }) {
  return <ColorDemoShell themeClass="theme-slate">{children}</ColorDemoShell>;
}
