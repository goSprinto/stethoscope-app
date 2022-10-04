import React, { Component } from "react";
import Action from "./Action";
import ActionIcon, { VARIANTS } from "./ActionIcon";
import semver from "./lib/patchedSemver";
import _ from "lodash";
import {
  INVALID_INSTALL_STATE,
  INVALID_VERSION,
  SUGGESTED_INSTALL,
  SUGGESTED_UPGRADE,
  PASS,
} from "./constants";
import "./Device.css";
import WindowsOSIcon from "./icons/WindowsOSIcon";
import MacOSIcon from "./icons/MacOsIcon";
import LinuxIcon from "./icons/LinuxIcon";
import ManjaroLinuxOSIcon from "./icons/ManjaroLinuxOSIcon";
import PopOSIcon from "./icons/PopOsIcon";
import UbuntuOSIcon from "./icons/UbuntuOsIcon";
import LinuxMintOSIcon from "./icons/LinuxMintOsIcon";
import FedoraLinuxOSIcon from "./icons/FedoraLinuxOSIcon";
import Button from "./components/Button";
import LaptopIcon from "./icons/LaptopIcon";

const WelcomeMessage = () => {
  return (
    <div>
      <div className="text-sm">Welcome,</div>
      <p className="text-sm">
        To ensure your device complies with the company's endpoint security
        policy, you need to scan the device and send the health report to
        Sprinto.
      </p>
    </div>
  );
};

const mapOsToRegex = {
  windows: /windows/i,
  macOS: /mac/i,
  popOS: /pop/i,
  linuxMint: /mint/i,
  manjaroLinux: /manjaro/i,
  fedoraLinux: /fedora/i,
  ubuntu: /ubuntu/i,
  oracleLinux: /oracle/i,
};

const mapOsToIcon = {
  windows: <WindowsOSIcon height={51} width={51} />,
  macOS: <MacOSIcon height={51} width={51} />,
  popOS: <PopOSIcon height={51} width={51} />,
  linuxMint: <LinuxMintOSIcon height={51} width={51} />,
  manjaroLinux: <ManjaroLinuxOSIcon height={51} width={51} />,
  fedoraLinux: <FedoraLinuxOSIcon height={51} width={51} />,
  ubuntu: <UbuntuOSIcon height={51} width={51} />,
  oracleLinux: <LinuxIcon height={51} width={51} />,
};

const DeviceDetails = ({
  daysSinceLastLog,
  deviceLogReportingFreqDays,
  onClickOpen,
  friendlyName,
  identifier,
  label,
  lastScan,
  scannedBy,
  lastScanTime,
  lastScanDuration,
  platformName,
}) => {
  const _getOSIconName = (osName) => {
    for (const [_os, _regex] of _.entries(mapOsToRegex)) {
      if (_regex.test(osName)) {
        return _.get(mapOsToIcon, _os);
      }
    }
  };

  const IconNameForRespectiveOS = _getOSIconName(platformName);

  return (
    <>
      <div
        className="flex items-center border-solid rounded-md justify-between mt-5 p-3"
        style={{ borderColor: "#e5e7eb" }}
      >
        <div className="flex items-center">
          <div>{IconNameForRespectiveOS || <LaptopIcon />}</div>
          <div className="ml-3">
            <div className="text-lg font-medium">{friendlyName}</div>
            <div className="text-base">{identifier}</div>
            <div className="text-xs text-slate-400">
              {lastScan} {lastScanTime}
            </div>
          </div>
        </div>
        <div>
          <Button
            title={label}
            isPrimary={daysSinceLastLog > deviceLogReportingFreqDays}
            onClickOpen={onClickOpen}
            icon={true}
          />
        </div>
      </div>
    </>
  );
};

class Device extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showInfo: false,
    };
  }

  renderAppVersionSuggestion = (installed, suggested) => {
    return (
      <table style={{ width: "auto", marginTop: "10px" }}>
        <tbody>
          <tr>
            <td>Suggested version:</td>
            <td>
              <span className="suggested-value">{String(suggested)}</span>
            </td>
          </tr>
          <tr>
            <td>Your version:</td>
            <td>
              <span className="suggested-value">{String(installed)}</span>
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  renderApplicationStateMessage = ({
    state,
    version,
    installed,
    policy = {},
  }) => {
    const installPrompt = policy.installFrom ? (
      <p>
        Install from{" "}
        <a href={policy.installFrom} target="_blank" rel="noopener noreferrer">
          here
        </a>
      </p>
    ) : null;
    if (state === INVALID_INSTALL_STATE && !installed) {
      return <p>You must have this application installed.{installPrompt}</p>;
    } else if (state === INVALID_INSTALL_STATE && installed) {
      return <p>You must not have this application installed</p>;
    } else if (state === INVALID_VERSION || state === SUGGESTED_UPGRADE) {
      return (
        <>
          {this.renderAppVersionSuggestion(
            version,
            semver.coerce(policy.version)
          )}
          {installPrompt && <p>{installPrompt}</p>}
        </>
      );
    } else if (state === SUGGESTED_INSTALL) {
      return <p>It is suggested that this applicaiton is installed</p>;
    }
    return null;
  };

  actions(actions, type, device) {
    const status = type === "done" ? "PASS" : "FAIL";

    return actions.map((action, index) => {
      const actionProps = {
        action,
        device,
        status,
        type,
        key: action.title[status],
        onExpandPolicyViolation: this.props.onExpandPolicyViolation,
        platform: this.props.platform,
        policy: this.props.policy,
        security: this.props.security,
        expandedByDefault: type === "critical" && index === 0,
        onShowActionDescription: this.props.onShowActionDescription,
        onCancelReloadApp: this.props.onCancelReloadApp,
        onRescan: this.props.onRescan,
        reportingErrorLogAppURI: this.props.reportingErrorLogAppURI,
        onClickOpen: this.props.onClickOpen,
        scanResult: this.props.scanResult,
      };

      const hasResults = Array.isArray(action.results);
      let results = action.results;

      if (hasResults && action.name.endsWith("applications")) {
        results = results.map((result, index) => {
          if (
            action.name in this.props.policy &&
            Array.isArray(this.props.policy[action.name])
          ) {
            const target = this.props.policy[action.name][index];
            if (target) {
              result.policy = target;
            }
          }
          return result;
        });
      }

      if (hasResults) {
        return (
          <Action {...actionProps} key={`action-container-${action.name}`}>
            <ul className="result-list" key={`action-ul-${action.name}`}>
              {results.map((data, index) => {
                const { name, status, state, policy = {} } = data;
                const { description } = policy;
                let iconVariant =
                  status === PASS ? VARIANTS.PASS : VARIANTS.BLOCK;

                if (
                  state === SUGGESTED_INSTALL ||
                  state === SUGGESTED_UPGRADE
                ) {
                  iconVariant = VARIANTS.SUGGEST;
                }

                return (
                  <li className="result-list-item" key={`action-li-${name}`}>
                    <div className="result-heading">
                      <strong>
                        <ActionIcon
                          className="action-icon"
                          size="15px"
                          variant={iconVariant}
                        />{" "}
                        {name}
                      </strong>{" "}
                    </div>
                    {description ? <p>{description}</p> : null}
                    {this.renderApplicationStateMessage(data)}
                    {index !== results.length - 1 ? <hr /> : null}
                  </li>
                );
              })}
            </ul>
          </Action>
        );
      } else {
        return (
          <Action {...actionProps} key={`action-container-${action.name}`} />
        );
      }
    });
  }

  process(device) {
    const d = Object.assign({}, device);
    d.friendlyName = d.friendlyName || "Unknown device";
    d.identifier =
      d.deviceName || d.hardwareSerial || (d.macAddresses || []).join(" ");

    return d;
  }

  handleToggleInfo = () => {
    this.setState({
      showInfo: !this.state.showInfo,
    });
  };

  render() {
    const {
      deviceLogLastReportedOn,
      scanResult,
      onClickOpen,
      onRescan,
      reportingAppURI,
      actionButtonTitle,
      countDown,
      enableReportNow,
    } = this.props;

    const deviceLogReportingFreqDays = 90;
    const today = new Date();
    const daysSinceLastLog = deviceLogLastReportedOn
      ? Math.round(
          (today.getTime() - deviceLogLastReportedOn.getTime()) /
            (1000 * 3600 * 24)
        )
      : deviceLogReportingFreqDays + 1;

    if (!this.props.stethoscopeVersion) return null;

    const device = Object.assign({}, this.props, this.process(this.props));

    let deviceClass = "ok";

    if (scanResult.status !== "PASS") {
      deviceClass = scanResult.status === "NUDGE" ? "warning" : "critical";
    }

    const actions = [
      ...this.actions(device.error, "error", device),
      ...this.actions(device.unknown, "unknown", device),
      ...this.actions(device.critical, "critical", device),
      ...this.actions(device.suggested, "suggested", device),
      ...this.actions(device.done, "done", device),
    ];

    return (
      <div className="device-wrapper">
        <div className={`panel device ${deviceClass}`}>
          <WelcomeMessage />
          <DeviceDetails
            friendlyName={device.friendlyName}
            identifier={device.identifier}
            deviceLogReportingFreqDays={deviceLogReportingFreqDays}
            daysSinceLastLog={daysSinceLastLog}
            reportingAppURI={reportingAppURI}
            onClickOpen={onRescan}
            label={actionButtonTitle}
            lastScan={this.props.strings.lastScan}
            scannedBy={this.props.scannedBy}
            lastScanTime={this.props.lastScanTime}
            lastScanDuration={this.props.lastScanDuration}
            platformName={device.platformName}
          />

          <div className="grid gap-2 grid-cols-2 grid-rows-3 mt-8">
            {actions}
          </div>

          <div
            className={`flex border-solid rounded-md p-3 justify-between items-center mt-8`}
            style={{ borderColor: "#e5e7eb" }}
          >
            <div>
              <span className="text-sm font-small flex flex-row">
                {enableReportNow
                  ? `Device scan is valid for ${countDown
                      .toString()
                      .padStart(2, "0")}:00 ${countDown === 1 ? "min" : "mins"}`
                  : "Scan device to send health report"}
              </span>
              <div className="flex flex-row">
                {daysSinceLastLog > deviceLogReportingFreqDays ? (
                  <span className="text-xs font-medium">
                    Device status not reported to Sprinto
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    {daysSinceLastLog === 0
                      ? "Last reported today."
                      : `Last reported ${daysSinceLastLog}
                    ${daysSinceLastLog === 1 ? " day" : " days"} ago.`}
                  </span>
                )}
              </div>
            </div>

            <Button
              title={"Send report"}
              isPrimary={true}
              onClickOpen={onClickOpen}
              redirectURI={reportingAppURI}
              disabled={!enableReportNow}
              className="bg-orangeOne text-white"
            />
          </div>
        </div>
      </div>
    );
  }
}

Device.defaultProps = {
  macAddresses: [],
  ipAddresses: [],
  critical: [],
  suggested: [],
  messages: {},
  done: [],
};

export default Device;
