import {
  ArrowDown,
  ArrowUpRight,
  Check,
  CheckCheck,
  Home,
  Send,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
export function FlowPreview() {
  return (
    <div className="flow-preview">
      <div className="preview-topline">
        <span>
          <span className="tiny-dot" /> YOUR ENQUIRY, CONNECTED
        </span>
        <span>DEMO PREVIEW</span>
      </div>
      <div className="enquiry-card">
        <div className="card-label">
          <span className="icon-tile">
            <Home size={17} />
          </span>
          <span>
            New website enquiry
            <small>Greenway Properties · fictional business</small>
          </span>
          <span className="time-label">Just now</span>
        </div>
        <p>
          “Looking for a 2-bedroom home in Pune.
          <br />
          Budget around ₹60–90 lakh. Can we talk?”
        </p>
        <div className="sample-person">
          <span className="avatar">AS</span>
          <span>
            Aarav S.<small>Sample enquiry</small>
          </span>
          <span className="pill">Buy a home</span>
        </div>
      </div>
      <div className="flow-connector">
        <span />
        <div>
          <Sparkles size={14} /> A little structure. A lot more clarity.
        </div>
        <span />
      </div>
      <div className="qualification-card">
        <div className="card-label">
          <span className="icon-tile green">
            <SlidersHorizontal size={17} />
          </span>
          <span>
            Qualified & organized<small>Ready for a human decision</small>
          </span>
          <span className="score-orb">
            95<small>/100</small>
          </span>
        </div>
        <div className="tag-row">
          <span>
            <Check size={13} /> Budget captured
          </span>
          <span>
            <Check size={13} /> Clear intent
          </span>
        </div>
        <div className="mini-details">
          <div>
            <small>INTEREST</small>
            <strong>2-bedroom home</strong>
          </div>
          <div>
            <small>NEXT STEP</small>
            <strong>Arrange a consultation</strong>
          </div>
        </div>
      </div>
      <ArrowDown className="between-arrow" size={17} />
      <div className="notification-card">
        <span className="telegram-icon">
          <Send size={18} />
        </span>
        <div>
          <strong>A useful alert. Right on your phone.</strong>
          <p>Review the details. Approve the next step.</p>
          <span>
            <CheckCheck size={13} /> You stay in control
          </span>
        </div>
        <ArrowUpRight size={18} />
      </div>
      <Link to="/demo" className="preview-bottom">
        See the full journey <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}
