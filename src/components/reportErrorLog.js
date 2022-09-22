import LinkOutIcon from "../icons/LinkOutIcon";
import React from "react";

const ReportErrorLog = ({ title, onClickOpen, redirectURI }) => {
  return (
    <>
      <div className="text-sm font-medium mt-2">{title}</div>
      <div className="text-sm">
        Report the issue to our support team - &nbsp;
        <a href={redirectURI} onClick={onClickOpen}>
          Report <LinkOutIcon />
        </a>
      </div>
    </>
  );
};

export default ReportErrorLog;
