export function DataUniverse() {
  return (
    <aside className="data-universe">
      <span className="data-eyebrow">STOCKIFY / INVENTORY INTELLIGENCE</span>
      <h2>Vos données.<br />Une longueur<br /><em>d’avance.</em></h2>
      <p>Reliez vos boutiques. Retrouvez vos produits, vos variantes et vos stocks dans un même espace.</p>
      <div className="data-visual" aria-hidden="true">
        <div className="data-visual-top"><span>LE SIGNAL, EN UN COUP D’ŒIL</span><span className="data-dot" /></div>
        <svg viewBox="0 0 440 180" fill="none">
          <path d="M0 30H440M0 75H440M0 120H440M0 165H440" stroke="#ffffff18" />
          <path d="M0 140C40 140 40 85 80 95S140 155 180 105S235 120 280 65S340 110 380 45S420 35 440 15" stroke="#70f1d1" strokeWidth="4" />
          <path d="M0 160C60 100 100 155 150 130S230 45 285 90S360 45 440 55" stroke="#ac9bff" strokeWidth="3" strokeDasharray="6 6" />
          <circle cx="280" cy="65" r="7" fill="#70f1d1" stroke="#172142" strokeWidth="3" />
        </svg>
        <div className="data-bars">{[35,58,42,75,63,87,55,93,72,100,82,96].map((height,i)=><span key={i} style={{height:`${height}%`}} />)}</div>
        <div className="data-legend"><span>● Produits</span><span>● Variantes</span><span>● Stocks</span></div>
      </div>
      <span className="data-footnote">Visualisation illustrative · Vos données apparaissent après l’import.</span>
    </aside>
  );
}
