import React from "react";
import RefreshIcon from "../icons/RefreshIcon";

const ButtonLink = ({
  title,
  onClickOpen,
  redirectURI,
  icon,
  disabled = false,
}) => {
  return (
    <>
      <a
        disabled={disabled}
        href={redirectURI}
        className="m-0 text-blue-500"
        style={{
          backgroundColor: "unset",
          border: "unset",
          boxShadow: "unset",
          textDecoration: "none",
        }}
        onClick={onClickOpen}
      >
        {icon && <RefreshIcon />} {title}
      </a>
    </>
  );
};

export default ButtonLink;
