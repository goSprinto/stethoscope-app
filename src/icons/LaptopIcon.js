import React from "react";

const LaptopIcon = ({ color, height, width, ...props }) => (
  <svg
    width={width || "48"}
    height={height || "48"}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 38H44M8 14C8 12.9391 8.42143 11.9217 9.17157 11.1716C9.92172 10.4214 10.9391 10 12 10H36C37.0609 10 38.0783 10.4214 38.8284 11.1716C39.5786 11.9217 40 12.9391 40 14V32H8V14Z"
      stroke={"#37495C"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default LaptopIcon;
