import { WeatherWidget } from "@/components/dashboard/weather-widget";
import { DigitalClock } from "@/components/dashboard/digital-clock";
import { HeaderCenter } from "@/components/dashboard/header-center";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export function StatusBar() {
  return (
    <div className="status-bar grid w-full shrink-0 grid-cols-3 items-center px-8 py-2.5">
      <div className="justify-self-start">
        <WeatherWidget />
      </div>
      <div className="justify-self-center">
        <HeaderCenter />
      </div>
      <div className="flex items-center justify-self-end gap-3">
        <ThemeToggle />
        <NotificationBell />
        <DigitalClock align="right" />
      </div>
    </div>
  );
}
