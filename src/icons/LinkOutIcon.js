import React from "react";

const LinkOutIcon = ({ color, height, width, ...props }) => (
  <svg
    width={width || 12}
    height={height || 13}
    viewBox="0 0 12 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.75 5.85001L10.5 2.10001"
      stroke="#0044CC"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 2.10001H10.5V4.60001"
      stroke="#0044CC"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.5 7.60001V10.1C10.5 10.3652 10.3946 10.6196 10.2071 10.8071C10.0196 10.9946 9.76522 11.1 9.5 11.1H2.5C2.23478 11.1 1.98043 10.9946 1.79289 10.8071C1.60536 10.6196 1.5 10.3652 1.5 10.1V3.10001C1.5 2.83479 1.60536 2.58044 1.79289 2.3929C1.98043 2.20536 2.23478 2.10001 2.5 2.10001H5"
      stroke="#0044CC"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default LinkOutIcon;
