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
    mimeType ||
    response.headers.get(
      'content-type'
    ) ||
    'application/octet-stream';

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

    cloudData[table] =
      data ?? [];
  }

  return cloudData;
}

export async function syncPending() {
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

  let syncedCount = 0;

  for (const item of queueItems) {
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

      // Upload tenant documents.
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

      // Upload floor, room or tenant photos.
      if (
        cloudRecord.photo_uri &&
        isLocalFile(
          cloudRecord.photo_uri
        )
      ) {
        cloudRecord.photo_uri =
          await uploadPrivateFile(
            membership.household_id,
            item.entity,
            cloudRecord.id,
            cloudRecord.photo_uri
          );
      }

      const { error } =
        await supabase
          .from(item.entity)
          .upsert(cloudRecord);

      if (error) {
        throw error;
      }

      await markSynced(
        item.entity,
        item.entity_id,
        item.id
      );

      syncedCount += 1;
    } catch (error) {
      // Keep failed records in the queue.
      // They will be retried next time.
      console.error(
        `Synchronization failed for ${item.entity}:`,
        error
      );
    }
  }

  const pendingCount =
    queueItems.length -
    syncedCount;

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