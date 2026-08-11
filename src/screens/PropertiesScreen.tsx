import React, {
  useState,
} from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import {
  addFloor,
  addRoom,
  deleteFloor,
  deleteRoom,
  updateFloor,
  updateRoom,
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
  Floor,
  Room,
} from '../types';

import {
  colors,
} from '../theme';

type PropertiesScreenProps = {
  floors: Floor[];
  rooms: Room[];
  reload: () => void | Promise<void>;
};

export function PropertiesScreen({
  floors,
  rooms,
  reload,
}: PropertiesScreenProps) {
  const [floorName, setFloorName] =
    useState('');

  const [floorAddress, setFloorAddress] =
    useState('');

  const [floorPhoto, setFloorPhoto] =
    useState<string>();

  const [
    selectedFloorId,
    setSelectedFloorId,
  ] = useState('');

  const [roomNumber, setRoomNumber] =
    useState('');

  const [roomRent, setRoomRent] =
    useState('');

  const [editingFloor, setEditingFloor] =
    useState<Floor>();

  const [editingRoom, setEditingRoom] =
    useState<Room>();

  const [busy, setBusy] =
    useState(false);

  async function selectFloorPhoto() {
    try {
      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: ['images'],
            quality: 0.75,
          }
        );

      if (!result.canceled) {
        setFloorPhoto(
          result.assets[0].uri
        );
      }
    } catch (error) {
      Alert.alert(
        'Photo error',
        'Could not select the floor photo.'
      );
    }
  }

  async function saveFloor() {
    if (!floorName.trim()) {
      return Alert.alert(
        'Floor name required',
        'Enter the floor name.'
      );
    }

    if (busy) return;

    setBusy(true);

    try {
      await addFloor(
        floorName.trim(),
        floorAddress.trim(),
        floorPhoto
      );

      setFloorName('');
      setFloorAddress('');
      setFloorPhoto(undefined);

      await reload();

      Alert.alert(
        'Floor saved',
        'The new floor was added successfully.'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown database error';

      Alert.alert(
        'Could not save floor',
        message
      );
    } finally {
      setBusy(false);
    }
  }

  function openRoomForm(
    floorId: string
  ) {
    setSelectedFloorId(floorId);
    setRoomNumber('');
    setRoomRent('');
    setEditingRoom(undefined);
  }

  async function saveRoom() {
    const monthlyRent =
      Number(roomRent);

    if (!selectedFloorId) {
      return Alert.alert(
        'Select floor',
        'Select the floor for this room.'
      );
    }

    if (!roomNumber.trim()) {
      return Alert.alert(
        'Room number required',
        'Enter the room number or room name.'
      );
    }

    if (
      !Number.isFinite(monthlyRent) ||
      monthlyRent <= 0
    ) {
      return Alert.alert(
        'Invalid rent',
        'Enter a valid monthly rent.'
      );
    }

    if (busy) return;

    setBusy(true);

    try {
      await addRoom({
        floor_id:
          selectedFloorId,

        room_number:
          roomNumber.trim(),

        monthly_rent:
          monthlyRent,
      });

      setSelectedFloorId('');
      setRoomNumber('');
      setRoomRent('');

      await reload();

      Alert.alert(
        'Room saved',
        'The new room was added successfully.'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown database error';

      Alert.alert(
        'Could not save room',
        message
      );
    } finally {
      setBusy(false);
    }
  }

  function startEditingFloor(
    floor: Floor
  ) {
    setEditingFloor({
      ...floor,
    });

    setEditingRoom(undefined);
    setSelectedFloorId('');
  }

  async function saveFloorChanges() {
    if (!editingFloor) return;

    if (
      !editingFloor.name.trim()
    ) {
      return Alert.alert(
        'Floor name required',
        'Enter the floor name.'
      );
    }

    if (busy) return;

    setBusy(true);

    try {
      await updateFloor(
        editingFloor.id,
        {
          name:
            editingFloor.name.trim(),

          address:
            editingFloor.address.trim(),

          photo_uri:
            editingFloor.photo_uri,
        }
      );

      setEditingFloor(undefined);

      await reload();

      Alert.alert(
        'Floor updated',
        'The floor details were updated successfully.'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown database error';

      Alert.alert(
        'Could not update floor',
        message
      );
    } finally {
      setBusy(false);
    }
  }

  function startEditingRoom(
    room: Room
  ) {
    setEditingRoom({
      ...room,
    });

    setEditingFloor(undefined);
    setSelectedFloorId('');
  }

  async function saveRoomChanges() {
    if (!editingRoom) return;

    const monthlyRent =
      Number(
        editingRoom.monthly_rent
      );

    if (
      !editingRoom.room_number.trim()
    ) {
      return Alert.alert(
        'Room number required',
        'Enter the room number or room name.'
      );
    }

    if (
      !Number.isFinite(monthlyRent) ||
      monthlyRent <= 0
    ) {
      return Alert.alert(
        'Invalid rent',
        'Enter a valid monthly rent.'
      );
    }

    if (busy) return;

    setBusy(true);

    try {
      await updateRoom(
        editingRoom.id,
        {
          room_number:
            editingRoom.room_number.trim(),

          monthly_rent:
            monthlyRent,
        }
      );

      setEditingRoom(undefined);

      await reload();

      Alert.alert(
        'Room updated',
        'The room details were updated successfully.'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown database error';

      Alert.alert(
        'Could not update room',
        message
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteFloor(
    floor: Floor
  ) {
    Alert.alert(
      'Delete floor?',
      `Do you want to delete ${floor.name}? A floor containing rooms cannot be deleted.`,
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
              await deleteFloor(
                floor.id
              );

              if (
                editingFloor?.id ===
                floor.id
              ) {
                setEditingFloor(
                  undefined
                );
              }

              await reload();

              Alert.alert(
                'Floor deleted',
                `${floor.name} was deleted.`
              );
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : 'Unknown database error';

              Alert.alert(
                'Cannot delete floor',
                message
              );
            }
          },
        },
      ]
    );
  }

  function confirmDeleteRoom(
    room: Room
  ) {
    Alert.alert(
      'Delete room?',
      `Do you want to delete room ${room.room_number}?`,
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
              await deleteRoom(
                room.id
              );

              if (
                editingRoom?.id ===
                room.id
              ) {
                setEditingRoom(
                  undefined
                );
              }

              await reload();

              Alert.alert(
                'Room deleted',
                `Room ${room.room_number} was deleted.`
              );
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : 'Unknown database error';

              Alert.alert(
                'Cannot delete room',
                message
              );
            }
          },
        },
      ]
    );
  }

  return (
    <View>
      <Text style={styles.heading}>
        Floors & Rooms
      </Text>

      <Text style={styles.subtitle}>
        Manage your properties,
        floors and rental rooms.
      </Text>

      {/* Add floor */}

      <Card>
        <Text style={styles.title}>
          Add new floor
        </Text>

        <Label>Floor name</Label>

        <Input
          value={floorName}
          onChangeText={
            setFloorName
          }
          placeholder="Ground Floor"
        />

        <Label>Address</Label>

        <Input
          value={floorAddress}
          onChangeText={
            setFloorAddress
          }
          placeholder="Property address"
        />

        <Button
          title={
            floorPhoto
              ? 'Floor photo selected'
              : 'Choose floor photo'
          }
          kind="secondary"
          onPress={
            selectFloorPhoto
          }
        />

        <Button
          disabled={busy}
          title={
            busy
              ? 'Saving...'
              : 'Save Floor'
          }
          onPress={saveFloor}
        />
      </Card>

      {/* Edit floor */}

      {editingFloor && (
        <Card>
          <Text style={styles.editTitle}>
            Edit floor
          </Text>

          <Label>Floor name</Label>

          <Input
            value={
              editingFloor.name
            }
            onChangeText={(value) =>
              setEditingFloor({
                ...editingFloor,
                name: value,
              })
            }
          />

          <Label>Address</Label>

          <Input
            value={
              editingFloor.address
            }
            onChangeText={(value) =>
              setEditingFloor({
                ...editingFloor,
                address: value,
              })
            }
          />

          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                title={
                  busy
                    ? 'Saving...'
                    : 'Save changes'
                }
                disabled={busy}
                onPress={
                  saveFloorChanges
                }
              />
            </View>

            <View style={styles.action}>
              <Button
                title="Cancel"
                kind="secondary"
                onPress={() =>
                  setEditingFloor(
                    undefined
                  )
                }
              />
            </View>
          </View>
        </Card>
      )}

      {/* Floors and rooms */}

      {floors.map((floor) => {
        const floorRooms =
          rooms.filter(
            (room) =>
              room.floor_id ===
              floor.id
          );

        return (
          <Card key={floor.id}>
            <View
              style={
                styles.floorHeader
              }
            >
              <View style={styles.flex}>
                <Text
                  style={styles.floorName}
                >
                  {floor.name}
                </Text>

                <Text
                  style={
                    styles.floorAddress
                  }
                >
                  {floor.address ||
                    'No address'}
                </Text>
              </View>

              <Text
                style={styles.roomCount}
              >
                {floorRooms.length}{' '}
                room
                {floorRooms.length === 1
                  ? ''
                  : 's'}
              </Text>
            </View>

            <View style={styles.actions}>
              <View style={styles.action}>
                <Button
                  title="Edit floor"
                  kind="secondary"
                  onPress={() =>
                    startEditingFloor(
                      floor
                    )
                  }
                />
              </View>

              <View style={styles.action}>
                <Button
                  title="Delete floor"
                  kind="danger"
                  onPress={() =>
                    confirmDeleteFloor(
                      floor
                    )
                  }
                />
              </View>
            </View>

            {/* Rooms on this floor */}

            {floorRooms.map((room) => (
              <View
                key={room.id}
                style={styles.roomCard}
              >
                <View
                  style={styles.roomTop}
                >
                  <View>
                    <Text
                      style={
                        styles.roomNumber
                      }
                    >
                      Room{' '}
                      {room.room_number}
                    </Text>

                    <Text
                      style={[
                        styles.roomStatus,
                        {
                          color:
                            room.status ===
                            'occupied'
                              ? colors.success
                              : colors.warning,
                        },
                      ]}
                    >
                      {room.status.toUpperCase()}
                    </Text>
                  </View>

                  <Money
                    value={Number(
                      room.monthly_rent
                    )}
                  />
                </View>

                <View
                  style={styles.actions}
                >
                  <View
                    style={styles.action}
                  >
                    <Button
                      title="Edit room"
                      kind="secondary"
                      onPress={() =>
                        startEditingRoom(
                          room
                        )
                      }
                    />
                  </View>

                  <View
                    style={styles.action}
                  >
                    <Button
                      title="Delete room"
                      kind="danger"
                      onPress={() =>
                        confirmDeleteRoom(
                          room
                        )
                      }
                    />
                  </View>
                </View>
              </View>
            ))}

            {floorRooms.length === 0 && (
              <Text style={styles.noRooms}>
                No rooms added to this
                floor.
              </Text>
            )}

            <Button
              title="+ Add room here"
              kind="secondary"
              onPress={() =>
                openRoomForm(
                  floor.id
                )
              }
            />
          </Card>
        );
      })}

      {floors.length === 0 && (
        <Empty text="Add your first floor to begin." />
      )}

      {/* Add room form */}

      {selectedFloorId && (
        <Card>
          <Text style={styles.editTitle}>
            Add room to{' '}
            {
              floors.find(
                (floor) =>
                  floor.id ===
                  selectedFloorId
              )?.name
            }
          </Text>

          <Label>
            Room number or name
          </Label>

          <Input
            value={roomNumber}
            onChangeText={
              setRoomNumber
            }
            placeholder="101"
          />

          <Label>
            Monthly rent (NPR)
          </Label>

          <Input
            value={roomRent}
            onChangeText={
              setRoomRent
            }
            keyboardType="numeric"
            placeholder="15000"
          />

          <Button
            title={
              busy
                ? 'Saving...'
                : 'Save Room'
            }
            disabled={busy}
            onPress={saveRoom}
          />

          <Button
            title="Cancel"
            kind="secondary"
            onPress={() =>
              setSelectedFloorId('')
            }
          />
        </Card>
      )}

      {/* Edit room form */}

      {editingRoom && (
        <Card>
          <Text style={styles.editTitle}>
            Edit room
          </Text>

          <Label>
            Room number or name
          </Label>

          <Input
            value={
              editingRoom.room_number
            }
            onChangeText={(value) =>
              setEditingRoom({
                ...editingRoom,
                room_number: value,
              })
            }
          />

          <Label>
            Monthly rent (NPR)
          </Label>

          <Input
            value={String(
              editingRoom.monthly_rent
            )}
            onChangeText={(value) =>
              setEditingRoom({
                ...editingRoom,

                monthly_rent:
                  Number(value) || 0,
              })
            }
            keyboardType="numeric"
          />

          <Button
            title={
              busy
                ? 'Saving...'
                : 'Save room changes'
            }
            disabled={busy}
            onPress={
              saveRoomChanges
            }
          />

          <Button
            title="Cancel"
            kind="secondary"
            onPress={() =>
              setEditingRoom(undefined)
            }
          />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },

  title: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 14,
  },

  editTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 14,
  },

  floorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  flex: {
    flex: 1,
    paddingRight: 10,
  },

  floorName: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.primaryDark,
  },

  floorAddress: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },

  roomCount: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '800',
    backgroundColor: colors.accent,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },

  roomCard: {
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },

  roomTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  roomNumber: {
    fontWeight: '900',
    fontSize: 15,
    color: colors.text,
  },

  roomStatus: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
  },

  noRooms: {
    textAlign: 'center',
    color: colors.muted,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  action: {
    width: '48%',
  },
});