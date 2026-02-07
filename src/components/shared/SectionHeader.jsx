export default function SectionHeader({ kicker, title, subtitle, children }) {
  return (
    <header className="sectionHeader">
      {kicker && <div className="kicker">{kicker}</div>}
      {title && <h1 className="title">{title}</h1>}
      {subtitle && <p className="subtitle">{subtitle}</p>}
      {children}
    </header>
  );
}
