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
    const { reportingErrorLogAppURI, onClickOpen, message} =
      this.props;
    return (
      <div className="p-5">
        <div className="text-base">
          Looks like we have run into an unknown issue. - {message}
        </div>
        <div className="mt-5">
          <ReportErrorLog
            title={"Get help"}
            redirectURI={reportingErrorLogAppURI}
            onClickOpen={onClickOpen}
          />
        </div>
        <div className="flex justify-end mt-4">
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
