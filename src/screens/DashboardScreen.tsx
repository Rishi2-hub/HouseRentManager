import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Bill,
  Room,
  Tab,
  Tenant,
} from '../types';

import {
  Card,
  Money,
} from '../components/UI';

import {
  colors,
  shadow,
} from '../theme';

import {
  bsMonthLabel,
} from '../lib/nepaliDate';

type DashboardScreenProps = {
  rooms: Room[];
  tenants: Tenant[];
  bills: Bill[];
  onNavigate: (tab: Tab) => void;
};

export function DashboardScreen({
  rooms,
  tenants,
  bills,
  onNavigate,
}: DashboardScreenProps) {
  const occupiedRooms =
    rooms.filter(
      (room) =>
        room.status === 'occupied'
    ).length;

  const vacantRooms =
    rooms.length - occupiedRooms;

  const occupancyPercentage =
    rooms.length > 0
      ? Math.round(
          (occupiedRooms /
            rooms.length) *
            100
        )
      : 0;

  const totalCollected =
    bills.reduce(
      (total, bill) =>
        total +
        Number(
          bill.paid_amount || 0
        ),
      0
    );

  const totalOutstanding =
    bills.reduce(
      (total, bill) =>
        total +
        Number(
          bill.balance || 0
        ),
      0
    );

  const expectedMonthlyRent =
    tenants.reduce(
      (total, tenant) =>
        total +
        Number(
          tenant.monthly_rent || 0
        ),
      0
    );

  function getTenantName(
    tenantId: string
  ): string {
    const tenant =
      tenants.find(
        (item) =>
          item.id === tenantId
      );

    return (
      tenant?.full_name ??
      'Unknown tenant'
    );
  }

  return (
    <View>
      {/* Welcome section */}

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroContent}>
            <Text style={styles.eyebrow}>
              HOUSE RENT MANAGER
            </Text>

            <Text style={styles.welcome}>
              Namaste, House Owner
            </Text>

            <Text style={styles.subtitle}>
              Everything about your rental
              property in one place.
            </Text>
          </View>

          <View style={styles.logo}>
            <Text style={styles.logoText}>
              HR
            </Text>
          </View>
        </View>

        <View style={styles.heroMoney}>
          <Text style={styles.heroLabel}>
            Expected monthly rent
          </Text>

          <Text style={styles.heroValue}>
            NPR{' '}
            {expectedMonthlyRent.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Overview cards */}

      <Text style={styles.sectionTitle}>
        Overview
      </Text>

      <View style={styles.grid}>
        <DashboardMetric
          icon="👥"
          label="Tenants"
          value={String(
            tenants.length
          )}
          backgroundColor="#E8F3FF"
          onPress={() =>
            onNavigate('Tenants')
          }
        />

        <DashboardMetric
          icon="🏠"
          label="Total rooms"
          value={String(
            rooms.length
          )}
          backgroundColor="#F2ECFF"
          onPress={() =>
            onNavigate('Properties')
          }
        />

        <DashboardMetric
          icon="✓"
          label="Occupied"
          value={String(
            occupiedRooms
          )}
          backgroundColor="#E4F7ED"
          onPress={() =>
            onNavigate('Properties')
          }
        />

        <DashboardMetric
          icon="＋"
          label="Vacant"
          value={String(
            vacantRooms
          )}
          backgroundColor="#FFF3DF"
          onPress={() =>
            onNavigate('Properties')
          }
        />
      </View>

      {/* Occupancy progress */}

      <Card style={styles.occupancyCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>
              Room occupancy
            </Text>

            <Text style={styles.cardSubtitle}>
              {occupiedRooms} of{' '}
              {rooms.length} rooms occupied
            </Text>
          </View>

          <Text style={styles.percentage}>
            {occupancyPercentage}%
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              {
                width:
                  `${occupancyPercentage}%`,
              },
            ]}
          />
        </View>
      </Card>

      {/* Financial summary */}

      <View style={styles.moneyGrid}>
        <View
          style={[
            styles.moneyCard,
            styles.collectedCard,
          ]}
        >
          <Text style={styles.moneyLabel}>
            Total collected
          </Text>

          <Text
            style={[
              styles.moneyValue,
              styles.collectedValue,
            ]}
          >
            NPR{' '}
            {totalCollected.toLocaleString()}
          </Text>
        </View>

        <View
          style={[
            styles.moneyCard,
            styles.outstandingCard,
          ]}
        >
          <Text style={styles.moneyLabel}>
            Outstanding
          </Text>

          <Text
            style={[
              styles.moneyValue,
              styles.outstandingValue,
            ]}
          >
            NPR{' '}
            {totalOutstanding.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Quick actions */}

      <Text style={styles.sectionTitle}>
        Quick actions
      </Text>

      <View style={styles.quickActions}>
        <QuickAction
          title="Add property"
          icon="🏢"
          onPress={() =>
            onNavigate('Properties')
          }
        />

        <QuickAction
          title="Add tenant"
          icon="👤"
          onPress={() =>
            onNavigate('Tenants')
          }
        />

        <QuickAction
          title="Generate bill"
          icon="🧾"
          onPress={() =>
            onNavigate('Bills')
          }
        />
      </View>

      {/* Recent bills */}

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>
            Recent bills
          </Text>

          <Pressable
            onPress={() =>
              onNavigate('Bills')
            }
          >
            <Text style={styles.viewAll}>
              View all
            </Text>
          </Pressable>
        </View>

        {bills
          .slice(0, 5)
          .map((bill) => (
            <View
              key={bill.id}
              style={styles.billRow}
            >
              <View style={styles.billIcon}>
                <Text>🧾</Text>
              </View>

              <View style={styles.billInfo}>
                <Text
                  style={styles.tenantName}
                >
                  {getTenantName(
                    bill.tenant_id
                  )}
                </Text>

                <Text
                  style={
                    styles.cardSubtitle
                  }
                >
                  {bsMonthLabel(
                    bill.bill_month
                  )}
                  {' · '}
                  {bill.status.toUpperCase()}
                </Text>
              </View>

              <Money
                value={Number(
                  bill.total
                )}
              />
            </View>
          ))}

        {bills.length === 0 && (
          <Text style={styles.noRecords}>
            No bills generated yet.
          </Text>
        )}
      </Card>
    </View>
  );
}

type DashboardMetricProps = {
  icon: string;
  label: string;
  value: string;
  backgroundColor: string;
  onPress: () => void;
};

function DashboardMetric({
  icon,
  label,
  value,
  backgroundColor,
  onPress,
}: DashboardMetricProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.metric,
        {
          backgroundColor,
        },
      ]}
    >
      <Text style={styles.metricIcon}>
        {icon}
      </Text>

      <Text style={styles.metricValue}>
        {value}
      </Text>

      <Text style={styles.metricLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

type QuickActionProps = {
  title: string;
  icon: string;
  onPress: () => void;
};

function QuickAction({
  title,
  icon,
  onPress,
}: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.quickAction}
    >
      <Text style={styles.quickActionIcon}>
        {icon}
      </Text>

      <Text style={styles.quickActionText}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
    ...shadow,
  },

  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  heroContent: {
    flex: 1,
    paddingRight: 12,
  },

  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#BDE4D4',
    fontWeight: '900',
  },

  welcome: {
    fontSize: 23,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 6,
  },

  subtitle: {
    fontSize: 12,
    color: '#D8EFE6',
    marginTop: 6,
    maxWidth: 260,
    lineHeight: 18,
  },

  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor:
      'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
  },

  heroMoney: {
    borderTopWidth: 1,
    borderTopColor:
      'rgba(255,255,255,0.20)',
    marginTop: 18,
    paddingTop: 15,
  },

  heroLabel: {
    color: '#D8EFE6',
    fontSize: 11,
  },

  heroValue: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 3,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 11,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  metric: {
    width: '48%',
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
    minHeight: 126,
  },

  metricIcon: {
    fontSize: 20,
  },

  metricValue: {
    fontSize: 27,
    fontWeight: '900',
    color: colors.primaryDark,
    marginTop: 7,
  },

  metricLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    marginTop: 2,
  },

  occupancyCard: {
    marginTop: 2,
  },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },

  cardSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },

  percentage: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },

  progressTrack: {
    height: 9,
    backgroundColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 15,
  },

  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 8,
  },

  moneyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  moneyCard: {
    width: '48%',
    borderRadius: 16,
    padding: 15,
  },

  collectedCard: {
    backgroundColor: '#E8F7EF',
  },

  outstandingCard: {
    backgroundColor: '#FFF0F1',
  },

  moneyLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '700',
  },

  moneyValue: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 7,
  },

  collectedValue: {
    color: colors.success,
  },

  outstandingValue: {
    color: colors.danger,
  },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  quickAction: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 5,
    alignItems: 'center',
  },

  quickActionIcon: {
    fontSize: 23,
  },

  quickActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    marginTop: 7,
    textAlign: 'center',
  },

  viewAll: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },

  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  billIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  billInfo: {
    flex: 1,
    paddingHorizontal: 10,
  },

  tenantName: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },

  noRecords: {
    color: colors.muted,
    textAlign: 'center',
    padding: 20,
  },
});