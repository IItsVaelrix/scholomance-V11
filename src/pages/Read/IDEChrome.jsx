import './IDE.css';

export function TopBar({ title, saveStatus }) {
  return (
    <div className="ide-topbar">
      <div>{title}</div>
      <div>{saveStatus}</div>
      <div>Theme/Layout Controls</div>
    </div>
  );
}

export function StatusBar({ line, col, language }) {
  return (
    <div className="ide-statusbar">
      <div>{`Ln ${line}, Col ${col}`}</div>
      <div>{language}</div>
    </div>
  );
}
