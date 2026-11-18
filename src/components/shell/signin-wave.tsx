"use client";

import { useRef } from "react";

/** Crossfade into a second copy before the first reaches the end. */
const PLAYBACK_RATE = 0.65;

export function SigninWave() {
  const videos = useRef<(HTMLVideoElement | null)[]>([null, null]);
  const active = useRef(0);
  const fading = useRef(false);

  function beginFade(index: number) {
    const current = videos.current[index];
    const next = videos.current[1 - index];
    if (index !== active.current || fading.current || !current || !next || !Number.isFinite(current.duration)) return;
    const fadeSeconds = Math.min(2, current.duration / 4);
    if (current.duration - current.currentTime > fadeSeconds) return;
    fading.current = true;
    next.currentTime = 0;
    next.play().then(() => {
      next.style.transitionDuration = `${fadeSeconds / PLAYBACK_RATE}s`;
      current.style.transitionDuration = `${fadeSeconds / PLAYBACK_RATE}s`;
      next.style.opacity = "1";
      current.style.opacity = "0";
    }).catch(() => { fading.current = false; });
  }

  function finish(index: number) {
    if (index !== active.current) return;
    const current = videos.current[index];
    const next = videos.current[1 - index];
    if (!current || !next) return;
    if (!fading.current || next.paused) {
      current.currentTime = 0;
      void current.play().catch(() => {});
      return;
    }
    active.current = 1 - index;
    fading.current = false;
    current.pause();
    current.currentTime = 0;
  }

  return <div className="signin-circuit" aria-hidden="true">
    {[0, 1].map((index) => <video
      key={index}
      ref={(element) => {
        videos.current[index] = element;
        if (element) element.playbackRate = PLAYBACK_RATE;
      }}
      className="signin-wave-video"
      style={{ opacity: index === 0 ? 1 : 0 }}
      autoPlay={index === 0}
      muted
      playsInline
      preload="auto"
      poster="/images/signin-particle-wave.jpg"
      onTimeUpdate={() => beginFade(index)}
      onEnded={() => finish(index)}
    ><source src="/videos/ybryxwave.mp4" type="video/mp4" /></video>)}
  </div>;
}
