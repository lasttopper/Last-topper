import logoPng from "@/assets/logo.png";

export function TopperCoin({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={logoPng}
      alt="Topper Coin"
      width={size}
      height={size}
      className={`inline-block rounded-full align-[-2px] shadow-sm ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
