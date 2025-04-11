import React from "react";

const RefreshIcon = ({ width, height, color, ...props }) => (
  <svg
    width={width || 12}
    height={height || 12}
    viewBox="0 0 12 12"
    preserveAspectRatio="xMidYMid meet"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M7.5 3.422S8.071 3.14 6 3.14a3.75 3.75 0 1 0 3.75 3.75"
      stroke={color || "black"}
      strokeMiterlimit={10}
      strokeLinecap="square"
    />
    <path
      d="m6 1.36 1.875 1.874L6 5.11"
      stroke={color || "black"}
      strokeMiterlimit={10}
      strokeLinecap="square"
    />
  </svg>
);

export default RefreshIcon;
