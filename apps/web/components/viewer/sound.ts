// 종이 넘기는 소리 — 파일 없이 WebAudio로 만든다 (짧은 잡음 + 대역 필터 + 감쇠)

let ctx: AudioContext | null = null;

export function playFlipSound(volume = 0.35) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const dur = 0.32;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // 앞쪽이 굵고 뒤로 갈수록 사그라드는 바스락 소리
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * (0.6 + 0.4 * Math.sin(t * 40));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(2600, ctx.currentTime);
    band.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + dur);
    band.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(band).connect(gain).connect(ctx.destination);
    src.start();
  } catch {
    // 소리를 낼 수 없는 환경은 조용히 넘어간다
  }
}
