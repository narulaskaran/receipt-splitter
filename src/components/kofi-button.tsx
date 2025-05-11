import React from "react";
import Image from "next/image";

interface KofiButtonProps {
  className?: string;
}

export const KofiButton: React.FC<KofiButtonProps> = ({ className }) => {
  return (
    <div className={className}>
      <a
        href="https://ko-fi.com/Y8Y21CC8IA"
        target="_blank"
        rel="noopener noreferrer"
        className="transform scale-75 transition-all hover:scale-[.755] hover:brightness-110"
      >
        <Image
          height={40}
          width={160}
          style={{ border: 0 }}
          src="https://storage.ko-fi.com/cdn/kofi3.png?v=6"
          alt="Buy Me a Coffee at ko-fi.com"
        />
      </a>
    </div>
  );
};
