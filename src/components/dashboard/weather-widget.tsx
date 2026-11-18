"use client";

import { useEffect, useState } from "react";
import { Loader2, CloudOff, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog } from "lucide-react";

type WeatherState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error" }
  | { status: "ready"; tempF: number; code: number; place: string };

/** WMO weather codes -> icon + label. https://open-meteo.com/en/docs */
function describeCode(code: number) {
  if (code === 0) return { label: "Clear sky", Icon: Sun };
  if ([1, 2].includes(code)) return { label: "Partly cloudy", Icon: Sun };
  if (code === 3) return { label: "Overcast", Icon: Cloud };
  if ([45, 48].includes(code)) return { label: "Fog", Icon: CloudFog };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { label: "Rain", Icon: CloudRain };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", Icon: CloudSnow };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", Icon: CloudLightning };
  return { label: "Cloudy", Icon: Cloud };
}

export function WeatherWidget() {
  const [state, setState] = useState<WeatherState>({ status: "loading" });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const t = setTimeout(() => setState({ status: "error" }), 0);
      return () => clearTimeout(t);
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const [weatherRes, placeRes] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`,
            ),
            fetch(
              `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${coords.latitude}&longitude=${coords.longitude}&count=1`,
            ).catch(() => null),
          ]);
          if (!weatherRes.ok) throw new Error("weather fetch failed");
          const weather = await weatherRes.json();
          const place = placeRes && placeRes.ok ? await placeRes.json() : null;
          const placeName = place?.results?.[0]?.name ?? "Current location";
          setState({
            status: "ready",
            tempF: Math.round(weather.current.temperature_2m),
            code: weather.current.weather_code,
            place: placeName,
          });
        } catch {
          setState({ status: "error" });
        }
      },
      () => setState({ status: "denied" }),
      { timeout: 10_000 },
    );
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Locating…
      </div>
    );
  }

  if (state.status === "denied" || state.status === "error") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CloudOff className="size-5" />
        {state.status === "denied" ? "Location access denied" : "Weather unavailable"}
      </div>
    );
  }

  const { label, Icon } = describeCode(state.code);

  return (
    <div className="flex items-center gap-4">
      <Icon className="size-10 text-accent" />
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">{state.tempF}°F</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">{state.place}</span>
      </div>
    </div>
  );
}
