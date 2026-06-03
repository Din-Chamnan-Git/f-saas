import Image from "next/image";

type TecheyLogoProps = {
  className?: string;
  compact?: boolean;
};

export function TecheyLogo({ className, compact = false }: TecheyLogoProps) {
  const src = compact ? "/techey-mark.svg" : "/techey-logo.svg";
  const width = compact ? 512 : 1200;
  const height = compact ? 512 : 900;

  return (
    <Image
      src={src}
      alt="Techey Infinite Precision Khmer Solution"
      width={width}
      height={height}
      priority
      className={className ?? "h-auto w-full"}
      sizes={compact ? "96px" : "(max-width: 768px) 260px, 320px"}
    />
  );
}
