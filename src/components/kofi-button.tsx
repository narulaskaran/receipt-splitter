import React from "react";

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
        <img
          height="36"
          style={{ border: 0, height: "40px" }}
          src="https://storage.ko-fi.com/cdn/kofi3.png?v=6"
          alt="Buy Me a Coffee at ko-fi.com"
        />
      </a>
    </div>
  );
};
