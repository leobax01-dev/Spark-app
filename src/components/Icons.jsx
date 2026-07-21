// src/components/Icons.jsx
// A small, consistent stroke-icon set — replaces emoji throughout SPARK.
// Emoji render inconsistently across OS/browser and can't be weighted or
// tinted to match the brand; a real icon set is one of the highest-leverage
// changes for making the app read as designed software rather than an
// AI-generated template. Style: 24x24 viewBox, 1.75 stroke, rounded caps —
// the same minimal-line language used by Linear, Vercel, and Notion.
//
// USAGE: <Icon.Mission size={18} color={C.text}/>

const base = (strokeWidth=1.75) => ({
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

function Svg({ size=18, color, children }){
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ color, flexShrink:0 }} {...base()}>
      {children}
    </svg>
  );
}

export const Icon = {
  Mission: (p)=>(<Svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/></Svg>),
  Deals: (p)=>(<Svg {...p}><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6"/></Svg>),
  Coordinator: (p)=>(<Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5 12 12l-2.5 5L12 12l2.5-5z"/></Svg>),
  Negotiate: (p)=>(<Svg {...p}><path d="M4 8h13M17 8l-3-3M17 8l-3 3"/><path d="M20 16H7M7 16l3-3M7 16l3 3"/></Svg>),
  Listings: (p)=>(<Svg {...p}><path d="M3 11l9-7 9 7"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></Svg>),
  Clients: (p)=>(<Svg {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14a5 5 0 0 1 5.5 5"/></Svg>),
  Sphere: (p)=>(<Svg {...p}><path d="M4 12a8 8 0 0 1 14-5.3"/><path d="M20 12a8 8 0 0 1-14 5.3"/><path d="M18 4v3h-3"/><path d="M6 20v-3h3"/></Svg>),
  Alerts: (p)=>(<Svg {...p}><path d="M12 3a6 6 0 0 0-6 6c0 4-1.5 5.5-1.5 5.5h15S18 13 18 9a6 6 0 0 0-6-6z"/><path d="M10 19a2 2 0 0 0 4 0"/></Svg>),
  Market: (p)=>(<Svg {...p}><path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="12" width="2.6" height="7"/><rect x="12" y="8" width="2.6" height="11"/><rect x="17" y="4" width="2.6" height="15"/></Svg>),
  Coaching: (p)=>(<Svg {...p}><path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M8 5H5a3 3 0 0 0 3 4"/><path d="M16 5h3a3 3 0 0 1-3 4"/><path d="M12 12v3"/><path d="M9 19h6"/><path d="M10 15h4l1 4H9l1-4z"/></Svg>),
  Weekly: (p)=>(<Svg {...p}><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17"/><path d="M8 2.5v3M16 2.5v3"/><path d="M7.5 13h2.5M11.5 13h2.5M15.5 13h1M7.5 16.5h2.5M11.5 16.5h2.5"/></Svg>),
  History: (p)=>(<Svg {...p}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/></Svg>),
  Bot: (p)=>(<Svg {...p}><rect x="5" y="8" width="14" height="11" rx="2.5"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><circle cx="9.5" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none"/><path d="M9 16.5h6"/><path d="M2.5 12v3M21.5 12v3"/></Svg>),
  Sparkle: (p)=>(<Svg {...p}><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4z"/></Svg>),
  Check: (p)=>(<Svg {...p}><path d="M4 12.5l5 5L20 6"/></Svg>),
  Send: (p)=>(<Svg {...p}><path d="M21 3 3 10.5l7 3 3 7L21 3z"/><path d="M10.5 13.5 21 3"/></Svg>),
  Copy: (p)=>(<Svg {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M5.5 15.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1"/></Svg>),
  ChevronRight: (p)=>(<Svg {...p}><path d="M9 5l7 7-7 7"/></Svg>),
  Close: (p)=>(<Svg {...p}><path d="M6 6l12 12M18 6 6 18"/></Svg>),
};

export default Icon;
