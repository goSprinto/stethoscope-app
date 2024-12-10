import React, { Component } from "react";
import "./ErrorMessage.css";
import ReportErrorLog from "./components/reportErrorLog";
import Button from "./components/Button";

// let clipboard;
let ipcRenderer;

try {
  ipcRenderer = window.require("electron").ipcRenderer;
  // clipboard = window.require("electron").clipboard;
} catch (e) {}

export default class ErrorMessage extends Component {
  render() {
    const { reportingErrorLogAppURI, onClickOpen, onCancelReloadApp } =
      this.props;
    return (
      <div className="p-5">
        <div className="text-base">
          Looks like we have run into an unknown issue.
        </div>
        <div className="mt-5">
          <ReportErrorLog
            title={"Get help"}
            redirectURI={reportingErrorLogAppURI}
            onClickOpen={onClickOpen}
          />
        </div>
        <div className="flex justify-between mt-4">
          <div>
            <Button
              title={"Cancel"}
              isPrimary={true}
              onClickOpen={onCancelReloadApp}
              className="bg-grayMid text-grayUltraDark m-0"
            />
          </div>
          <div>
            <Button
              title={"Restart"}
              isPrimary={true}
              onClickOpen={() => ipcRenderer.send("app:restart")}
              className="bg-orangeOne text-white m-0"
            />
          </div>
        </div>
      </div>
    );
  }
}

ErrorMessage.defaultProps = {
  message: "Unknown error :(",
};
