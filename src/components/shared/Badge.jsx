import { schoolToBadgeClass } from "../../data/library";

export default function Badge({ school, children, style }) {
  return (
    <span
      className={`badge ${school ? schoolToBadgeClass(school) : ""}`}
      style={style}
    >
      {children || school}
    </span>
  );
}
