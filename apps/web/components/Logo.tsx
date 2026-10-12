/** 펼친 책 모양 로고 + 글자 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="eb-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9179fb" />
          <stop offset="1" stopColor="#532bc8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#eb-logo)" />
      <path d="M8 10.5c2.6-.9 5.1-.6 7.4 1v11.2c-2.3-1.5-4.8-1.8-7.4-1V10.5Z" fill="#fff" opacity=".95" />
      <path d="M24 10.5c-2.6-.9-5.1-.6-7.4 1v11.2c2.3-1.5 4.8-1.8 7.4-1V10.5Z" fill="#fff" opacity=".7" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight">Ebook Maker</span>
    </span>
  );
}
