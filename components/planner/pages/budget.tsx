'use client';
import { memo, ReactNode } from 'react';
import {
  AlertCircle,
  ChartNoAxesCombined,
  Coins,
  FileText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { schemas } from '@/lib/domain';
import { TabBar } from '../controls';

function Metric({
  label,
  value,
  caption,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  caption: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <button className="panel metric" disabled>
      <div className="metric-top">
        <span>{label}</span>
        <span className={'metric-icon ' + accent}>{icon}</span>
      </div>
      <strong className="metric-number">{value}</strong>
      <span className="metric-caption">{caption}</span>
    </button>
  );
}

export const BudgetPage = memo(function BudgetPage({
  current,
  currency,
  budget,
  estimated,
  contracted,
  paid,
  content,
  setTab,
  formatMoney,
}: {
  current: string;
  currency: string;
  budget: number;
  estimated: number;
  contracted: number;
  paid: number;
  content: ReactNode;
  setTab: (value: string) => void;
  formatMoney: (value: number, currency: string) => string;
}) {
  return (
    <>
      <div className="metric-grid budget-metrics">
        <Metric label="Buget planificat" value={formatMoney(budget, currency)} icon={<Wallet />} caption="Limita pe care v-ați propus-o" accent="sage" />
        <Metric label="Estimat" value={formatMoney(estimated, currency)} caption="Include costurile per persoană" icon={<ChartNoAxesCombined />} accent="sand" />
        <Metric label="Contractat" value={formatMoney(contracted, currency)} caption="Valoarea angajată" icon={<FileText />} accent="rose" />
        <Metric label="Plătit net" value={formatMoney(paid, currency)} caption="Plăți minus rambursări" icon={<Coins />} accent="lavender" />
      </div>
      {estimated > budget && (
        <div className="warning-banner">
          <AlertCircle />
          Estimarea depășește bugetul cu {formatMoney(estimated - budget, currency)}.
        </div>
      )}
      <TabBar
        value={current}
        onChange={setTab}
        items={['expense', 'schedule', 'payment', 'refund', 'contribution'].map((value) => ({
          value,
          label: schemas[value].label,
        }))}
      />
      {['payment', 'refund', 'contribution'].includes(current) && (
        <div className="info-banner">
          <ShieldCheck size={18} />
          Înregistrări manuale de evidență. Aceste acțiuni nu transferă bani.
        </div>
      )}
      {content}
    </>
  );
});
