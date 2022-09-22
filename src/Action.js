import React, { Component } from "react";
import ReactDOMServer from "react-dom/server";
import LinkOutIcon from "./icons/LinkOutIcon";
import Drawer from "react-modern-drawer";
import ActionIcon, { VARIANTS, VARIANT_COLORS } from "./ActionIcon";
import semver from "./lib/patchedSemver";
import getRecommendedVersion from "./lib/getRecommendedVersion";
import showdown from "showdown";
import Handlebars from "handlebars/dist/handlebars.min.js";
import "react-modern-drawer/dist/index.css";
import ReportErrorLog from "./components/reportErrorLog";

const { ipcRenderer } = window.require("electron");
const appName = ipcRenderer.sendSync("get:app:name");

const converter = new showdown.Converter();

class Action extends Component {
  state = {
    showDescription:
      this.props.expandedByDefault || this.props.type === "unknown",
    isOpen: false,
  };

  constructor(props) {
    super(props);
    this.registerHelpers(props);
  }

  getIconVariant(type) {
    if (type === "critical") {
      return VARIANTS.BLOCK;
    } else if (type === "done") {
      return VARIANTS.PASS;
    } else if (type === "suggested" || type === "unknown" || type === "error") {
      return VARIANTS.SUGGEST;
    }
  }

  getTypeText(type) {
    if (type === "critical") {
      return "Failed";
    } else if (type === "done") {
      return "Passed";
    } else if (type === "suggested" || type === "unknown" || type === "error") {
      return "Warning";
    }
  }

  handleToggleDescription = () => {
    if (!this.state.showDescription && this.props.status === "FAIL") {
      this.props.onExpandPolicyViolation();
    }
    this.setState(
      {
        showDescription: !this.state.showDescription,
      },
      () => {
        window.scrollTo(0, this.el.offsetTop - 5);
      }
    );
  };

  registerHelpers = ({ security, policy, device }) => {
    const getIcon = (status, msg) => {
      return new Handlebars.SafeString(
        ReactDOMServer.renderToStaticMarkup(
          <div className="subtask">
            <ActionIcon
              className="action-icon"
              variant={this.getIconVariant(status)}
            />
            <strong
              style={{ color: VARIANT_COLORS[this.getIconVariant(status)] }}
            >
              {msg}
            </strong>
          </div>
        )
      );
    };

    Handlebars.registerHelper("statusIcon", (status, altMessage) => {
      if (status === "ON") {
        return getIcon("done", altMessage);
      }
      return getIcon("suggested", altMessage);
    });

    Handlebars.registerHelper("okIcon", (label) => getIcon("done", label));
    Handlebars.registerHelper("warnIcon", (label) =>
      getIcon("critical", label)
    );
    Handlebars.registerHelper("securitySetting", (key) => {
      return new Handlebars.SafeString(
        ReactDOMServer.renderToStaticMarkup(
          <table style={{ width: "auto" }}>
            <tbody>
              <tr>
                <td>Suggested setting:</td>
                <td>
                  <span className="suggested-value">{String(policy[key])}</span>
                </td>
              </tr>
            </tbody>
          </table>
        )
      );
    });

    Handlebars.registerHelper("requirement", (key, platform) => {
      // display the highest minimum version
      // if advanced semver requirement is passed (e.g. >1.2.3 || < 3.0.0)
      const { distroName } = device;
      const { ok } =
        distroName in policy[key] ? policy[key][distroName] : { ok: "" };
      const recommended = getRecommendedVersion(ok);

      return new Handlebars.SafeString(
        ReactDOMServer.renderToStaticMarkup(
          <table style={{ width: "auto" }}>
            <tbody>
              <tr>
                <td>Suggested version:</td>
                <td>
                  <span className="suggested-value">{String(recommended)}</span>
                </td>
              </tr>
              <tr>
                <td>Your version:</td>
                <td>
                  <span className="suggested-value">{String(device[key])}</span>
                </td>
              </tr>
            </tbody>
          </table>
        )
      );
    });
  };

  /**
   * Provides variables to use in the instructions template. The returned keys
   * can be used in conditionals in instructions.yml
   * e.g. {{#if mojaveOrLater}}
   * @param  {String} platform  destructed off of Device
   * @param  {String} osVersion destructed off of Device
   * @return {Object}
   */
  getPlatformAndVersionSpecificFlags({ platform, osVersion }) {
    return {
      mojaveOrLater:
        platform === "darwin" && semver.satisfies(osVersion, ">=10.14.0"),
    };
  }

  parseDirections() {
    const {
      security,
      device,
      action: { status, directions },
    } = this.props;
    const html = converter.makeHtml(directions);
    const passing = status === "PASS";
    const template = Handlebars.compile(html);
    const platformOverrides = this.getPlatformAndVersionSpecificFlags(device);
    return template({
      ...security,
      ...device,
      ...platformOverrides,
      passing,
      appName,
    });
  }

  parseTitle() {
    const {
      action: { status, title },
    } = this.props;
    const template = Handlebars.compile(title);
    const passing = status === "PASS";
    return template({ passing, appName });
  }

  parseSubTitle() {
    const {
      action: { status, subTitle },
    } = this.props;
    const template = Handlebars.compile(subTitle);
    const passing = status === "PASS";
    return template({ passing, appName });
  }

  parseShortDescription() {
    const {
      action: { status, shortDescription },
    } = this.props;
    const template = Handlebars.compile(shortDescription);
    const passing = status === "PASS";
    return template({ passing, appName });
  }

  toggleDrawer = () => {
    this.setState({ isOpen: !this.state.isOpen });
  };

  render() {
    const { action, type, reportingErrorLogAppURI, onClickOpen, scanResult } =
      this.props;

    const description = (
      <div className="py-8 px-4 text-left">
        <>
          <div className="text-lg font-medium">{this.parseTitle()}</div>
          <div className="pl-2">
            <div className="text-sm font-medium mt-4 mb-1">Status</div>
            <div className="flex text-xs">
              <ActionIcon
                variant={this.getIconVariant(type)}
                height={15}
                width={15}
              />
              <div
                className={`ml-1 `}
                style={{ color: VARIANT_COLORS[this.getIconVariant(type)] }}
              >
                {type === "error" ? (
                  <>
                    We detected some error.{" "}
                    <a href={reportingErrorLogAppURI} onClick={onClickOpen}>
                      Report <LinkOutIcon />
                    </a>
                  </>
                ) : (
                  this.parseSubTitle()
                )}
              </div>
            </div>
            <div
              className="text-sm mt-1"
              dangerouslySetInnerHTML={{ __html: action.description }}
            />
            {action.details && (
              <pre className="description text-sm">{action.details}</pre>
            )}
            {action.link && (
              <a href={action.link} target="_blank" rel="noopener noreferrer">
                More info
              </a>
            )}

            {action.directions && (
              <>
                <div className="text-sm font-medium mt-2">
                  {type === "done" ? "How to configure" : "How to fix"}
                </div>
                <div
                  className="text-sm"
                  dangerouslySetInnerHTML={{ __html: this.parseDirections() }}
                />
              </>
            )}
            {this.props.children}

            <ReportErrorLog
              title={"Unable to fix"}
              redirectURI={reportingErrorLogAppURI}
              onClickOpen={onClickOpen}
            />

            <div className="flex justify-between mt-4">
              <div>
                <button
                  className="bg-grayMid py-2 px-4 space-x-2 text-grayUltraDark rounded m-0"
                  onClick={this.toggleDrawer}
                >
                  Cancel
                </button>
              </div>
              <div>
                <button
                  className="bg-orangeOne py-2 px-4 space-x-2 text-white rounded m-0"
                  onClick={this.props.onRescan}
                >
                  Rescan
                </button>
              </div>
            </div>
          </div>
        </>
      </div>
    );
    const actionkey = String(action.title).replace(/[^a-zA-Z]+/g, "");

    return (
      <>
        <div>
          <div
            className={`relative cursor-pointer shadow hover:drop-shadow-2xl border-t-4 p-2 pb-8 border-b-0 border-l-0 border-r-0 border-solid ${
              type === "done" ? "border-t-greenFive" : "border-t-grayFive"
            }`}
            key={actionkey}
            onClick={this.toggleDrawer}
          >
            <div className="flex items-center">
              <ActionIcon
                height={14}
                width={14}
                variant={this.getIconVariant(type)}
              />
              <div className="text-sm font-medium ml-1">
                {this.parseTitle()}
              </div>
            </div>
            <div
              className="text-xs font-extralight "
              style={{ marginLeft: "18px" }}
            >
              {this.parseSubTitle()}
            </div>
          </div>

          <Drawer
            open={this.state.isOpen}
            onClose={this.toggleDrawer}
            direction="right"
            size={500}
            enableOverlay={true}
            className="justify-left"
          >
            {description}
          </Drawer>
        </div>
      </>
    );
  }
}

export default Action;
