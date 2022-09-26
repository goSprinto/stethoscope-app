import React from "react";

const LaptopIcon = ({ color, height, width, ...props }) => (
  <svg
    width={width || 64}
    height={height || 64}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.33301 50.6666H58.6663M10.6663 18.6666C10.6663 17.2521 11.2282 15.8955 12.2284 14.8953C13.2286 13.8952 14.5852 13.3333 15.9997 13.3333H47.9997C49.4142 13.3333 50.7707 13.8952 51.7709 14.8953C52.7711 15.8955 53.333 17.2521 53.333 18.6666V42.6666H10.6663V18.6666Z"
      stroke="black"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

export default LaptopIcon;
