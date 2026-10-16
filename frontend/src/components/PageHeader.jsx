// Page header from the Stitch screens (D49): optional eyebrow, title with a chip, subtitle, actions on the right.
export default function PageHeader({ eyebrow, title, chip, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="sc-label page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}{chip && <span className="page-chip">{chip}</span>}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
