import OfflineIcon from "../icons/OfflineIcon";
import React from "react";
import LinkOutIcon from "../icons/LinkOutIcon";
const { ipcRenderer } = window.require("electron");

const OfflineSprintoApp = () => {
  return (
    <>
      <div style={{ "margin-top": "50%" }}>
        <div className="center">
          <OfflineIcon />
        </div>
        <div className="center">
          Internet is missing &nbsp;
          <a
            href="/#"
            style={{ textDecoration: "none" }}
            onClick={() => ipcRenderer.send("app:reload")}
          >
            retry now <LinkOutIcon />
          </a>
        </div>
      </div>
    </>
  );
};

export default OfflineSprintoApp;
