import React from "react";
import classNames from "classnames";
import "./Loader.css";
import ReportErrorLog from "./components/reportErrorLog";

const TOO_SLOW = 60000; // 60 sec
let timeout;

export default class Loader extends React.Component {
  state = { slowLoad: false };

  componentDidMount() {
    timeout = setTimeout(() => {
      this.setState({ slowLoad: true });
    }, TOO_SLOW);
  }

  componentWillUnmount() {
    clearTimeout(timeout);
  }

  render() {
    const { slowLoad } = this.state;
    const {
      remoteLabel,
      reportingErrorLogAppURI,
      onClickOpen,
      onCancelReloadApp,
      onRescan,
      remoteScan,
    } = this.props;

    let msg = remoteScan
      ? `${remoteLabel} is reading your device settings...`
      : "Gathering device settings...";

    return (
      <>
        {slowLoad ? (
          <>
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
                    onClick={onRescan}
                  >
                    Rescan
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={classNames("loader-wrapper")}>
            {msg}
            <div className="loader" />{" "}
          </div>
        )}
      </>
    );
  }
}
