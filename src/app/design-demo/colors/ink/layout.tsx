import { ColorDemoShell } from "../_shared/color-demo-shell";

export default function InkLayout({ children }: { children: React.ReactNode }) {
  return <ColorDemoShell themeClass="theme-ink">{children}</ColorDemoShell>;
}
