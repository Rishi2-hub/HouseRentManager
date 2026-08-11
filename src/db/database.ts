import * as SQLite from 'expo-sqlite';

import type {
  Bill,
  Floor,
  Room,
  Tenant,
} from '../types';

import {
  makeId,
  now,
} from '../lib/id';

let db: SQLite.SQLiteDatabase;
let dbScope = '';

async function ensureColumn(
  table: string,
  column: string,
  definition: string
) {
  const columns =
    await db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(${table})`
    );

  const columnExists = columns.some(
    (item) => item.name === column
  );

  if (!columnExists) {
    await db.execAsync(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
    );
  }
}

export async function initDb(
  userId = 'preview'
) {
  const scope = userId.replace(
    /[^a-zA-Z0-9-]/g,
    ''
  );

  if (db && dbScope === scope) {
    return;
  }

  dbScope = scope;

  db = await SQLite.openDatabaseAsync(
    `house-rent-manager-${scope}.db`,
    {
      useNewConnection: true,
    }
  );

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS floors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      photo_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      floor_id TEXT NOT NULL,
      room_number TEXT NOT NULL,
      monthly_rent REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'vacant',
      photo_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',

      FOREIGN KEY (floor_id)
        REFERENCES floors(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      id_type TEXT NOT NULL,
      id_number TEXT NOT NULL,
      move_in_date TEXT NOT NULL,
      monthly_rent REAL NOT NULL,
      advance_deposit REAL NOT NULL DEFAULT 0,
      photo_uri TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',

      FOREIGN KEY (room_id)
        REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      remote_path TEXT,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',

      FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      bill_month TEXT NOT NULL,
      billing_mode TEXT NOT NULL DEFAULT 'full_month',
      billed_days INTEGER NOT NULL DEFAULT 0,
      month_days INTEGER NOT NULL DEFAULT 0,
      rent REAL NOT NULL,

      previous_electricity_unit
        REAL NOT NULL DEFAULT 0,

      current_electricity_unit
        REAL NOT NULL DEFAULT 0,

      electricity_rate
        REAL NOT NULL DEFAULT 0,

      electricity REAL NOT NULL DEFAULT 0,
      water REAL NOT NULL DEFAULT 0,
      waste REAL NOT NULL DEFAULT 0,
      additional REAL NOT NULL DEFAULT 0,
      previous_due REAL NOT NULL DEFAULT 0,
      advance_used REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      balance REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',

      FOREIGN KEY (tenant_id)
        REFERENCES tenants(id),

      UNIQUE (tenant_id, bill_month)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Update databases already installed on the phone.
  await ensureColumn(
    'tenants',
    'advance_deposit',
    'REAL NOT NULL DEFAULT 0'
  );

  await ensureColumn(
    'bills',
    'previous_electricity_unit',
    'REAL NOT NULL DEFAULT 0'
  );

  await ensureColumn(
    'bills',
    'current_electricity_unit',
    'REAL NOT NULL DEFAULT 0'
  );

  await ensureColumn(
    'bills',
    'electricity_rate',
    'REAL NOT NULL DEFAULT 0'
  );

  await ensureColumn(
    'bills',
    'billing_mode',
    "TEXT NOT NULL DEFAULT 'full_month'"
  );

  await ensureColumn(
    'bills',
    'billed_days',
    'INTEGER NOT NULL DEFAULT 0'
  );

  await ensureColumn(
    'bills',
    'month_days',
    'INTEGER NOT NULL DEFAULT 0'
  );
}

/**
 * Reopen the current local database with a fresh native
 * connection. Android can invalidate the old native handle
 * when the camera, gallery or document picker is opened.
 */
export async function refreshDbConnection() {
  if (!dbScope) {
    throw new Error(
      'The local database has not been initialized.'
    );
  }

  const previousDatabase = db;

  const freshDatabase =
    await SQLite.openDatabaseAsync(
      `house-rent-manager-${dbScope}.db`,
      {
        useNewConnection: true,
      }
    );

  await freshDatabase.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  db = freshDatabase;

  if (previousDatabase) {
    try {
      await previousDatabase.closeAsync();
    } catch (error) {
      // The previous Android native handle may already be
      // invalid. The fresh connection above is now active.
      console.warn(
        'Previous SQLite connection was already unavailable:',
        error
      );
    }
  }
}

async function queueOperation(
  entity: string,
  id: string,
  operation: 'upsert' | 'delete',
  payload: unknown
) {
  await db.runAsync(
    `INSERT INTO sync_queue(
      entity,
      entity_id,
      operation,
      payload,
      created_at
    ) VALUES (?, ?, ?, ?, ?)`,
    entity,
    id,
    operation,
    JSON.stringify(payload),
    now()
  );
}

function queue(
  entity: string,
  id: string,
  payload: unknown
) {
  return queueOperation(
    entity,
    id,
    'upsert',
    payload
  );
}

function queueDelete(
  entity: string,
  id: string
) {
  return queueOperation(
    entity,
    id,
    'delete',
    { id }
  );
}

// =====================================================
// LIST RECORDS
// =====================================================

export function listFloors() {
  return db.getAllAsync<Floor>(
    'SELECT * FROM floors ORDER BY name'
  );
}

export function listRooms() {
  return db.getAllAsync<Room>(
    'SELECT * FROM rooms ORDER BY room_number'
  );
}

export function listTenants() {
  return db.getAllAsync<Tenant>(
    'SELECT * FROM tenants ORDER BY full_name'
  );
}

export function listBills() {
  return db.getAllAsync<Bill>(
    `SELECT *
     FROM bills
     ORDER BY bill_month DESC, created_at DESC`
  );
}

// =====================================================
// FLOOR FUNCTIONS
// =====================================================

export async function addFloor(
  name: string,
  address: string,
  photo_uri?: string
) {
  const floor = {
    id: makeId(),
    name,
    address,
    photo_uri: photo_uri ?? null,
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending',
  };

  await db.runAsync(
    `INSERT INTO floors(
      id,
      name,
      address,
      photo_uri,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    floor.id,
    floor.name,
    floor.address,
    floor.photo_uri,
    floor.created_at,
    floor.updated_at,
    floor.sync_status
  );

  await queue(
    'floors',
    floor.id,
    floor
  );

  return floor;
}

export async function updateFloor(
  id: string,
  values: {
    name: string;
    address: string;
    photo_uri?: string | null;
  }
) {
  const updatedAt = now();

  await db.runAsync(
    `UPDATE floors
     SET
       name = ?,
       address = ?,
       photo_uri = ?,
       updated_at = ?,
       sync_status = 'pending'
     WHERE id = ?`,
    values.name,
    values.address,
    values.photo_uri ?? null,
    updatedAt,
    id
  );

  const floor =
    await db.getFirstAsync<Floor>(
      'SELECT * FROM floors WHERE id = ?',
      id
    );

  if (!floor) {
    throw new Error('Floor not found.');
  }

  await queue(
    'floors',
    id,
    floor
  );

  return floor;
}

export async function deleteFloor(
  id: string
) {
  const existingRoom =
    await db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM rooms
       WHERE floor_id = ?
       LIMIT 1`,
      id
    );

  if (existingRoom) {
    throw new Error(
      'Delete all rooms on this floor first.'
    );
  }

  await queueDelete(
    'floors',
    id
  );

  await db.runAsync(
    'DELETE FROM floors WHERE id = ?',
    id
  );
}

// =====================================================
// ROOM FUNCTIONS
// =====================================================

export async function addRoom(values: {
  floor_id: string;
  room_number: string;
  monthly_rent: number;
  photo_uri?: string;
}) {
  const room = {
    id: makeId(),
    floor_id: values.floor_id,
    room_number: values.room_number,
    monthly_rent: values.monthly_rent,
    status: 'vacant' as const,
    photo_uri: values.photo_uri ?? null,
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending',
  };

  await db.runAsync(
    `INSERT INTO rooms(
      id,
      floor_id,
      room_number,
      monthly_rent,
      status,
      photo_uri,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    room.id,
    room.floor_id,
    room.room_number,
    room.monthly_rent,
    room.status,
    room.photo_uri,
    room.created_at,
    room.updated_at,
    room.sync_status
  );

  await queue(
    'rooms',
    room.id,
    room
  );

  return room;
}

export async function updateRoom(
  id: string,
  values: {
    room_number: string;
    monthly_rent: number;
  }
) {
  const updatedAt = now();

  await db.runAsync(
    `UPDATE rooms
     SET
       room_number = ?,
       monthly_rent = ?,
       updated_at = ?,
       sync_status = 'pending'
     WHERE id = ?`,
    values.room_number,
    values.monthly_rent,
    updatedAt,
    id
  );

  const room =
    await db.getFirstAsync<Room>(
      'SELECT * FROM rooms WHERE id = ?',
      id
    );

  if (!room) {
    throw new Error('Room not found.');
  }

  await queue(
    'rooms',
    id,
    room
  );

  return room;
}

export async function deleteRoom(
  id: string
) {
  const existingTenant =
    await db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM tenants
       WHERE room_id = ?
       LIMIT 1`,
      id
    );

  if (existingTenant) {
    throw new Error(
      'This room has a tenant. Delete the tenant first.'
    );
  }

  await queueDelete(
    'rooms',
    id
  );

  await db.runAsync(
    'DELETE FROM rooms WHERE id = ?',
    id
  );
}

// =====================================================
// TENANT FUNCTIONS
// =====================================================

export async function addTenant(values: {
  room_id: string;
  full_name: string;
  phone: string;
  email?: string;
  id_type: string;
  id_number: string;
  move_in_date: string;
  monthly_rent: number;
  advance_deposit: number;
  photo_uri?: string;
  notes?: string;
}) {
  await refreshDbConnection();

  const tenant = {
    id: makeId(),
    room_id: values.room_id,
    full_name: values.full_name,
    phone: values.phone,
    email: values.email ?? null,
    id_type: values.id_type,
    id_number: values.id_number,
    move_in_date: values.move_in_date,
    monthly_rent: values.monthly_rent,
    advance_deposit:
      values.advance_deposit,
    photo_uri: values.photo_uri ?? null,
    notes: values.notes ?? null,
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending',
  };

  await db.runAsync(
    `INSERT INTO tenants(
      id,
      room_id,
      full_name,
      phone,
      email,
      id_type,
      id_number,
      move_in_date,
      monthly_rent,
      advance_deposit,
      photo_uri,
      notes,
      created_at,
      updated_at,
      sync_status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`,
    tenant.id,
    tenant.room_id,
    tenant.full_name,
    tenant.phone,
    tenant.email,
    tenant.id_type,
    tenant.id_number,
    tenant.move_in_date,
    tenant.monthly_rent,
    tenant.advance_deposit,
    tenant.photo_uri,
    tenant.notes,
    tenant.created_at,
    tenant.updated_at,
    tenant.sync_status
  );

  await db.runAsync(
    `UPDATE rooms
     SET
       status = 'occupied',
       updated_at = ?,
       sync_status = 'pending'
     WHERE id = ?`,
    now(),
    tenant.room_id
  );

  const occupiedRoom =
    await db.getFirstAsync<Room>(
      'SELECT * FROM rooms WHERE id = ?',
      tenant.room_id
    );

  await queue(
    'tenants',
    tenant.id,
    tenant
  );

  if (occupiedRoom) {
    await queue(
      'rooms',
      occupiedRoom.id,
      occupiedRoom
    );
  }

  return tenant;
}

export async function updateTenant(
  id: string,
  values: {
    full_name: string;
    phone: string;
    id_type: string;
    id_number: string;
    monthly_rent: number;
    advance_deposit: number;
    notes?: string | null;
  }
) {
  const updatedAt = now();

  await db.runAsync(
    `UPDATE tenants
     SET
       full_name = ?,
       phone = ?,
       id_type = ?,
       id_number = ?,
       monthly_rent = ?,
       advance_deposit = ?,
       notes = ?,
       updated_at = ?,
       sync_status = 'pending'
     WHERE id = ?`,
    values.full_name,
    values.phone,
    values.id_type,
    values.id_number,
    values.monthly_rent,
    values.advance_deposit,
    values.notes ?? null,
    updatedAt,
    id
  );

  const tenant =
    await db.getFirstAsync<Tenant>(
      'SELECT * FROM tenants WHERE id = ?',
      id
    );

  if (!tenant) {
    throw new Error('Tenant not found.');
  }

  await queue(
    'tenants',
    id,
    tenant
  );

  return tenant;
}

export async function deleteTenant(
  id: string
) {
  const tenant =
    await db.getFirstAsync<Tenant>(
      'SELECT * FROM tenants WHERE id = ?',
      id
    );

  if (!tenant) {
    throw new Error('Tenant not found.');
  }

  const documents =
    await db.getAllAsync<{ id: string }>(
      `SELECT id
       FROM documents
       WHERE tenant_id = ?`,
      id
    );

  const tenantBills =
    await db.getAllAsync<{ id: string }>(
      `SELECT id
       FROM bills
       WHERE tenant_id = ?`,
      id
    );

  for (const document of documents) {
    await queueDelete(
      'documents',
      document.id
    );
  }

  for (const bill of tenantBills) {
    await queueDelete(
      'bills',
      bill.id
    );
  }

  await queueDelete(
    'tenants',
    id
  );

  await db.runAsync(
    'DELETE FROM bills WHERE tenant_id = ?',
    id
  );

  await db.runAsync(
    'DELETE FROM documents WHERE tenant_id = ?',
    id
  );

  await db.runAsync(
    'DELETE FROM tenants WHERE id = ?',
    id
  );

  await db.runAsync(
    `UPDATE rooms
     SET
       status = 'vacant',
       updated_at = ?,
       sync_status = 'pending'
     WHERE id = ?`,
    now(),
    tenant.room_id
  );

  const vacantRoom =
    await db.getFirstAsync<Room>(
      'SELECT * FROM rooms WHERE id = ?',
      tenant.room_id
    );

  if (vacantRoom) {
    await queue(
      'rooms',
      vacantRoom.id,
      vacantRoom
    );
  }
}

// =====================================================
// DOCUMENT FUNCTIONS
// =====================================================

export async function addDocument(values: {
  tenant_id: string;
  document_type: string;
  local_uri: string;
  file_name: string;
  mime_type?: string;
}) {
  await refreshDbConnection();

  const document = {
    id: makeId(),
    tenant_id: values.tenant_id,
    document_type:
      values.document_type,
    local_uri: values.local_uri,
    remote_path: null,
    file_name: values.file_name,
    mime_type:
      values.mime_type ?? null,
    created_at: now(),
    sync_status: 'pending',
  };

  await db.runAsync(
    `INSERT INTO documents(
      id,
      tenant_id,
      document_type,
      local_uri,
      remote_path,
      file_name,
      mime_type,
      created_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    document.id,
    document.tenant_id,
    document.document_type,
    document.local_uri,
    document.remote_path,
    document.file_name,
    document.mime_type,
    document.created_at,
    document.sync_status
  );

  await queue(
    'documents',
    document.id,
    document
  );

  return document;
}

// =====================================================
// BILL FUNCTIONS
// =====================================================

type BillInput = Omit<
  Bill,
  | 'id'
  | 'electricity'
  | 'total'
  | 'balance'
  | 'status'
  | 'created_at'
  | 'updated_at'
  | 'sync_status'
>;

function calculateBill(values: BillInput) {
  const usedUnits = Math.max(
    0,
    values.current_electricity_unit -
      values.previous_electricity_unit
  );

  const electricity =
    usedUnits *
    values.electricity_rate;

  const total = Math.max(
    0,
    values.rent +
      electricity +
      values.water +
      values.waste +
      values.additional +
      values.previous_due -
      values.advance_used
  );

  const balance = Math.max(
    0,
    total - values.paid_amount
  );

  const status: Bill['status'] =
    balance === 0
      ? 'paid'
      : values.paid_amount > 0
        ? 'partial'
        : 'due';

  return {
    electricity,
    total,
    balance,
    status,
  };
}

export async function addBill(
  values: BillInput
) {
  const calculated =
    calculateBill(values);

  const bill = {
    id: makeId(),
    ...values,
    ...calculated,
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending',
  };

  await db.runAsync(
    `INSERT INTO bills(
      id,
      tenant_id,
      bill_month,
      billing_mode,
      billed_days,
      month_days,
      rent,
      previous_electricity_unit,
      current_electricity_unit,
      electricity_rate,
      electricity,
      water,
      waste,
      additional,
      previous_due,
      advance_used,
      paid_amount,
      total,
      balance,
      status,
      created_at,
      updated_at,
      sync_status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )`,
    bill.id,
    bill.tenant_id,
    bill.bill_month,
    bill.billing_mode,
    bill.billed_days,
    bill.month_days,
    bill.rent,
    bill.previous_electricity_unit,
    bill.current_electricity_unit,
    bill.electricity_rate,
    bill.electricity,
    bill.water,
    bill.waste,
    bill.additional,
    bill.previous_due,
    bill.advance_used,
    bill.paid_amount,
    bill.total,
    bill.balance,
    bill.status,
    bill.created_at,
    bill.updated_at,
    bill.sync_status
  );

  await queue(
    'bills',
    bill.id,
    bill
  );

  return bill;
}

export async function updateBill(
  id: string,
  values: BillInput
) {
  const calculated =
    calculateBill(values);

  const updatedAt = now();

  await db.runAsync(
    `UPDATE bills
     SET
       tenant_id = ?,
       bill_month = ?,
       billing_mode = ?,
       billed_days = ?,
       month_days = ?,
       rent = ?,
       previous_electricity_unit = ?,
       current_electricity_unit = ?,
       electricity_rate = ?,
       electricity = ?,
       water = ?,
       waste = ?,
       additional = ?,
       previous_due = ?,
       advance_used = ?,
       paid_amount = ?,
       total = ?,
       balance = ?,
       status = ?,
       updated_at = ?,
       sync_status = 'pending'
     WHERE id = ?`,
    values.tenant_id,
    values.bill_month,
    values.billing_mode,
    values.billed_days,
    values.month_days,
    values.rent,
    values.previous_electricity_unit,
    values.current_electricity_unit,
    values.electricity_rate,
    calculated.electricity,
    values.water,
    values.waste,
    values.additional,
    values.previous_due,
    values.advance_used,
    values.paid_amount,
    calculated.total,
    calculated.balance,
    calculated.status,
    updatedAt,
    id
  );

  const bill =
    await db.getFirstAsync<Bill>(
      'SELECT * FROM bills WHERE id = ?',
      id
    );

  if (!bill) {
    throw new Error('Bill not found.');
  }

  await queue(
    'bills',
    id,
    bill
  );

  return bill;
}

export async function deleteBill(
  id: string
) {
  await queueDelete(
    'bills',
    id
  );

  await db.runAsync(
    'DELETE FROM bills WHERE id = ?',
    id
  );
}

// =====================================================
// SYNCHRONIZATION FUNCTIONS
// =====================================================

export function getQueue() {
  return db.getAllAsync<any>(
    `SELECT *
     FROM sync_queue
     ORDER BY id
     LIMIT 100`
  );
}

export async function markSynced(
  entity: string,
  entityId: string,
  queueId: number
) {
  const allowedTables = [
    'floors',
    'rooms',
    'tenants',
    'documents',
    'bills',
  ];

  if (allowedTables.includes(entity)) {
    await db.runAsync(
      `UPDATE ${entity}
       SET sync_status = 'synced'
       WHERE id = ?`,
      entityId
    );
  }

  await db.runAsync(
    'DELETE FROM sync_queue WHERE id = ?',
    queueId
  );
}

export async function replaceFromCloud(data: {
  floors: any[];
  rooms: any[];
  tenants: any[];
  documents: any[];
  bills: any[];
}) {
  await db.withTransactionAsync(
    async () => {
      await db.execAsync(`
        DELETE FROM bills;
        DELETE FROM documents;
        DELETE FROM tenants;
        DELETE FROM rooms;
        DELETE FROM floors;
      `);

      for (const item of data.floors) {
        await db.runAsync(
          `INSERT INTO floors
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          item.id,
          item.name,
          item.address,
          item.photo_uri,
          item.created_at,
          item.updated_at,
          'synced'
        );
      }

      for (const item of data.rooms) {
        await db.runAsync(
          `INSERT INTO rooms
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.id,
          item.floor_id,
          item.room_number,
          item.monthly_rent,
          item.status,
          item.photo_uri,
          item.created_at,
          item.updated_at,
          'synced'
        );
      }

      for (const item of data.tenants) {
        await db.runAsync(
          `INSERT INTO tenants(
            id,
            room_id,
            full_name,
            phone,
            email,
            id_type,
            id_number,
            move_in_date,
            monthly_rent,
            advance_deposit,
            photo_uri,
            notes,
            created_at,
            updated_at,
            sync_status
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )`,
          item.id,
          item.room_id,
          item.full_name,
          item.phone,
          item.email,
          item.id_type,
          item.id_number,
          item.move_in_date,
          item.monthly_rent,
          item.advance_deposit ?? 0,
          item.photo_uri,
          item.notes,
          item.created_at,
          item.updated_at,
          'synced'
        );
      }

      for (const item of data.documents) {
        await db.runAsync(
          `INSERT INTO documents
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.id,
          item.tenant_id,
          item.document_type,
          '',
          item.remote_path,
          item.file_name,
          item.mime_type,
          item.created_at,
          'synced'
        );
      }

      for (const item of data.bills) {
        await db.runAsync(
          `INSERT INTO bills(
            id,
            tenant_id,
            bill_month,
            billing_mode,
            billed_days,
            month_days,
            rent,
            previous_electricity_unit,
            current_electricity_unit,
            electricity_rate,
            electricity,
            water,
            waste,
            additional,
            previous_due,
            advance_used,
            paid_amount,
            total,
            balance,
            status,
            created_at,
            updated_at,
            sync_status
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?
          )`,
          item.id,
          item.tenant_id,
          item.bill_month,
          item.billing_mode ?? 'full_month',
          item.billed_days ?? 0,
          item.month_days ?? 0,
          item.rent,
          item.previous_electricity_unit ?? 0,
          item.current_electricity_unit ?? 0,
          item.electricity_rate ?? 0,
          item.electricity,
          item.water,
          item.waste,
          item.additional,
          item.previous_due,
          item.advance_used,
          item.paid_amount,
          item.total,
          item.balance,
          item.status,
          item.created_at,
          item.updated_at,
          'synced'
        );
      }
    }
  );
}