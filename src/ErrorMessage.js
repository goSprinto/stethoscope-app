import React, { Component } from "react";
import "./ErrorMessage.css";
import ReportErrorLog from "./components/reportErrorLog";

let clipboard;
let ipcRenderer;

try {
  ipcRenderer = window.require("electron").ipcRenderer;
  clipboard = window.require("electron").clipboard;
} catch (e) {}

export default class ErrorMessage extends Component {
  // handleCopy = (event) => {
  //   clipboard.writeText(this.props.message + "\n" + this.props.stack);
  //   window.alert("Copied!");
  // };

  render() {
    const {
      reportingErrorLogAppURI,
      onClickOpen,
      onCancelReloadApp,
      onRescan,
    } = this.props;

    return (
      <div className="p-5">
        Looks like we have run into an unknown issue.
        <div className="mt-5">
          <ReportErrorLog
            title={"Get help"}
            redirectURI={reportingErrorLogAppURI}
            onClickOpen={onClickOpen}
          />
        </div>
        <div className="flex justify-between mt-4">
          <div>
            <button
              className="bg-grayMid py-2 px-2 space-x-2 text-grayUltraDark rounded-lg m-0"
              onClick={onCancelReloadApp}
            >
              Cancel
            </button>
          </div>
          <div>
            <button
              className="bg-orangeOne py-2 px-2 space-x-2 text-white rounded-lg m-0"
              onClick={() => ipcRenderer.send("app:restart")}
            >
              Restart
            </button>
          </div>
        </div>
      </div>
    );
  }
}

ErrorMessage.defaultProps = {
  message: "Unknown error :(",
};
