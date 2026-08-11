import React, {
  useState,
} from 'react';

import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import {
  addDocument,
  addTenant,
  deleteTenant,
  updateTenant,
} from '../db/database';

import {
  Button,
  Card,
  Empty,
  Input,
  Label,
  Money,
} from '../components/UI';

import {
  Room,
  Tenant,
} from '../types';

import {
  colors,
} from '../theme';

const identityTypes = [
  'Citizenship',
  'NID (National ID)',
  'Passport',
  'Driving License',
  'Aadhaar Card',
  'Other',
];

type TenantsScreenProps = {
  rooms: Room[];
  tenants: Tenant[];
  reload: () => void | Promise<void>;
};

export function TenantsScreen({
  rooms,
  tenants,
  reload,
}: TenantsScreenProps) {
  const [showAddForm, setShowAddForm] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [
    editingTenant,
    setEditingTenant,
  ] = useState<Tenant>();

  const [roomId, setRoomId] =
    useState('');

  const [fullName, setFullName] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [identityType, setIdentityType] =
    useState(identityTypes[0]);

  const [identityNumber, setIdentityNumber] =
    useState('');

  const [monthlyRent, setMonthlyRent] =
    useState('');

  const [advanceDeposit, setAdvanceDeposit] =
    useState('0');

  const [photo, setPhoto] =
    useState<string>();

  const [
    identityDocument,
    setIdentityDocument,
  ] =
    useState<DocumentPicker.DocumentPickerAsset>();

  const vacantRooms =
    rooms.filter(
      (room) =>
        room.status === 'vacant'
    );

  async function selectTenantPhoto() {
    try {
      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.75,
          }
        );

      if (!result.canceled) {
        setPhoto(
          result.assets[0].uri
        );
      }
    } catch (error) {
      Alert.alert(
        'Photo error',
        'Could not select the tenant photo.'
      );
    }
  }

  async function selectIdentityDocument() {
    try {
      const result =
        await DocumentPicker.getDocumentAsync(
          {
            type: [
              'image/*',
              'application/pdf',
            ],

            copyToCacheDirectory:
              true,
          }
        );

      if (!result.canceled) {
        setIdentityDocument(
          result.assets[0]
        );
      }
    } catch (error) {
      Alert.alert(
        'Document error',
        'Could not select the identity document.'
      );
    }
  }

  function clearAddForm() {
    setRoomId('');
    setFullName('');
    setPhone('');
    setIdentityType(
      identityTypes[0]
    );
    setIdentityNumber('');
    setMonthlyRent('');
    setAdvanceDeposit('0');
    setPhoto(undefined);
    setIdentityDocument(undefined);
  }

  function toggleAddForm() {
    setShowAddForm(
      (current) => !current
    );

    setEditingTenant(undefined);
  }

  async function saveTenant() {
    const rentAmount =
      Number(monthlyRent);

    const depositAmount =
      Number(advanceDeposit || 0);

    if (!roomId) {
      return Alert.alert(
        'Select room',
        'Please select a vacant room.'
      );
    }

    if (!fullName.trim()) {
      return Alert.alert(
        'Tenant name required',
        'Please enter the tenant full name.'
      );
    }

    if (!phone.trim()) {
      return Alert.alert(
        'Phone required',
        'Please enter the tenant phone number.'
      );
    }

    if (!identityNumber.trim()) {
      return Alert.alert(
        'Identity number required',
        'Please enter the identity document number.'
      );
    }

    if (
      !Number.isFinite(rentAmount) ||
      rentAmount <= 0
    ) {
      return Alert.alert(
        'Invalid rent',
        'Please enter a valid monthly rent.'
      );
    }

    if (
      !Number.isFinite(depositAmount) ||
      depositAmount < 0
    ) {
      return Alert.alert(
        'Invalid deposit',
        'Advance deposit cannot be negative.'
      );
    }

    if (saving) return;

    setSaving(true);

    try {
      const tenant =
        await addTenant({
          room_id: roomId,

          full_name:
            fullName.trim(),

          phone:
            phone.trim(),

          id_type:
            identityType,

          id_number:
            identityNumber.trim(),

          move_in_date:
            new Date()
              .toISOString()
              .slice(0, 10),

          monthly_rent:
            rentAmount,

          advance_deposit:
            depositAmount,

          photo_uri:
            photo,
        });

      let documentFailed = false;

      if (identityDocument) {
        try {
          await addDocument({
            tenant_id:
              tenant.id,

            document_type:
              identityType,

            local_uri:
              identityDocument.uri,

            file_name:
              identityDocument.name,

            mime_type:
              identityDocument.mimeType,
          });
        } catch (error) {
          console.error(
            'Document save error:',
            error
          );

          documentFailed = true;
        }
      }

      clearAddForm();
      setShowAddForm(false);

      await reload();

      if (documentFailed) {
        Alert.alert(
          'Tenant saved',
          `${tenant.full_name} was saved, but the identity document could not be saved.`
        );
      } else {
        Alert.alert(
          'Tenant saved',
          `${tenant.full_name} was added successfully.`
        );
      }
    } catch (error) {
      console.error(
        'Tenant save error:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown database error';

      Alert.alert(
        'Could not save tenant',
        message
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditingTenant(
    tenant: Tenant
  ) {
    setEditingTenant({
      ...tenant,
    });

    setShowAddForm(false);
  }

  async function saveTenantChanges() {
    if (!editingTenant) return;

    const rentAmount =
      Number(
        editingTenant.monthly_rent
      );

    const depositAmount =
      Number(
        editingTenant.advance_deposit
      );

    if (
      !editingTenant.full_name.trim()
    ) {
      return Alert.alert(
        'Tenant name required',
        'Enter the tenant full name.'
      );
    }

    if (
      !editingTenant.phone.trim()
    ) {
      return Alert.alert(
        'Phone required',
        'Enter the tenant phone number.'
      );
    }

    if (
      !editingTenant.id_number.trim()
    ) {
      return Alert.alert(
        'Identity number required',
        'Enter the identity number.'
      );
    }

    if (
      !Number.isFinite(rentAmount) ||
      rentAmount <= 0
    ) {
      return Alert.alert(
        'Invalid rent',
        'Enter a valid monthly rent.'
      );
    }

    if (
      !Number.isFinite(depositAmount) ||
      depositAmount < 0
    ) {
      return Alert.alert(
        'Invalid deposit',
        'Advance deposit cannot be negative.'
      );
    }

    if (saving) return;

    setSaving(true);

    try {
      await updateTenant(
        editingTenant.id,
        {
          full_name:
            editingTenant.full_name.trim(),

          phone:
            editingTenant.phone.trim(),

          id_type:
            editingTenant.id_type,

          id_number:
            editingTenant.id_number.trim(),

          monthly_rent:
            rentAmount,

          advance_deposit:
            depositAmount,

          notes:
            editingTenant.notes,
        }
      );

      setEditingTenant(undefined);

      await reload();

      Alert.alert(
        'Tenant updated',
        'The tenant details were updated successfully.'
      );
    } catch (error) {
      console.error(
        'Tenant update error:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown database error';

      Alert.alert(
        'Could not update tenant',
        message
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteTenant(
    tenant: Tenant
  ) {
    Alert.alert(
      'Delete tenant?',
      `Delete ${tenant.full_name}? The tenant's bills and documents will also be deleted. The assigned room will become vacant.`,
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
              await deleteTenant(
                tenant.id
              );

              if (
                editingTenant?.id ===
                tenant.id
              ) {
                setEditingTenant(
                  undefined
                );
              }

              await reload();

              Alert.alert(
                'Tenant deleted',
                `${tenant.full_name} was deleted successfully.`
              );
            } catch (error) {
              console.error(
                'Tenant delete error:',
                error
              );

              const message =
                error instanceof Error
                  ? error.message
                  : 'Unknown database error';

              Alert.alert(
                'Could not delete tenant',
                message
              );
            }
          },
        },
      ]
    );
  }

  function getRoomNumber(
    tenantRoomId: string
  ): string {
    const room =
      rooms.find(
        (item) =>
          item.id === tenantRoomId
      );

    return (
      room?.room_number ??
      'Unknown'
    );
  }

  return (
    <View>
      {/* Screen heading */}

      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>
            Tenants
          </Text>

          <Text style={styles.subtitle}>
            {tenants.length}{' '}
            tenant
            {tenants.length === 1
              ? ''
              : 's'}{' '}
            registered
          </Text>
        </View>

        <Pressable
          onPress={toggleAddForm}
        >
          <Text style={styles.addButton}>
            {showAddForm
              ? 'Close'
              : '+ Add'}
          </Text>
        </Pressable>
      </View>

      {/* Add tenant form */}

      {showAddForm && (
        <Card>
          <Text style={styles.formTitle}>
            Add new tenant
          </Text>

          <Label>Vacant room</Label>

          {vacantRooms.length === 0 ? (
            <Text style={styles.warning}>
              No vacant rooms available.
              Add a new room or delete the
              previous tenant first.
            </Text>
          ) : (
            <View style={styles.chips}>
              {vacantRooms.map(
                (room) => (
                  <Pressable
                    key={room.id}
                    onPress={() => {
                      setRoomId(
                        room.id
                      );

                      setMonthlyRent(
                        String(
                          room.monthly_rent
                        )
                      );
                    }}
                    style={[
                      styles.chip,

                      roomId === room.id &&
                        styles.selectedChip,
                    ]}
                  >
                    <Text
                      style={
                        roomId === room.id
                          ? styles.selectedChipText
                          : styles.chipText
                      }
                    >
                      Room{' '}
                      {room.room_number}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          )}

          <Label>Full name</Label>

          <Input
            value={fullName}
            onChangeText={
              setFullName
            }
            placeholder="Tenant full name"
          />

          <Label>Phone</Label>

          <Input
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="98XXXXXXXX"
          />

          <Label>Identity type</Label>

          <View style={styles.chips}>
            {identityTypes.map(
              (type) => (
                <Pressable
                  key={type}
                  onPress={() =>
                    setIdentityType(
                      type
                    )
                  }
                  style={[
                    styles.chip,

                    identityType ===
                      type &&
                      styles.selectedChip,
                  ]}
                >
                  <Text
                    style={
                      identityType ===
                      type
                        ? styles.selectedChipText
                        : styles.chipText
                    }
                  >
                    {type}
                  </Text>
                </Pressable>
              )
            )}
          </View>

          <Label>
            Identity number
          </Label>

          <Input
            value={identityNumber}
            onChangeText={
              setIdentityNumber
            }
            placeholder="Document number"
          />

          <Label>
            Monthly rent (NPR)
          </Label>

          <Input
            value={monthlyRent}
            onChangeText={
              setMonthlyRent
            }
            keyboardType="numeric"
            placeholder="15000"
          />

          <Label>
            Advance deposit (NPR)
          </Label>

          <Input
            value={advanceDeposit}
            onChangeText={
              setAdvanceDeposit
            }
            keyboardType="numeric"
            placeholder="0"
          />

          <Button
            title={
              photo
                ? 'PP photo selected'
                : 'Choose PP-size photo'
            }
            kind="secondary"
            onPress={
              selectTenantPhoto
            }
          />

          <Button
            title={
              identityDocument
                ? 'Identity document selected'
                : 'Upload identity document'
            }
            kind="secondary"
            onPress={
              selectIdentityDocument
            }
          />

          <Button
            disabled={
              saving ||
              vacantRooms.length === 0
            }
            title={
              saving
                ? 'Saving Tenant...'
                : 'Save Tenant'
            }
            onPress={saveTenant}
          />
        </Card>
      )}

      {/* Edit tenant form */}

      {editingTenant && (
        <Card>
          <Text style={styles.formTitle}>
            Edit tenant
          </Text>

          <View style={styles.editRoomInfo}>
            <Text
              style={styles.editRoomText}
            >
              Assigned room:{' '}
              {getRoomNumber(
                editingTenant.room_id
              )}
            </Text>
          </View>

          <Label>Full name</Label>

          <Input
            value={
              editingTenant.full_name
            }
            onChangeText={(value) =>
              setEditingTenant({
                ...editingTenant,
                full_name: value,
              })
            }
          />

          <Label>Phone</Label>

          <Input
            value={
              editingTenant.phone
            }
            onChangeText={(value) =>
              setEditingTenant({
                ...editingTenant,
                phone: value,
              })
            }
            keyboardType="phone-pad"
          />

          <Label>Identity type</Label>

          <View style={styles.chips}>
            {identityTypes.map(
              (type) => (
                <Pressable
                  key={type}
                  onPress={() =>
                    setEditingTenant({
                      ...editingTenant,
                      id_type: type,
                    })
                  }
                  style={[
                    styles.chip,

                    editingTenant.id_type ===
                      type &&
                      styles.selectedChip,
                  ]}
                >
                  <Text
                    style={
                      editingTenant.id_type ===
                      type
                        ? styles.selectedChipText
                        : styles.chipText
                    }
                  >
                    {type}
                  </Text>
                </Pressable>
              )
            )}
          </View>

          <Label>
            Identity number
          </Label>

          <Input
            value={
              editingTenant.id_number
            }
            onChangeText={(value) =>
              setEditingTenant({
                ...editingTenant,
                id_number: value,
              })
            }
          />

          <Label>
            Monthly rent (NPR)
          </Label>

          <Input
            value={String(
              editingTenant.monthly_rent
            )}
            onChangeText={(value) =>
              setEditingTenant({
                ...editingTenant,

                monthly_rent:
                  Number(value) || 0,
              })
            }
            keyboardType="numeric"
          />

          <Label>
            Advance deposit (NPR)
          </Label>

          <Input
            value={String(
              editingTenant.advance_deposit
            )}
            onChangeText={(value) =>
              setEditingTenant({
                ...editingTenant,

                advance_deposit:
                  Number(value) || 0,
              })
            }
            keyboardType="numeric"
          />

          <Label>Notes</Label>

          <Input
            value={
              editingTenant.notes ?? ''
            }
            onChangeText={(value) =>
              setEditingTenant({
                ...editingTenant,
                notes: value,
              })
            }
            placeholder="Optional tenant notes"
            multiline
          />

          <Button
            disabled={saving}
            title={
              saving
                ? 'Saving...'
                : 'Save Changes'
            }
            onPress={
              saveTenantChanges
            }
          />

          <Button
            title="Cancel"
            kind="secondary"
            onPress={() =>
              setEditingTenant(undefined)
            }
          />
        </Card>
      )}

      {/* Tenant list */}

      {tenants.map((tenant) => (
        <Card key={tenant.id}>
          <View style={styles.tenantHeader}>
            {tenant.photo_uri ? (
              <Image
                source={{
                  uri: tenant.photo_uri,
                }}
                style={styles.tenantPhoto}
              />
            ) : (
              <View
                style={
                  styles.photoPlaceholder
                }
              >
                <Text
                  style={
                    styles.photoPlaceholderText
                  }
                >
                  {tenant.full_name
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.tenantInfo}>
              <Text style={styles.tenantName}>
                {tenant.full_name}
              </Text>

              <Text style={styles.meta}>
                Room{' '}
                {getRoomNumber(
                  tenant.room_id
                )}
                {' · '}
                {tenant.phone}
              </Text>

              <Text style={styles.meta}>
                {tenant.id_type}:{' '}
                {tenant.id_number}
              </Text>

              <Text style={styles.deposit}>
                Advance: NPR{' '}
                {Number(
                  tenant.advance_deposit ||
                    0
                ).toLocaleString()}
              </Text>
            </View>

            <View style={styles.rent}>
              <Money
                value={Number(
                  tenant.monthly_rent
                )}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                title="Edit"
                kind="secondary"
                onPress={() =>
                  startEditingTenant(
                    tenant
                  )
                }
              />
            </View>

            <View style={styles.action}>
              <Button
                title="Delete"
                kind="danger"
                onPress={() =>
                  confirmDeleteTenant(
                    tenant
                  )
                }
              />
            </View>
          </View>
        </Card>
      ))}

      {tenants.length === 0 &&
        !showAddForm && (
          <Empty text="No tenants have been added." />
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

  addButton: {
    fontWeight: '900',
    color: colors.primary,
    fontSize: 16,
  },

  formTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 14,
  },

  warning: {
    color: colors.danger,
    marginBottom: 12,
    lineHeight: 19,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },

  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  selectedChip: {
    backgroundColor: colors.primary,
  },

  chipText: {
    fontSize: 12,
    color: colors.text,
  },

  selectedChipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  editRoomInfo: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: 11,
    marginBottom: 14,
  },

  editRoomText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12,
  },

  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },

  tenantPhoto: {
    width: 56,
    height: 68,
    borderRadius: 12,
    backgroundColor: colors.border,
  },

  photoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoPlaceholderText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },

  tenantInfo: {
    flex: 1,
    paddingHorizontal: 11,
  },

  tenantName: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },

  meta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },

  deposit: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '800',
    marginTop: 5,
  },

  rent: {
    alignItems: 'flex-end',
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  action: {
    width: '48%',
  },
});