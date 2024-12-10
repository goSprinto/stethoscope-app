import React, { Component } from "react";

const DEFAULT_SIZE = "20px";

const LABELS = {
  BLOCK: "Highly recommended action",
  SUGGEST: "Suggested action",
  PASS: "Completed action",
};

export const VARIANT_COLORS = {
  PASS: "#00B34A",
  BLOCK: "#E83030",
  SUGGEST: "#bfa058",
};

export const VARIANTS = {
  PASS: "PASS",
  BLOCK: "BLOCK",
  SUGGEST: "SUGGEST",
};

export default class ActionIcon extends Component {
  constructor(props) {
    super(props);

    const { color, variant = VARIANTS.PASS, size = DEFAULT_SIZE } = props;

    const styleProps = {
      color: color || VARIANT_COLORS[variant],
      width: size,
      height: size,
    };
    const style = Object.assign(
      {},
      {
        pointerEvents: "none",
        display: "block",
        width: "100%",
        height: "100%",
      },
      styleProps
    );
    this.icons = {
      PASS: (
        <svg
          width={this.props.width || "20"}
          height={this.props.height || "20"}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...this.props}
        >
          <path
            d="M32 0.5C14.6047 0.5 0.5 14.6047 0.5 32C0.5 49.3953 14.6047 63.5 32 63.5C49.3953 63.5 63.5 49.3953 63.5 32C63.5 14.6047 49.3953 0.5 32 0.5ZM45.6055 21.7133L30.7977 42.2445C30.5907 42.5334 30.3179 42.7688 30.0018 42.9312C29.6857 43.0935 29.3354 43.1782 28.9801 43.1782C28.6247 43.1782 28.2745 43.0935 27.9584 42.9312C27.6423 42.7688 27.3695 42.5334 27.1625 42.2445L18.3945 30.0945C18.1273 29.7219 18.3945 29.2016 18.8516 29.2016H22.1492C22.8664 29.2016 23.5484 29.5461 23.9703 30.1367L28.9766 37.0836L40.0297 21.7555C40.4516 21.1719 41.1266 20.8203 41.8508 20.8203H45.1484C45.6055 20.8203 45.8727 21.3406 45.6055 21.7133Z"
            fill={this.props.color || "#00B34A"}
          />
        </svg>
      ),
      BLOCK: (
        <svg
          width={this.props.width || "20"}
          height={this.props.height || "20"}
          viewBox="0 0 22 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...this.props}
        >
          <path
            d="M11 0.5C5.20156 0.5 0.5 5.20156 0.5 11C0.5 16.7984 5.20156 21.5 11 21.5C16.7984 21.5 21.5 16.7984 21.5 11C21.5 5.20156 16.7984 0.5 11 0.5ZM14.8766 14.9891L13.3297 14.982L11 12.2047L8.67266 14.9797L7.12344 14.9867C7.02031 14.9867 6.93594 14.9047 6.93594 14.7992C6.93594 14.7547 6.95234 14.7125 6.98047 14.6773L10.0297 11.0445L6.98047 7.41406C6.95215 7.37971 6.93643 7.3367 6.93594 7.29219C6.93594 7.18906 7.02031 7.10469 7.12344 7.10469L8.67266 7.11172L11 9.88906L13.3273 7.11406L14.8742 7.10703C14.9773 7.10703 15.0617 7.18906 15.0617 7.29453C15.0617 7.33906 15.0453 7.38125 15.0172 7.41641L11.9727 11.0469L15.0195 14.6797C15.0477 14.7148 15.0641 14.757 15.0641 14.8016C15.0641 14.9047 14.9797 14.9891 14.8766 14.9891Z"
            fill={this.props.color || "#E83030"}
          />
        </svg>
      ),
      SUGGEST: (
        <svg
          width={this.props.width || "22"}
          height={this.props.height || "20"}
          viewBox="0 0 22 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21.3992 18.0625L11.6492 1.1875C11.5039 0.936719 11.2531 0.8125 11 0.8125C10.7469 0.8125 10.4937 0.936719 10.3508 1.1875L0.60078 18.0625C0.312499 18.5641 0.673436 19.1875 1.25 19.1875H20.75C21.3266 19.1875 21.6875 18.5641 21.3992 18.0625ZM10.25 7.75C10.25 7.64687 10.3344 7.5625 10.4375 7.5625H11.5625C11.6656 7.5625 11.75 7.64687 11.75 7.75V12.0625C11.75 12.1656 11.6656 12.25 11.5625 12.25H10.4375C10.3344 12.25 10.25 12.1656 10.25 12.0625V7.75ZM11 16C10.7056 15.994 10.4253 15.8728 10.2192 15.6625C10.0131 15.4522 9.89773 15.1695 9.89773 14.875C9.89773 14.5805 10.0131 14.2978 10.2192 14.0875C10.4253 13.8772 10.7056 13.756 11 13.75C11.2944 13.756 11.5747 13.8772 11.7808 14.0875C11.9868 14.2978 12.1023 14.5805 12.1023 14.875C12.1023 15.1695 11.9868 15.4522 11.7808 15.6625C11.5747 15.8728 11.2944 15.994 11 16Z"
            fill={style.color}
          />
        </svg>
      ),
    };
  }

  render() {
    const { variant = VARIANTS.PASS, title } = this.props;

    return <span title={title || LABELS[variant]}>{this.icons[variant]}</span>;
  }
}
