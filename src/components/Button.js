import React from "react";
import classNames from "classnames";
import RefreshIcon from "../icons/RefreshIcon";

const Button = ({
  title,
  onClickOpen,
  className,
  redirectURI,
  icon,
  isPrimary = true,
  disabled = false,
}) => {
  return (
    <>
      <button
        disabled={disabled}
        href={redirectURI}
        className={classNames(`btn btn-default py-1.5 px-2 space-x-2 rounded", {
          "btn-primary": ${isPrimary},
        } ${className}`)}
        onClick={onClickOpen}
      >
        {icon && <RefreshIcon />} {title}
      </button>
    </>
  );
};

export default Button;
