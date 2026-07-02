import React from "react";

interface MascotIconProps {
  character?: "moa" | "puri" | "mori";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function MascotIcon({
  character = "moa",
  className = "",
  size = "md",
}: MascotIconProps) {
  // Use the gorgeous high-fidelity yellow character image uploaded in the PRD.
  const imageUrl =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuC2eH7tOZOTgBRRKKU3kg1QZZZZuJIWosaGxyarxxmK49CLTfFWmh3mJNxXkxruIYzcSFK-peUsF2ReRS6YGJAZVPhxvsdlvCVdUe5yjENgNTdvi_ddiCCrNFIG6ul1FYgiOse4uPqLd3nxFQtVvwQ9JlBtqW-Z7w3_83jagKxQg3eWhtZIX5Et_42pVoHEBdYnM12RunEXX6RFg7V6tFwPNT7KUt7oVWKRg1YNjwsVtVxXrhOC7x1f";

  const sizeClasses = {
    sm: "w-10 h-10 rounded-xl",
    md: "w-16 h-16 rounded-2xl",
    lg: "w-24 h-24 rounded-3xl",
    xl: "w-40 h-40 md:w-56 md:h-56 rounded-[2rem]",
  };

  // Give subtle tint overlay or rotation styling depending on character
  const filterStyle =
    character === "puri"
      ? { filter: "hue-rotate(90deg)" } // Green pury
      : character === "mori"
      ? { filter: "hue-rotate(180deg) saturate(1.2)" } // Blue/purple mori
      : {};

  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-primary-container border-2 border-primary-brand mascot-float shadow-md ${sizeClasses[size]} ${className}`}
    >
      <img
        src={imageUrl}
        alt={`${character} mascot`}
        className="w-full h-full object-cover"
        style={filterStyle}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
