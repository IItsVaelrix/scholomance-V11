import NexusPanel from '../../components/Nexus/NexusPanel';
import './NexusPage.css';

const NexusPage = () => {
  return (
    <div className="nexus-page-root">
      <header className="nexus-header">
        <h1>THE NEXUS</h1>
        <p className="subtitle">The Living Archive of Syntax and Resonance</p>
      </header>
      <NexusPanel />
    </div>
  );
};

export default NexusPage;
