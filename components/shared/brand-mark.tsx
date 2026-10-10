import Image from "next/image";

/** The adjacent wordmark supplies the accessible product name. */
export function BrandMark({ size = 32 }: { size?: 28 | 32 }) {
  return <Image src="/brand/dealpatch-logo.png" alt="" aria-hidden="true" width={size} height={size} unoptimized className="shrink-0 object-contain" />;
}
