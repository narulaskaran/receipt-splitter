import type { ImgHTMLAttributes } from "react";

type NextImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

/** Stand-in for next/image in the Vite iOS bundle. */
export default function NextImage({ alt, priority, ...props }: NextImageProps) {
  void priority;
  return <img alt={alt} {...props} />;
}
