import { ColorDemoShell } from "../_shared/color-demo-shell";

export default function CommandLightLayout({ children }: { children: React.ReactNode }) {
  return <ColorDemoShell themeClass="theme-command-light">{children}</ColorDemoShell>;
}
