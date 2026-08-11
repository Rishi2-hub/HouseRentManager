import React, {
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import {
  addBill,
  deleteBill,
  updateBill,
} from '../db/database';

import {
  Bill,
  Tenant,
} from '../types';

import {
  Button,
  Card,
  Empty,
  Input,
  Label,
  Money,
} from '../components/UI';

import {
  colors,
} from '../theme';

import {
  bsMonthLabel,
  previousBsMonth,
  recentBsMonths,
} from '../lib/nepaliDate';

type BillsScreenProps = {
  tenants: Tenant[];
  bills: Bill[];
  reload: () => void | Promise<void>;
};

function numberValue(
  value: string
): number {
  const converted =
    Number(value);

  return Number.isFinite(converted)
    ? converted
    : 0;
}

function escapeHtml(
  value: string
): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function BillsScreen({
  tenants,
  bills,
  reload,
}: BillsScreenProps) {
  const [saving, setSaving] =
    useState(false);

  const [editingBillId, setEditingBillId] =
    useState('');

  const [tenantId, setTenantId] =
    useState('');

  const [billMonth, setBillMonth] =
    useState(previousBsMonth());

  const [rent, setRent] =
    useState('');

  const [billingMode, setBillingMode] =
    useState<'full_month' | 'by_days'>(
      'full_month'
    );

  const [billedDays, setBilledDays] =
    useState('1');

  const [monthDays, setMonthDays] =
    useState('30');

  const [
    previousElectricityUnit,
    setPreviousElectricityUnit,
  ] = useState('0');

  const [
    currentElectricityUnit,
    setCurrentElectricityUnit,
  ] = useState('0');

  const [
    electricityRate,
    setElectricityRate,
  ] = useState('0');

  const [water, setWater] =
    useState('0');

  const [waste, setWaste] =
    useState('0');

  const [additional, setAdditional] =
    useState('0');

  const [previousDue, setPreviousDue] =
    useState('0');

  const [advanceUsed, setAdvanceUsed] =
    useState('0');

  const [paidAmount, setPaidAmount] =
    useState('0');

  const monthOptions =
    useMemo(
      () => recentBsMonths(),
      []
    );

  const selectedTenant =
    tenants.find(
      (tenant) =>
        tenant.id === tenantId
    );

  const usedElectricityUnits =
    Math.max(
      0,
      numberValue(
        currentElectricityUnit
      ) -
        numberValue(
          previousElectricityUnit
        )
    );

  const electricityAmount =
    usedElectricityUnits *
    numberValue(electricityRate);

  const baseMonthlyRent =
    numberValue(rent);

  const safeMonthDays =
    Math.max(
      1,
      Math.floor(numberValue(monthDays))
    );

  const safeBilledDays =
    Math.max(
      0,
      Math.floor(numberValue(billedDays))
    );

  const calculatedRent =
    billingMode === 'by_days'
      ? Math.round(
          (baseMonthlyRent /
            safeMonthDays) *
            safeBilledDays *
            100
        ) / 100
      : baseMonthlyRent;

  /*
   * When editing a bill, exclude that
   * bill from the previously-used
   * advance calculation.
   */
  const previouslyUsedAdvance =
    bills
      .filter(
        (bill) =>
          bill.tenant_id ===
            tenantId &&
          bill.id !== editingBillId
      )
      .reduce(
        (total, bill) =>
          total +
          Number(
            bill.advance_used || 0
          ),
        0
      );

  const availableAdvance =
    Math.max(
      0,
      Number(
        selectedTenant
          ?.advance_deposit || 0
      ) -
        previouslyUsedAdvance
    );

  const calculatedTotal =
    Math.max(
      0,
      calculatedRent +
        electricityAmount +
        numberValue(water) +
        numberValue(waste) +
        numberValue(additional) +
        numberValue(previousDue) -
        numberValue(advanceUsed)
    );

  const calculatedBalance =
    Math.max(
      0,
      calculatedTotal -
        numberValue(paidAmount)
    );

  function getTenantName(
    billTenantId: string
  ): string {
    const tenant =
      tenants.find(
        (item) =>
          item.id === billTenantId
      );

    return (
      tenant?.full_name ??
      'Unknown tenant'
    );
  }

  function getDepositSummary(
    billTenantId: string
  ) {
    const tenant =
      tenants.find(
        (item) =>
          item.id === billTenantId
      );

    const depositReceived =
      Math.max(
        0,
        Number(
          tenant?.advance_deposit || 0
        )
      );

    const depositUsed =
      bills
        .filter(
          (bill) =>
            bill.tenant_id ===
            billTenantId
        )
        .reduce(
          (total, bill) =>
            total +
            Math.max(
              0,
              Number(
                bill.advance_used || 0
              )
            ),
          0
        );

    return {
      depositReceived,
      depositUsed,
      depositRemaining:
        Math.max(
          0,
          depositReceived -
            depositUsed
        ),
    };
  }

  function selectTenant(
    tenant: Tenant
  ) {
    setTenantId(tenant.id);

    setRent(
      String(
        tenant.monthly_rent
      )
    );

    setAdvanceUsed('0');

    const previousBills =
      bills
        .filter(
          (bill) =>
            bill.tenant_id ===
              tenant.id &&
            bill.id !==
              editingBillId
        )
        .sort(
          (first, second) =>
            second.bill_month.localeCompare(
              first.bill_month
            )
        );

    const latestBill =
      previousBills[0];

    const latestReading =
      latestBill
        ?.current_electricity_unit ??
      0;

    setPreviousElectricityUnit(
      String(latestReading)
    );

    setCurrentElectricityUnit(
      String(latestReading)
    );

    if (
      latestBill?.electricity_rate !==
      undefined
    ) {
      setElectricityRate(
        String(
          latestBill.electricity_rate
        )
      );
    }
  }

  function clearBillForm() {
    setEditingBillId('');
    setTenantId('');
    setBillMonth(
      previousBsMonth()
    );
    setRent('');
    setBillingMode('full_month');
    setBilledDays('1');
    setMonthDays('30');
    setPreviousElectricityUnit('0');
    setCurrentElectricityUnit('0');
    setElectricityRate('0');
    setWater('0');
    setWaste('0');
    setAdditional('0');
    setPreviousDue('0');
    setAdvanceUsed('0');
    setPaidAmount('0');
  }

  function startEditingBill(
    bill: Bill
  ) {
    setEditingBillId(
      bill.id
    );

    setTenantId(
      bill.tenant_id
    );

    setBillMonth(
      bill.bill_month
    );

    const billTenant =
      tenants.find(
        (tenant) =>
          tenant.id ===
          bill.tenant_id
      );

    setBillingMode(
      bill.billing_mode ||
        'full_month'
    );

    setBilledDays(
      String(
        bill.billed_days || 1
      )
    );

    setMonthDays(
      String(
        bill.month_days || 30
      )
    );

    setRent(
      String(
        bill.billing_mode ===
          'by_days'
          ? billTenant?.monthly_rent ??
              bill.rent
          : bill.rent
      )
    );

    setPreviousElectricityUnit(
      String(
        bill.previous_electricity_unit ??
          0
      )
    );

    setCurrentElectricityUnit(
      String(
        bill.current_electricity_unit ??
          0
      )
    );

    setElectricityRate(
      String(
        bill.electricity_rate ?? 0
      )
    );

    setWater(
      String(bill.water)
    );

    setWaste(
      String(bill.waste)
    );

    setAdditional(
      String(bill.additional)
    );

    setPreviousDue(
      String(bill.previous_due)
    );

    setAdvanceUsed(
      String(bill.advance_used)
    );

    setPaidAmount(
      String(bill.paid_amount)
    );
  }

  async function saveBill() {
    if (!selectedTenant) {
      return Alert.alert(
        'Select tenant',
        'Please select the tenant name.'
      );
    }

    if (
      !/^\d{4}-\d{2}$/.test(
        billMonth
      )
    ) {
      return Alert.alert(
        'Invalid Nepali month',
        'Please select a valid Nepali bill month.'
      );
    }

    const rentAmount =
      calculatedRent;

    const totalDaysInMonth =
      Math.floor(
        numberValue(monthDays)
      );

    const chargeableDays =
      Math.floor(
        numberValue(billedDays)
      );

    const previousUnit =
      numberValue(
        previousElectricityUnit
      );

    const currentUnit =
      numberValue(
        currentElectricityUnit
      );

    const perUnitRate =
      numberValue(
        electricityRate
      );

    const depositUsed =
      numberValue(
        advanceUsed
      );

    const amountPaid =
      numberValue(
        paidAmount
      );

    if (rentAmount <= 0) {
      return Alert.alert(
        'Invalid rent',
        'Monthly rent must be greater than zero.'
      );
    }

    if (
      billingMode === 'by_days' &&
      (totalDaysInMonth < 1 ||
        totalDaysInMonth > 32)
    ) {
      return Alert.alert(
        'Invalid month days',
        'Total days in the Nepali month must be between 1 and 32.'
      );
    }

    if (
      billingMode === 'by_days' &&
      (chargeableDays < 1 ||
        chargeableDays >
          totalDaysInMonth)
    ) {
      return Alert.alert(
        'Invalid billed days',
        'Billed days must be between 1 and the total days in the selected month.'
      );
    }

    if (previousUnit < 0) {
      return Alert.alert(
        'Invalid previous unit',
        'Previous electricity unit cannot be negative.'
      );
    }

    if (
      currentUnit < previousUnit
    ) {
      return Alert.alert(
        'Invalid current unit',
        'Current electricity unit must be equal to or greater than the previous unit.'
      );
    }

    if (perUnitRate < 0) {
      return Alert.alert(
        'Invalid electricity rate',
        'Per-unit electricity rate cannot be negative.'
      );
    }

    if (depositUsed < 0) {
      return Alert.alert(
        'Invalid advance amount',
        'Advance deposit used cannot be negative.'
      );
    }

    if (
      depositUsed >
      availableAdvance
    ) {
      return Alert.alert(
        'Insufficient advance deposit',
        `Only NPR ${availableAdvance.toLocaleString()} is available for ${selectedTenant.full_name}.`
      );
    }

    if (amountPaid < 0) {
      return Alert.alert(
        'Invalid paid amount',
        'Paid amount cannot be negative.'
      );
    }

    if (saving) return;

    setSaving(true);

    const billValues = {
      tenant_id:
        selectedTenant.id,

      bill_month:
        billMonth,

      billing_mode:
        billingMode,

      billed_days:
        billingMode === 'by_days'
          ? chargeableDays
          : totalDaysInMonth,

      month_days:
        totalDaysInMonth,

      rent:
        rentAmount,

      previous_electricity_unit:
        previousUnit,

      current_electricity_unit:
        currentUnit,

      electricity_rate:
        perUnitRate,

      water:
        numberValue(water),

      waste:
        numberValue(waste),

      additional:
        numberValue(additional),

      previous_due:
        numberValue(previousDue),

      advance_used:
        depositUsed,

      paid_amount:
        amountPaid,
    };

    try {
      if (editingBillId) {
        await updateBill(
          editingBillId,
          billValues
        );
      } else {
        await addBill(
          billValues
        );
      }

      const successTitle =
        editingBillId
          ? 'Bill updated'
          : 'Bill generated';

      await reload();

      Alert.alert(
        successTitle,
        `${selectedTenant.full_name}'s ${bsMonthLabel(billMonth)} bill was saved successfully.`
      );

      clearBillForm();
    } catch (error) {
      console.error(
        'Bill save error:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown database error';

      if (
        message
          .toLowerCase()
          .includes('unique')
      ) {
        Alert.alert(
          'Bill already exists',
          `${selectedTenant.full_name} already has a bill for ${bsMonthLabel(billMonth)}.`
        );
      } else {
        Alert.alert(
          'Could not save bill',
          message
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteBill(
    bill: Bill
  ) {
    const tenantName =
      getTenantName(
        bill.tenant_id
      );

    Alert.alert(
      'Delete bill?',
      `Delete ${tenantName}'s ${bsMonthLabel(bill.bill_month)} bill?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',

          onPress: async () => {
            try {
              await deleteBill(
                bill.id
              );

              if (
                editingBillId ===
                bill.id
              ) {
                clearBillForm();
              }

              await reload();

              Alert.alert(
                'Bill deleted',
                `${tenantName}'s bill was deleted successfully.`
              );
            } catch (error) {
              console.error(
                'Bill delete error:',
                error
              );

              const message =
                error instanceof Error
                  ? error.message
                  : 'Unknown database error';

              Alert.alert(
                'Could not delete bill',
                message
              );
            }
          },
        },
      ]
    );
  }

  async function createBillPdf(
    bill: Bill
  ) {
    try {
      const tenantName =
        getTenantName(
          bill.tenant_id
        );

      const safeTenantName =
        escapeHtml(
          tenantName
        );

      const depositSummary =
        getDepositSummary(
          bill.tenant_id
        );

      const unitsUsed =
        Math.max(
          0,
          Number(
            bill.current_electricity_unit ||
              0
          ) -
            Number(
              bill.previous_electricity_unit ||
                0
            )
        );

      const billingDescription =
        bill.billing_mode ===
        'by_days'
          ? `By days (${bill.billed_days}/${bill.month_days} days)`
          : 'Full month';

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            >

            <style>
              @page {
                margin: 10mm;
              }

              * {
                box-sizing: border-box;
              }

              html,
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                color: #17211E;
                font-size: 13px;
                line-height: 1.3;
              }

              .header {
                text-align: center;
                border-bottom: 2px solid #216E55;
                padding-bottom: 9px;
                margin-bottom: 11px;
              }

              h1 {
                color: #216E55;
                font-size: 24px;
                line-height: 1.1;
                margin: 0 0 3px 0;
              }

              h2 {
                font-size: 16px;
                line-height: 1.1;
                margin: 0;
              }

              .tenant-box {
                background: #DFF4EA;
                padding: 10px 12px;
                border-radius: 6px;
                margin-bottom: 10px;
                page-break-inside: avoid;
                break-inside: avoid;
              }

              .tenant-box p {
                margin: 3px 0;
              }

              .row {
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #DDE6E2;
                padding: 5px 0;
                line-height: 1.15;
              }

              .total {
                font-size: 17px;
                font-weight: bold;
                color: #216E55;
              }

              .balance {
                font-size: 16px;
                font-weight: bold;
                color: #C53D46;
              }

              .deposit-box {
                background: #FFF4CC;
                border: 1.5px solid #D99A00;
                border-radius: 7px;
                padding: 11px 12px;
                margin-top: 11px;
                page-break-inside: avoid;
                break-inside: avoid;
              }

              .deposit-title {
                color: #7A4A00;
                font-size: 16px;
                font-weight: bold;
                margin: 0 0 7px 0;
              }

              .deposit-row {
                display: flex;
                justify-content: space-between;
                padding: 3px 0;
                font-weight: bold;
              }

              .deposit-notice {
                border-top: 1px solid #E2BA54;
                color: #614817;
                font-size: 10px;
                line-height: 1.35;
                margin: 7px 0 0 0;
                padding-top: 7px;
              }

              .footer {
                text-align: center;
                margin-top: 10px;
                color: #6B7B75;
                font-size: 10px;
                page-break-inside: avoid;
                break-inside: avoid;
              }
            </style>
          </head>

          <body>
            <div class="header">
              <h1>
                House Rent Manager
              </h1>

              <h2>
                Monthly Rent Bill
              </h2>
            </div>

            <div class="tenant-box">
              <p>
                <strong>
                  Tenant name:
                </strong>

                ${safeTenantName}
              </p>

              <p>
                <strong>
                  Nepali month:
                </strong>

                ${bsMonthLabel(
                  bill.bill_month
                )}
              </p>

              <p>
                <strong>
                  Bill status:
                </strong>

                ${bill.status.toUpperCase()}
              </p>

              <p>
                <strong>
                  Rent calculation:
                </strong>

                ${billingDescription}
              </p>
            </div>

            <div class="row">
              <span>House rent</span>

              <span>
                NPR ${Number(
                  bill.rent
                ).toLocaleString()}
              </span>
            </div>

            <div class="row">
              <span>
                Previous electricity unit
              </span>

              <span>
                ${
                  bill.previous_electricity_unit ??
                  0
                }
              </span>
            </div>

            <div class="row">
              <span>
                Current electricity unit
              </span>

              <span>
                ${
                  bill.current_electricity_unit ??
                  0
                }
              </span>
            </div>

            <div class="row">
              <span>
                Electricity calculation
              </span>

              <span>
                ${unitsUsed} units × NPR ${
                  bill.electricity_rate ??
                  0
                }
              </span>
            </div>

            <div class="row">
              <span>
                Electricity amount
              </span>

              <span>
                NPR ${Number(
                  bill.electricity
                ).toLocaleString()}
              </span>
            </div>

            <div class="row">
              <span>Water</span>

              <span>
                NPR ${Number(
                  bill.water
                ).toLocaleString()}
              </span>
            </div>

            <div class="row">
              <span>Waste</span>

              <span>
                NPR ${Number(
                  bill.waste
                ).toLocaleString()}
              </span>
            </div>

            <div class="row">
              <span>
                Additional charge
              </span>

              <span>
                NPR ${Number(
                  bill.additional
                ).toLocaleString()}
              </span>
            </div>

            <div class="row">
              <span>
                Previous due
              </span>

              <span>
                NPR ${Number(
                  bill.previous_due
                ).toLocaleString()}
              </span>
            </div>

            <div class="row">
              <span>
                Advance deposit used
              </span>

              <span>
                NPR ${Number(
                  bill.advance_used
                ).toLocaleString()}
              </span>
            </div>

            <div class="row total">
              <span>Total bill</span>

              <span>
                NPR ${Number(
                  bill.total
                ).toLocaleString()}
              </span>
            </div>

            <div class="row">
              <span>
                Amount paid
              </span>

              <span>
                NPR ${Number(
                  bill.paid_amount
                ).toLocaleString()}
              </span>
            </div>

            <div class="row balance">
              <span>
                Remaining balance
              </span>

              <span>
                NPR ${Number(
                  bill.balance
                ).toLocaleString()}
              </span>
            </div>

            <div class="deposit-box">
              <p class="deposit-title">
                Security advance deposit
              </p>

              <div class="deposit-row">
                <span>Deposit received</span>
                <span>
                  NPR ${depositSummary.depositReceived.toLocaleString()}
                </span>
              </div>

              <div class="deposit-row">
                <span>Used or deducted</span>
                <span>
                  NPR ${depositSummary.depositUsed.toLocaleString()}
                </span>
              </div>

              <div class="deposit-row">
                <span>Remaining refundable deposit</span>
                <span>
                  NPR ${depositSummary.depositRemaining.toLocaleString()}
                </span>
              </div>

              <p class="deposit-notice">
                This security deposit is separate from the monthly bill.
                The remaining amount will normally be returned when the
                tenant leaves the room or flat, after deducting final-month
                dues, unpaid charges, and any owner-assessed damage to the
                floor, room, or flat.
              </p>
            </div>

            <div class="footer">
              Generated by House Rent Manager
            </div>
          </body>
        </html>
      `;

      /*
       * Android WebView can ignore part of the CSS page sizing.
       * Keep Expo's default PDF page size. Start at the normal
       * 100% Android text scale, and reduce only when the device
       * reports that the content needs a second page.
       */
      const zoomAttempts = [
        100,
        94,
        88,
        82,
      ];

      let printResult:
        Awaited<
          ReturnType<
            typeof Print.printToFileAsync
          >
        > | null = null;

      for (const textZoom of zoomAttempts) {
        printResult =
          await Print.printToFileAsync({
            html,
            textZoom,
          });

        if (
          printResult.numberOfPages <= 1
        ) {
          break;
        }
      }

      if (!printResult) {
        throw new Error(
          'The bill PDF could not be created.'
        );
      }

      const { uri } = printResult;

      const canShare =
        await Sharing.isAvailableAsync();

      if (!canShare) {
        return Alert.alert(
          'PDF created',
          `The bill PDF was created at ${uri}`
        );
      }

      await Sharing.shareAsync(
        uri,
        {
          mimeType:
            'application/pdf',

          dialogTitle:
            `Share ${tenantName}'s rent bill`,
        }
      );
    } catch (error) {
      console.error(
        'PDF creation error:',
        error
      );

      Alert.alert(
        'PDF error',
        'Could not create the bill PDF.'
      );
    }
  }

  return (
    <View>
      {/* Screen heading */}

      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>
            Monthly Bills
          </Text>

          <Text style={styles.subtitle}>
            {bills.length}{' '}
            bill
            {bills.length === 1
              ? ''
              : 's'}{' '}
            generated
          </Text>
        </View>

        {editingBillId ? (
          <Pressable
            onPress={clearBillForm}
          >
            <Text
              style={styles.cancelEdit}
            >
              Cancel edit
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Generate or edit bill */}

      <Card>
        <Text style={styles.formTitle}>
          {editingBillId
            ? 'Edit monthly bill'
            : 'Generate Nepali monthly bill'}
        </Text>

        <Text style={styles.help}>
          The previous Nepali month is selected automatically.
          For example, when the current month is Bhadra, select
          Shrawan to generate the completed Shrawan bill.
        </Text>

        <Label>Select tenant</Label>

        {tenants.length === 0 ? (
          <Text style={styles.warning}>
            No tenants found. Add a tenant before generating a
            bill.
          </Text>
        ) : (
          <View style={styles.tenantList}>
            {tenants.map(
              (tenant) => (
                <Button
                  key={tenant.id}
                  title={
                    tenantId ===
                    tenant.id
                      ? `✓ ${tenant.full_name}`
                      : tenant.full_name
                  }
                  kind={
                    tenantId ===
                    tenant.id
                      ? 'primary'
                      : 'secondary'
                  }
                  onPress={() =>
                    selectTenant(
                      tenant
                    )
                  }
                />
              )
            )}
          </View>
        )}

        {selectedTenant && (
          <View
            style={
              styles.selectedTenant
            }
          >
            <Text
              style={
                styles.selectedTenantName
              }
            >
              Tenant:{' '}
              {selectedTenant.full_name}
            </Text>

            <Text
              style={
                styles.selectedTenantDetails
              }
            >
              Phone:{' '}
              {selectedTenant.phone}
            </Text>

            <Text
              style={
                styles.selectedTenantDetails
              }
            >
              Monthly rent: NPR{' '}
              {Number(
                selectedTenant.monthly_rent
              ).toLocaleString()}
            </Text>

            <Text
              style={
                styles.selectedTenantDetails
              }
            >
              Available advance: NPR{' '}
              {availableAdvance.toLocaleString()}
            </Text>
          </View>
        )}

        <Label>
          Bill month (Nepali BS)
        </Label>

        <View style={styles.months}>
          {monthOptions.map(
            (month) => (
              <Pressable
                key={month}
                onPress={() =>
                  setBillMonth(month)
                }
                style={[
                  styles.monthChip,

                  billMonth === month &&
                    styles.selectedMonthChip,
                ]}
              >
                <Text
                  style={
                    billMonth === month
                      ? styles.selectedMonthText
                      : styles.monthText
                  }
                >
                  {bsMonthLabel(
                    month
                  )}
                </Text>
              </Pressable>
            )
          )}
        </View>

        <Label>
          House rent (NPR)
        </Label>

        <Input
          value={rent}
          onChangeText={setRent}
          keyboardType="numeric"
          placeholder="Monthly rent"
        />

        <Label>
          Rent calculation method
        </Label>

        <View style={styles.billingModeRow}>
          <Pressable
            onPress={() =>
              setBillingMode(
                'full_month'
              )
            }
            style={[
              styles.billingModeButton,
              billingMode ===
                'full_month' &&
                styles.billingModeButtonSelected,
            ]}
          >
            <Text
              style={[
                styles.billingModeText,
                billingMode ===
                  'full_month' &&
                  styles.billingModeTextSelected,
              ]}
            >
              Full month
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setBillingMode(
                'by_days'
              )
            }
            style={[
              styles.billingModeButton,
              billingMode ===
                'by_days' &&
                styles.billingModeButtonSelected,
            ]}
          >
            <Text
              style={[
                styles.billingModeText,
                billingMode ===
                  'by_days' &&
                  styles.billingModeTextSelected,
              ]}
            >
              By days
            </Text>
          </Pressable>
        </View>

        {billingMode === 'by_days' ? (
          <View style={styles.dayCalculationCard}>
            <View style={styles.inputRow}>
              <View style={styles.halfInput}>
                <Label>
                  Days occupied
                </Label>

                <Input
                  value={billedDays}
                  onChangeText={setBilledDays}
                  keyboardType="number-pad"
                  placeholder="Example: 12"
                />
              </View>

              <View style={styles.halfInput}>
                <Label>
                  Total month days
                </Label>

                <Input
                  value={monthDays}
                  onChangeText={setMonthDays}
                  keyboardType="number-pad"
                  placeholder="Example: 30"
                />
              </View>
            </View>

            <Text style={styles.dayFormula}>
              NPR{' '}
              {baseMonthlyRent.toLocaleString()}
              {' ÷ '}
              {safeMonthDays}
              {' × '}
              {safeBilledDays}
              {' = NPR '}
              {calculatedRent.toLocaleString()}
            </Text>

            <Text style={styles.dayHelp}>
              Only this calculated rent is included in the bill.
              Electricity, water, waste and other charges are added
              separately.
            </Text>
          </View>
        ) : (
          <View style={styles.fullMonthCard}>
            <Text style={styles.fullMonthText}>
              Full monthly rent: NPR{' '}
              {calculatedRent.toLocaleString()}
            </Text>
          </View>
        )}

        <Text
          style={styles.sectionTitle}
        >
          Electricity meter
        </Text>

        <View style={styles.inputRow}>
          <View style={styles.thirdInput}>
            <Label>
              Previous unit
            </Label>

            <Input
              value={
                previousElectricityUnit
              }
              onChangeText={
                setPreviousElectricityUnit
              }
              keyboardType="numeric"
            />
          </View>

          <View style={styles.thirdInput}>
            <Label>
              Current unit
            </Label>

            <Input
              value={
                currentElectricityUnit
              }
              onChangeText={
                setCurrentElectricityUnit
              }
              keyboardType="numeric"
            />
          </View>

          <View style={styles.thirdInput}>
            <Label>Cost/unit</Label>

            <Input
              value={
                electricityRate
              }
              onChangeText={
                setElectricityRate
              }
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.calculation}>
          {usedElectricityUnits.toLocaleString()}{' '}
          units × NPR{' '}
          {numberValue(
            electricityRate
          ).toLocaleString()}{' '}
          = NPR{' '}
          {electricityAmount.toLocaleString()}
        </Text>

        <View style={styles.inputRow}>
          <View style={styles.halfInput}>
            <Label>Water</Label>

            <Input
              value={water}
              onChangeText={setWater}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.halfInput}>
            <Label>Waste</Label>

            <Input
              value={waste}
              onChangeText={setWaste}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.halfInput}>
            <Label>Additional</Label>

            <Input
              value={additional}
              onChangeText={
                setAdditional
              }
              keyboardType="numeric"
            />
          </View>

          <View style={styles.halfInput}>
            <Label>
              Previous due
            </Label>

            <Input
              value={previousDue}
              onChangeText={
                setPreviousDue
              }
              keyboardType="numeric"
            />
          </View>
        </View>

        <Label>
          Advance deposit used
        </Label>

        <Input
          value={advanceUsed}
          onChangeText={
            setAdvanceUsed
          }
          keyboardType="numeric"
          placeholder="0"
        />

        {selectedTenant && (
          <View style={styles.depositCard}>
            <Text style={styles.depositTitle}>
              Security advance deposit
            </Text>

            <View style={styles.depositRow}>
              <Text style={styles.depositLabel}>
                Deposit received
              </Text>

              <Text style={styles.depositAmount}>
                NPR{' '}
                {Number(
                  selectedTenant.advance_deposit || 0
                ).toLocaleString()}
              </Text>
            </View>

            <View style={styles.depositRow}>
              <Text style={styles.depositLabel}>
                Available after other bills
              </Text>

              <Text style={styles.depositRemaining}>
                NPR{' '}
                {availableAdvance.toLocaleString()}
              </Text>
            </View>

            <Text style={styles.depositNotice}>
              This deposit is separate from the monthly bill. The
              remaining amount will normally be returned when the tenant
              leaves, after final-month dues, unpaid charges, or any
              owner-assessed damage to the floor, room, or flat is
              deducted.
            </Text>
          </View>
        )}

        <Label>
          Amount paid now
        </Label>

        <Input
          value={paidAmount}
          onChangeText={
            setPaidAmount
          }
          keyboardType="numeric"
          placeholder="0"
        />

        <View style={styles.summary}>
          <View
            style={styles.summaryItem}
          >
            <Text
              style={styles.summaryLabel}
            >
              Bill total
            </Text>

            <Money
              value={
                calculatedTotal
              }
            />
          </View>

          <View
            style={styles.summaryItem}
          >
            <Text
              style={styles.summaryLabel}
            >
              Balance
            </Text>

            <Money
              value={
                calculatedBalance
              }
            />
          </View>
        </View>

        <Button
          disabled={
            saving ||
            tenants.length === 0
          }
          title={
            saving
              ? 'Saving Bill...'
              : editingBillId
                ? 'Update Bill'
                : selectedTenant
                  ? `Generate for ${selectedTenant.full_name}`
                  : 'Generate Bill'
          }
          onPress={saveBill}
        />

        {editingBillId && (
          <Button
            title="Cancel editing"
            kind="secondary"
            onPress={clearBillForm}
          />
        )}
      </Card>

      {/* Generated bill history */}

      <Text style={styles.historyTitle}>
        Generated bills
      </Text>

      {bills.map((bill) => {
        const tenantName =
          getTenantName(
            bill.tenant_id
          );

        const consumedUnits =
          Math.max(
            0,
            Number(
              bill.current_electricity_unit ||
                0
            ) -
              Number(
                bill.previous_electricity_unit ||
                  0
              )
          );

        const depositSummary =
          getDepositSummary(
            bill.tenant_id
          );

        return (
          <Card key={bill.id}>
            <View
              style={styles.billHeader}
            >
              <View
                style={
                  styles.billInformation
                }
              >
                <Text
                  style={
                    styles.billTenantName
                  }
                >
                  {tenantName}
                </Text>

                <Text
                  style={styles.billMonth}
                >
                  {bsMonthLabel(
                    bill.bill_month
                  )}
                </Text>

                <Text
                  style={styles.billStatus}
                >
                  Status:{' '}
                  {bill.status.toUpperCase()}
                </Text>

                <Text
                  style={styles.billStatus}
                >
                  Rent method:{' '}
                  {bill.billing_mode ===
                  'by_days'
                    ? `By days (${bill.billed_days}/${bill.month_days})`
                    : 'Full month'}
                </Text>

                <Text
                  style={styles.billStatus}
                >
                  Rent charged: NPR{' '}
                  {Number(
                    bill.rent
                  ).toLocaleString()}
                </Text>

                <Text
                  style={styles.billStatus}
                >
                  Electricity:{' '}
                  {consumedUnits} units
                  {' · '}NPR{' '}
                  {Number(
                    bill.electricity
                  ).toLocaleString()}
                </Text>

                <Text
                  style={styles.billStatus}
                >
                  Paid: NPR{' '}
                  {Number(
                    bill.paid_amount
                  ).toLocaleString()}
                </Text>

                <Text
                  style={
                    styles.billBalance
                  }
                >
                  Balance: NPR{' '}
                  {Number(
                    bill.balance
                  ).toLocaleString()}
                </Text>
              </View>

              <Money
                value={Number(
                  bill.total
                )}
              />
            </View>

            <View style={styles.depositCard}>
              <Text style={styles.depositTitle}>
                Security advance deposit
              </Text>

              <View style={styles.depositRow}>
                <Text style={styles.depositLabel}>
                  Deposit received
                </Text>

                <Text style={styles.depositAmount}>
                  NPR{' '}
                  {depositSummary.depositReceived.toLocaleString()}
                </Text>
              </View>

              <View style={styles.depositRow}>
                <Text style={styles.depositLabel}>
                  Used or deducted
                </Text>

                <Text style={styles.depositAmount}>
                  NPR{' '}
                  {depositSummary.depositUsed.toLocaleString()}
                </Text>
              </View>

              <View style={styles.depositRow}>
                <Text style={styles.depositLabel}>
                  Remaining refundable deposit
                </Text>

                <Text style={styles.depositRemaining}>
                  NPR{' '}
                  {depositSummary.depositRemaining.toLocaleString()}
                </Text>
              </View>

              <Text style={styles.depositNotice}>
                This deposit is separate from the monthly bill. The
                remaining amount will normally be returned when the tenant
                leaves, after final-month dues, unpaid charges, or any
                owner-assessed damage to the floor, room, or flat is
                deducted.
              </Text>
            </View>

            <Button
              title={`Create PDF for ${tenantName}`}
              kind="secondary"
              onPress={() =>
                createBillPdf(
                  bill
                )
              }
            />

            <View style={styles.actions}>
              <View style={styles.action}>
                <Button
                  title="Edit"
                  kind="secondary"
                  onPress={() =>
                    startEditingBill(
                      bill
                    )
                  }
                />
              </View>

              <View style={styles.action}>
                <Button
                  title="Delete"
                  kind="danger"
                  onPress={() =>
                    confirmDeleteBill(
                      bill
                    )
                  }
                />
              </View>
            </View>
          </Card>
        );
      })}

      {bills.length === 0 && (
        <Empty text="No monthly bills generated." />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },

  subtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },

  cancelEdit: {
    color: colors.danger,
    fontWeight: '900',
    fontSize: 13,
  },

  formTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 6,
  },

  help: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: 16,
  },

  warning: {
    color: colors.danger,
    marginBottom: 12,
  },

  tenantList: {
    marginBottom: 6,
  },

  selectedTenant: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: '#B9DFCF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
  },

  selectedTenantName: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },

  selectedTenantDetails: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },

  months: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },

  monthChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  selectedMonthChip: {
    backgroundColor: colors.primary,
  },

  monthText: {
    fontSize: 11,
    color: colors.text,
  },

  selectedMonthText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 9,
  },

  inputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  halfInput: {
    width: '48%',
  },

  thirdInput: {
    width: '31%',
  },

  calculation: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 13,
    marginTop: -3,
    marginBottom: 14,
  },

  available: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12,
    marginTop: -7,
    marginBottom: 13,
  },

  billingModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  billingModeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.bg,
  },

  billingModeButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  billingModeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },

  billingModeTextSelected: {
    color: '#FFFFFF',
  },

  dayCalculationCard: {
    backgroundColor: '#EAF7F1',
    borderWidth: 1,
    borderColor: '#B9DFCF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },

  dayFormula: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },

  dayHelp: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },

  fullMonthCard: {
    backgroundColor: '#EAF7F1',
    borderWidth: 1,
    borderColor: '#B9DFCF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },

  fullMonthText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },

  depositCard: {
    backgroundColor: '#FFF4CC',
    borderWidth: 2,
    borderColor: '#D99A00',
    borderRadius: 12,
    padding: 13,
    marginTop: 3,
    marginBottom: 14,
  },

  depositTitle: {
    color: '#7A4A00',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },

  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 5,
  },

  depositLabel: {
    color: '#614817',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  depositAmount: {
    color: '#7A4A00',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },

  depositRemaining: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },

  depositNotice: {
    borderTopWidth: 1,
    borderTopColor: '#E2BA54',
    color: '#614817',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
    paddingTop: 9,
  },

  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginBottom: 8,
  },

  summaryItem: {
    width: '48%',
  },

  summaryLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '800',
    marginBottom: 4,
  },

  historyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    marginTop: 8,
    marginBottom: 12,
  },

  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  billInformation: {
    flex: 1,
    paddingRight: 8,
  },

  billTenantName: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.primary,
  },

  billMonth: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },

  billStatus: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },

  billBalance: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '800',
    marginTop: 5,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  action: {
    width: '48%',
  },
});
