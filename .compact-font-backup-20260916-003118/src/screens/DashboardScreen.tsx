import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Bill, Room, Tab, Tenant } from '../types';
import { Card } from '../components/UI';
import { colors, shadow } from '../theme';
import { bsMonthLabel } from '../lib/nepaliDate';

type Props = {
  rooms: Room[];
  tenants: Tenant[];
  bills: Bill[];
  onNavigate: (tab: Tab) => void;
  displayName?: string;
};

type MonthMetric = {
  month: string;
  billed: number;
  collected: number;
};

function shortMonth(value: string) {
  const label = bsMonthLabel(value);
  const [month, year] = label.split(' ');
  return year ? `${month.slice(0, 3)}\n${year}` : label;
}

function compactMoney(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return value.toLocaleString();
}

export function DashboardScreen({
  rooms,
  tenants,
  bills,
  onNavigate,
  displayName = 'Owner',
}: Props) {
  const firstName = displayName.trim().split(/\s+/)[0] || 'Owner';
  const occupied = rooms.filter((room) => room.status === 'occupied').length;
  const vacant = Math.max(0, rooms.length - occupied);
  const occupancyRate = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;

  const totalCollected = bills.reduce((sum, bill) => sum + Number(bill.paid_amount || 0), 0);
  const totalDue = bills.reduce((sum, bill) => sum + Number(bill.balance || 0), 0);
  const totalBilled = bills.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
  const expectedMonthlyRent = tenants.reduce((sum, tenant) => sum + Number(tenant.monthly_rent || 0), 0);
  const collectionRate = totalBilled ? Math.min(100, Math.round((totalCollected / totalBilled) * 100)) : 0;

  const monthly = useMemo<MonthMetric[]>(() => {
    const map = new Map<string, MonthMetric>();
    bills.forEach((bill) => {
      const item = map.get(bill.bill_month) ?? { month: bill.bill_month, billed: 0, collected: 0 };
      item.billed += Number(bill.total || 0);
      item.collected += Number(bill.paid_amount || 0);
      map.set(bill.bill_month, item);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [bills]);

  const chartMax = Math.max(1, ...monthly.map((item) => Math.max(item.billed, item.collected)));

  function tenantName(id: string) {
    return tenants.find((tenant) => tenant.id === id)?.full_name ?? 'Unknown tenant';
  }

  return (
    <View>
      <View style={styles.welcomeRow}>
        <View style={styles.welcomeCopy}>
          <Text style={styles.welcomeTitle}>Hello, {firstName}! 👋</Text>
          <Text style={styles.welcomeText}>Here is your rental property overview.</Text>
        </View>
        <View style={styles.cloudBadge}>
          <Text style={styles.cloudDot}>●</Text>
          <Text style={styles.cloudText}>Cloud</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard icon="⌂" iconTone="green" value={String(rooms.length)} label="Total rooms" meta={`${occupied} occupied · ${vacant} vacant`} onPress={() => onNavigate('Properties')} />
        <MetricCard icon="♟" iconTone="blue" value={String(tenants.length)} label="Active tenants" meta="Current household tenants" onPress={() => onNavigate('Tenants')} />
        <MetricCard icon="₨" iconTone="money" value={`NPR ${compactMoney(totalCollected)}`} label="Collected" meta={`${collectionRate}% of billed amount`} onPress={() => onNavigate('Bills')} />
        <MetricCard icon="!" iconTone="warning" value={`NPR ${compactMoney(totalDue)}`} label="Outstanding" meta={totalDue > 0 ? 'Current bill balances' : 'All bills up to date'} onPress={() => onNavigate('Bills')} />
      </View>

      <Card style={styles.chartCard}>
        <View style={styles.sectionTop}>
          <View>
            <Text style={styles.sectionTitle}>Monthly collection</Text>
            <Text style={styles.sectionSub}>Latest 6 billing months</Text>
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendPaid]} /><Text style={styles.legendText}>Collected</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendBilled]} /><Text style={styles.legendText}>Billed</Text></View>
          </View>
        </View>

        {monthly.length ? (
          <View style={styles.chart}>
            {monthly.map((item) => {
              const billedHeight = Math.max(7, Math.round((item.billed / chartMax) * 100));
              const collectedHeight = Math.max(item.collected ? 7 : 0, Math.round((item.collected / chartMax) * 100));
              return (
                <View key={item.month} style={styles.chartGroup}>
                  <Text style={styles.chartValue}>{compactMoney(item.collected)}</Text>
                  <View style={styles.barArea}>
                    <View style={[styles.bar, styles.billedBar, { height: billedHeight }]} />
                    <View style={[styles.bar, styles.paidBar, { height: collectedHeight }]} />
                  </View>
                  <Text style={styles.chartLabel}>{shortMonth(item.month)}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.empty}>Generate bills to see monthly collection trends.</Text>
        )}
      </Card>

      <View style={styles.healthRow}>
        <Card style={styles.healthCard}>
          <Text style={styles.healthTitle}>Occupancy rate</Text>
          <View style={styles.healthNumberRow}><Text style={styles.healthValue}>{occupancyRate}%</Text><Text style={styles.healthMeta}>{occupied}/{rooms.length}</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${occupancyRate}%` }]} /></View>
          <Text style={styles.healthFoot}>{vacant ? `${vacant} room${vacant === 1 ? '' : 's'} available` : 'All rooms occupied'}</Text>
        </Card>

        <Card style={styles.healthCard}>
          <Text style={styles.healthTitle}>Monthly rent</Text>
          <Text style={styles.rentValue}>NPR {expectedMonthlyRent.toLocaleString()}</Text>
          <View style={styles.rentLine}><Text style={styles.rentLabel}>Collection</Text><Text style={styles.rentPercent}>{collectionRate}%</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, styles.collectionFill, { width: `${collectionRate}%` }]} /></View>
          <Text style={styles.healthFoot}>NPR {totalDue.toLocaleString()} pending</Text>
        </Card>
      </View>

      <View style={styles.headingBlock}>
        <Text style={styles.heading}>Quick actions</Text>
        <Text style={styles.headingSub}>Continue common rental workflows.</Text>
      </View>
      <View style={styles.quickGrid}>
        <QuickAction icon="⌂" title="Properties" caption="Rooms & rent" onPress={() => onNavigate('Properties')} />
        <QuickAction icon="♟" title="Tenants" caption="Manage residents" onPress={() => onNavigate('Tenants')} />
        <QuickAction icon="▤" title="Create bill" caption="Monthly invoice" onPress={() => onNavigate('Bills')} />
        <QuickAction icon="⚙" title="Settings" caption="Account & sync" onPress={() => onNavigate('Settings')} />
      </View>

      <Card style={styles.recentCard}>
        <View style={styles.sectionTop}>
          <View><Text style={styles.sectionTitle}>Recent bills</Text><Text style={styles.sectionSub}>Latest rental invoices</Text></View>
          <Pressable onPress={() => onNavigate('Bills')}><Text style={styles.viewAll}>View all →</Text></Pressable>
        </View>

        {bills.slice(0, 5).map((bill, index) => (
          <View key={bill.id} style={[styles.billRow, index === Math.min(4, bills.length - 1) && styles.lastBillRow]}>
            <View style={styles.billIcon}><Text style={styles.billIconText}>▤</Text></View>
            <View style={styles.billCopy}>
              <Text style={styles.billTenant} numberOfLines={1}>{tenantName(bill.tenant_id)}</Text>
              <Text style={styles.billMonth} numberOfLines={1}>{bsMonthLabel(bill.bill_month)}</Text>
            </View>
            <View style={styles.billRight}>
              <Text style={styles.billAmount}>NPR {Number(bill.total || 0).toLocaleString()}</Text>
              <View style={[styles.statusPill, bill.status === 'paid' ? styles.statusPaid : bill.status === 'partial' ? styles.statusPartial : styles.statusDue]}>
                <Text style={styles.statusText}>{bill.status.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        ))}
        {!bills.length && <Text style={styles.empty}>No bills generated yet.</Text>}
      </Card>
    </View>
  );
}

function MetricCard({ icon, value, label, meta, iconTone, onPress }: {
  icon: string;
  value: string;
  label: string;
  meta: string;
  iconTone: 'green' | 'blue' | 'money' | 'warning';
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.metricCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.metricIcon, iconTone === 'blue' && styles.metricIconBlue, iconTone === 'money' && styles.metricIconMoney, iconTone === 'warning' && styles.metricIconWarning]}>
        <Text style={[styles.metricIconText, iconTone === 'blue' && styles.metricIconTextBlue, iconTone === 'warning' && styles.metricIconTextWarning]}>{icon}</Text>
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricMeta} numberOfLines={1}>{meta}</Text>
    </Pressable>
  );
}

function QuickAction({ icon, title, caption, onPress }: { icon: string; title: string; caption: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.quickIcon}><Text style={styles.quickIconText}>{icon}</Text></View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickCaption}>{caption}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 2 },
  welcomeCopy: { flex: 1, paddingRight: 12 },
  welcomeTitle: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.25 },
  welcomeText: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  cloudBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7F8F0', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6 },
  cloudDot: { color: colors.success, fontSize: 10, marginRight: 5 },
  cloudText: { color: colors.success, fontSize: 9, fontWeight: '900' },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 2 },
  metricCard: { width: '48.4%', minHeight: 122, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, marginBottom: 10, ...shadow },
  metricIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDF8EA' },
  metricIconBlue: { backgroundColor: '#E5EEFF' },
  metricIconMoney: { backgroundColor: '#DFF7EE' },
  metricIconWarning: { backgroundColor: '#FFF0E8' },
  metricIconText: { color: '#0F8A5F', fontSize: 15, fontWeight: '900' },
  metricIconTextBlue: { color: '#2D6CDF' },
  metricIconTextWarning: { color: '#E76035' },
  metricValue: { color: '#10231D', fontSize: 18.5, fontWeight: '900', marginTop: 9 },
  metricLabel: { color: colors.text, fontSize: 10, fontWeight: '800', marginTop: 2 },
  metricMeta: { color: colors.muted, fontSize: 8.5, marginTop: 2 },

  chartCard: { padding: 14, marginBottom: 10 },
  sectionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  sectionSub: { color: colors.muted, fontSize: 9, marginTop: 2 },
  chartLegend: { alignItems: 'flex-end', gap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  legendPaid: { backgroundColor: '#119A68' },
  legendBilled: { backgroundColor: '#B9D5CB' },
  legendText: { color: colors.muted, fontSize: 8 },
  chart: { height: 160, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: 10, marginTop: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  chartGroup: { flex: 1, minWidth: 42, alignItems: 'center' },
  chartValue: { color: colors.muted, fontSize: 7.5, marginBottom: 4 },
  barArea: { height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 9, borderRadius: 5 },
  billedBar: { backgroundColor: '#CDE1D9' },
  paidBar: { backgroundColor: '#119A68' },
  chartLabel: { color: colors.muted, fontSize: 7.5, lineHeight: 9, textAlign: 'center', marginTop: 4 },

  healthRow: { flexDirection: 'row', justifyContent: 'space-between' },
  healthCard: { width: '48.4%', padding: 12 },
  healthTitle: { color: colors.text, fontSize: 10.5, fontWeight: '900' },
  healthNumberRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 },
  healthValue: { color: '#0E7757', fontSize: 22, fontWeight: '900' },
  healthMeta: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  rentValue: { color: '#0E7757', fontSize: 14.5, fontWeight: '900', marginTop: 11 },
  rentLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
  rentLabel: { color: colors.muted, fontSize: 9 },
  rentPercent: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  progressTrack: { height: 8, backgroundColor: '#E8EFEC', borderRadius: 99, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', backgroundColor: '#15A36F', borderRadius: 99 },
  collectionFill: { backgroundColor: '#0F766E' },
  healthFoot: { color: colors.muted, fontSize: 9.5, marginTop: 9 },

  headingBlock: { marginTop: 9, marginBottom: 10 },
  heading: { color: colors.text, fontSize: 14.5, fontWeight: '900' },
  headingSub: { color: colors.muted, fontSize: 9, marginTop: 2 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },
  quickAction: { width: '48.4%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 9 },
  quickIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  quickIconText: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  quickTitle: { color: colors.text, fontSize: 10.5, fontWeight: '900', marginTop: 7 },
  quickCaption: { color: colors.muted, fontSize: 8, marginTop: 2 },

  recentCard: { padding: 14 },
  viewAll: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  billRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF2F0', paddingVertical: 10 },
  lastBillRow: { borderBottomWidth: 0 },
  billIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E8F8F1', alignItems: 'center', justifyContent: 'center' },
  billIconText: { color: colors.primary, fontWeight: '900' },
  billCopy: { flex: 1, paddingHorizontal: 10 },
  billTenant: { color: colors.text, fontSize: 10, fontWeight: '900' },
  billMonth: { color: colors.muted, fontSize: 8, marginTop: 2 },
  billRight: { alignItems: 'flex-end' },
  billAmount: { color: colors.text, fontSize: 9, fontWeight: '900' },
  statusPill: { marginTop: 4, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  statusPaid: { backgroundColor: '#DFF7EA' },
  statusPartial: { backgroundColor: '#FFF3D8' },
  statusDue: { backgroundColor: '#FFE5E6' },
  statusText: { color: '#146946', fontSize: 7.5, fontWeight: '900' },

  empty: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingVertical: 24 },
  pressed: { opacity: 0.78 },
});
