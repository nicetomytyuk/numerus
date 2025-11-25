type Props = {
  numberLabel: string;
  value: string;
  meta: string;
};

const StatusCard = ({ numberLabel, value, meta }: Props) => (
  <div className="status-shell">
    <div className="status-card">
      <div className="label">{numberLabel}</div>
      <div className="value">{value}</div>
      <div className="meta">{meta}</div>
    </div>
  </div>
);

export default StatusCard;
