// src/components/ErrorBoundary.jsx
// Contains a crash to the surface it wraps instead of taking down the
// whole app. Wrap each major tab (Autopilot, Deals, Clients, Market,
// Calculator) individually — one panel breaking should never produce a
// full black screen while the sidebar and every other tab still work.
//
// USAGE:
//   import ErrorBoundary from "./components/ErrorBoundary";
//   {tab==="autopilot" && (
//     <ErrorBoundary label="Autopilot">
//       <AutopilotPanel user={user} voice={voice} planKey={planKey} onNavigate={setTab}/>
//     </ErrorBoundary>
//   )}

import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props){
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error){
    return { hasError: true, error };
  }

  componentDidCatch(error, info){
    // eslint-disable-next-line no-console
    console.error(`[${this.props.label || "Panel"}] crashed:`, error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if(this.props.onReset) this.props.onReset();
  };

  render(){
    if(!this.state.hasError) return this.props.children;

    const label = this.props.label || "This section";
    return (
      <div style={{
        padding: "40px 24px",
        textAlign: "center",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
      }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.75)", margin: "0 0 6px", fontWeight: 600 }}>
          {label} failed to load.
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", margin: "0 0 20px" }}>
          {this.state.error?.message || "Unknown error"}
        </p>
        <button
          onClick={this.handleReload}
          style={{
            background: "rgba(99,102,241,.15)",
            border: "1px solid rgba(99,102,241,.3)",
            color: "#818cf8",
            borderRadius: 8,
            padding: "8px 20px",
            cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Try again
        </button>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,.25)", marginTop: 16 }}>
          The rest of SPARK is still working — try another tab or reload the page.
        </p>
      </div>
    );
  }
}

export default ErrorBoundary;
