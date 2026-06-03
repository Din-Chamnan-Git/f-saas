import Image from "next/image";

type TecheyLogoProps = {
  className?: string;
  compact?: boolean;
};

export function TecheyLogo({ className, compact = false }: TecheyLogoProps) {
  const src = "/images/logo1.png";
  const width = 1024;
  const height = 1024;

  return (
    <Image
      src={src}
      alt="Techey Infinite Precision Khmer Solution"
      width={width}
      height={height}
      priority
      className={className ?? "h-auto w-full object-contain"}
      sizes={compact ? "96px" : "(max-width: 768px) 260px, 320px"}
    />
  );
}
