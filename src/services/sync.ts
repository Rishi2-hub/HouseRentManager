import * as Network from 'expo-network';

import {
  getQueue,
  markSynced,
  replaceFromCloud,
} from '../db/database';

import {
  cloudConfigured,
  supabase,
} from '../lib/supabase';

function safeFileName(
  value: string
): string {
  return value.replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );
}


function inferMimeType(
  fileName?: string,
  uri?: string,
  providedType?: string | null,
  fallbackType?: string
): string {
  const normalizedType =
    providedType
      ?.split(';')[0]
      .trim()
      .toLowerCase();

  if (
    normalizedType &&
    normalizedType !==
      'application/octet-stream'
  ) {
    return normalizedType;
  }

  const source =
    `${fileName ?? ''} ${uri ?? ''}`
      .split('?')[0]
      .toLowerCase();

  if (
    source.includes('.jpg') ||
    source.includes('.jpeg')
  ) {
    return 'image/jpeg';
  }

  if (source.includes('.png')) {
    return 'image/png';
  }

  if (source.includes('.pdf')) {
    return 'application/pdf';
  }

  if (fallbackType) {
    return fallbackType;
  }

  throw new Error(
    'Unsupported file type. Please use JPG, PNG, or PDF.'
  );
}

function isNetworkFailure(
  error: unknown
): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes('unknownhost') ||
    message.includes(
      'unable to resolve host'
    ) ||
    message.includes('network request failed') ||
    message.includes('fetch failed')
  );
}

function isLocalFile(
  uri: unknown
): boolean {
  if (typeof uri !== 'string') {
    return false;
  }

  return (
    uri.startsWith('file:') ||
    uri.startsWith('content:') ||
    uri.startsWith('ph:')
  );
}

function isHttpUri(
  uri: unknown
): uri is string {
  return (
    typeof uri === 'string' &&
    /^https?:\/\//i.test(uri)
  );
}

/**
 * Cloud photo_uri values are private Supabase Storage object paths,
 * not directly renderable URLs. Convert them to short-lived signed
 * HTTPS URLs whenever cloud records are pulled. Local/device URLs and
 * already-signed HTTP(S) URLs are left unchanged.
 */
async function resolvePrivatePhotoUri(
  uri: unknown
): Promise<string | null> {
  if (
    typeof uri !== 'string' ||
    !uri.trim()
  ) {
    return null;
  }

  if (isLocalFile(uri) || isHttpUri(uri)) {
    return uri;
  }

  if (!supabase) {
    return uri;
  }

  const { data, error } =
    await supabase.storage
      .from('tenant-private')
      .createSignedUrl(
        uri,
        60 * 60 * 24 * 7
      );

  if (error || !data?.signedUrl) {
    console.warn(
      'Could not create signed photo URL for',
      uri,
      error
    );
    return uri;
  }

  return data.signedUrl;
}

async function uploadPrivateFile(
  householdId: string,
  entity: string,
  id: string,
  uri: string,
  fileName?: string,
  mimeType?: string
): Promise<string> {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured.'
    );
  }

  const originalName =
    fileName ||
    uri.split('/').pop() ||
    'upload.jpg';

  const name =
    safeFileName(originalName);

  const storagePath =
    `${householdId}/${entity}/${id}/${name}`;

  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(
      'Could not read the selected file.'
    );
  }

  const fileBody =
    await response.arrayBuffer();

  const contentType =
    inferMimeType(
      fileName,
      uri,
      mimeType ||
        response.headers.get(
          'content-type'
        ),
      entity === 'documents'
        ? undefined
        : 'image/jpeg'
    );

  const { error } =
    await supabase.storage
      .from('tenant-private')
      .upload(
        storagePath,
        fileBody,
        {
          contentType,
          upsert: true,
        }
      );

  if (error) {
    throw error;
  }

  return storagePath;
}

async function loadCloudRecords() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured.'
    );
  }

  const tables = [
    'floors',
    'rooms',
    'tenants',
    'documents',
    'bills',
  ] as const;

  const cloudData: {
    floors: any[];
    rooms: any[];
    tenants: any[];
    documents: any[];
    bills: any[];
  } = {
    floors: [],
    rooms: [],
    tenants: [],
    documents: [],
    bills: [],
  };

  for (const table of tables) {
    const {
      data,
      error,
    } = await supabase
      .from(table)
      .select('*');

    if (error) {
      throw error;
    }

    const rows = data ?? [];

    if (
      table === 'floors' ||
      table === 'rooms' ||
      table === 'tenants'
    ) {
      cloudData[table] =
        await Promise.all(
          rows.map(async (item: any) => ({
            ...item,
            photo_uri:
              await resolvePrivatePhotoUri(
                item.photo_uri
              ),
          }))
        );
    } else {
      cloudData[table] = rows;
    }
  }

  return cloudData;
}

async function runSyncPending() {
  if (
    !cloudConfigured ||
    !supabase
  ) {
    return {
      synced: 0,
      message:
        'Cloud setup required',
    };
  }

  const networkState =
    await Network.getNetworkStateAsync();

  if (!networkState.isConnected) {
    return {
      synced: 0,
      message:
        'Offline. Changes are saved on this device.',
    };
  }

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (
    userError ||
    !userData.user
  ) {
    return {
      synced: 0,
      message:
        'Login required',
    };
  }

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from('household_members')
    .select('household_id')
    .eq(
      'user_id',
      userData.user.id
    )
    .single();

  if (
    membershipError ||
    !membership
  ) {
    return {
      synced: 0,
      message:
        'Household setup required',
    };
  }

  const queueItems =
    await getQueue();

  // Upserts must create parents before children.
  // Deletes use the reverse dependency order.
  const upsertPriority: Record<
    string,
    number
  > = {
    floors: 1,
    rooms: 2,
    tenants: 3,
    documents: 4,
    bills: 5,
  };

  const deletePriority: Record<
    string,
    number
  > = {
    bills: 1,
    documents: 1,
    tenants: 2,
    rooms: 3,
    floors: 4,
  };

  const orderedQueueItems = [
    ...queueItems,
  ].sort((a, b) => {
    const priorityA =
      a.operation === 'delete'
        ? deletePriority[a.entity] ?? 99
        : upsertPriority[a.entity] ?? 99;

    const priorityB =
      b.operation === 'delete'
        ? deletePriority[b.entity] ?? 99
        : upsertPriority[b.entity] ?? 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return Number(a.id) - Number(b.id);
  });

  let syncedCount = 0;
  let stoppedForNetwork = false;

  for (const item of orderedQueueItems) {
    try {
      // ==========================================
      // DELETE FROM SUPABASE
      // ==========================================

      if (
        item.operation === 'delete'
      ) {
        const { error } =
          await supabase
            .from(item.entity)
            .delete()
            .eq(
              'id',
              item.entity_id
            );

        if (error) {
          throw error;
        }

        await markSynced(
          item.entity,
          item.entity_id,
          item.id
        );

        syncedCount += 1;

        continue;
      }

      // ==========================================
      // CREATE OR UPDATE IN SUPABASE
      // ==========================================

      const payload =
        JSON.parse(item.payload);

      const {
        sync_status,
        ...cloudRecord
      } = payload;

      // Upload tenant documents before inserting the
      // document row because remote_path belongs to that row.
      if (
        item.entity ===
          'documents' &&
        cloudRecord.local_uri &&
        isLocalFile(
          cloudRecord.local_uri
        )
      ) {
        cloudRecord.remote_path =
          await uploadPrivateFile(
            membership.household_id,
            'documents',
            cloudRecord.id,
            cloudRecord.local_uri,
            cloudRecord.file_name,
            cloudRecord.mime_type
          );

        delete cloudRecord.local_uri;
      }

      // Never send an Android file:// or content:// URI to
      // Supabase. First create/update the database row without
      // the local photo path. This is especially important for
      // tenants: bills and documents can then reference the
      // tenant even if its photo upload needs to be retried.
      const localPhotoUri =
        cloudRecord.photo_uri &&
        isLocalFile(
          cloudRecord.photo_uri
        )
          ? cloudRecord.photo_uri
          : null;

      if (localPhotoUri) {
        delete cloudRecord.photo_uri;
      }

      // Bills have a second database uniqueness rule:
      // one bill per tenant per bill_month. Some older cloud data can
      // already contain the same business bill under a different id.
      // Resolve that explicitly instead of relying on PostgreSQL's
      // ON CONFLICT inference, which avoids error 23505.
      if (item.entity === 'bills') {
        const {
          data: existingBill,
          error: lookupError,
        } = await supabase
          .from('bills')
          .select('id')
          .eq(
            'tenant_id',
            cloudRecord.tenant_id
          )
          .eq(
            'bill_month',
            cloudRecord.bill_month
          )
          .maybeSingle();

        if (lookupError) {
          throw lookupError;
        }

        if (
          existingBill?.id &&
          existingBill.id !==
            cloudRecord.id
        ) {
          // Keep the cloud row's existing primary key. Updating its
          // other columns removes the tenant/month duplicate safely.
          const {
            id: _localBillId,
            ...billUpdate
          } = cloudRecord;

          const { error: updateError } =
            await supabase
              .from('bills')
              .update(billUpdate)
              .eq(
                'id',
                existingBill.id
              );

          if (updateError) {
            throw updateError;
          }
        } else {
          const { error: billError } =
            await supabase
              .from('bills')
              .upsert(cloudRecord);

          if (billError) {
            // Another sync/device may have inserted the same
            // tenant/month after our lookup. Recover once from
            // PostgreSQL unique-constraint error 23505.
            if (billError.code === '23505') {
              const {
                data: racedBill,
                error: racedLookupError,
              } = await supabase
                .from('bills')
                .select('id')
                .eq(
                  'tenant_id',
                  cloudRecord.tenant_id
                )
                .eq(
                  'bill_month',
                  cloudRecord.bill_month
                )
                .maybeSingle();

              if (
                racedLookupError ||
                !racedBill?.id
              ) {
                throw (
                  racedLookupError ||
                  billError
                );
              }

              const {
                id: _localBillId,
                ...billUpdate
              } = cloudRecord;

              const {
                error: racedUpdateError,
              } = await supabase
                .from('bills')
                .update(billUpdate)
                .eq('id', racedBill.id);

              if (racedUpdateError) {
                throw racedUpdateError;
              }
            } else {
              throw billError;
            }
          }
        }
      } else {
        const { error } =
          await supabase
            .from(item.entity)
            .upsert(cloudRecord);

        if (error) {
          throw error;
        }
      }

      // Upload a local floor/room/tenant photo only after its
      // cloud row exists. Android often reports local images as
      // application/octet-stream, so force a safe image type
      // when no usable MIME type can be detected.
      if (localPhotoUri) {
        const photoPath =
          await uploadPrivateFile(
            membership.household_id,
            item.entity,
            cloudRecord.id,
            localPhotoUri,
            `${item.entity}-${cloudRecord.id}.jpg`,
            'image/jpeg'
          );

        const {
          error: photoUpdateError,
        } = await supabase
          .from(item.entity)
          .update({
            photo_uri: photoPath,
          })
          .eq('id', cloudRecord.id);

        if (photoUpdateError) {
          throw photoUpdateError;
        }
      }

      await markSynced(
        item.entity,
        item.entity_id,
        item.id
      );

      syncedCount += 1;
    } catch (error) {
      // Keep failed records in the queue so they can be retried.
      if (isNetworkFailure(error)) {
        stoppedForNetwork = true;
        console.error(
          'Synchronization paused because the network or DNS is unavailable:',
          error
        );
        break;
      }

      console.error(
        `Synchronization failed for ${item.entity}:`,
        error
      );
    }
  }

  const pendingCount =
    orderedQueueItems.length -
    syncedCount;

  if (stoppedForNetwork) {
    return {
      synced: syncedCount,
      message:
        'Network unavailable. Pending changes are saved and will retry later.',
    };
  }

  // Refresh local records only when
  // every queued change was synchronized.
  if (
    pendingCount === 0
  ) {
    try {
      const cloudData =
        await loadCloudRecords();

      await replaceFromCloud(
        cloudData
      );
    } catch (error) {
      console.error(
        'Cloud refresh failed:',
        error
      );

      return {
        synced: syncedCount,
        message:
          `${syncedCount} change(s) synced; cloud refresh pending`,
      };
    }
  }

  if (pendingCount > 0) {
    return {
      synced: syncedCount,
      message:
        `${syncedCount} synced; ${pendingCount} change(s) pending`,
    };
  }

  return {
    synced: syncedCount,
    message:
      `${syncedCount} change(s) synced; shared records refreshed`,
  };
}

// Prevent two screens/effects from running the same queue at the
// same time. Concurrent syncs can both see a missing bill and race
// to insert the same tenant/month, which produces PostgreSQL 23505.
let activeSync: Promise<{
  synced: number;
  message: string;
}> | null = null;

export function syncPending() {
  if (activeSync) {
    return activeSync;
  }

  activeSync = runSyncPending().finally(
    () => {
      activeSync = null;
    }
  );

  return activeSync;
}
