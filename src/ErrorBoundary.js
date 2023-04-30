import React from "react";

let log = console;

try {
  const remote = window.require("@electron/remote");
  log = remote.getGlobal("log");
} catch (e) {
  // browser context
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error, info) {
    const e = new Error(error);
    this.setState({
      hasError: true,
      error: e,
    });
    log.error(JSON.stringify(e));
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <h1>Something went wrong.</h1>
          <pre>{JSON.stringify(this.state.error, null, 3)}</pre>
        </>
      );
    }
    return this.props.children;
  }
}
