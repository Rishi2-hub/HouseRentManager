import * as Network from 'expo-network';
import {getQueue,markSynced,replaceFromCloud} from '../db/database';
import {cloudConfigured,supabase} from '../lib/supabase';
const safeName=(value:string)=>value.replace(/[^a-zA-Z0-9._-]/g,'_');
async function uploadPrivateFile(householdId:string,entity:string,id:string,uri:string,fileName?:string,mimeType?:string){
  const name=safeName(fileName||uri.split('/').pop()||'upload.jpg');
  const path=`${householdId}/${entity}/${id}/${name}`;
  const response=await fetch(uri);
  const body=await response.arrayBuffer();
  const {error}=await supabase!.storage.from('tenant-private').upload(path,body,{contentType:mimeType||response.headers.get('content-type')||'application/octet-stream',upsert:true});
  if(error)throw error;
  return path;
}
export async function syncPending(){
  if(!cloudConfigured||!supabase)return {synced:0,message:'Cloud setup required'};
  const state=await Network.getNetworkStateAsync();
  if(!state.isConnected)return {synced:0,message:'Offline'};
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {synced:0,message:'Login required'};
  const {data:membership,error:membershipError}=await supabase.from('household_members').select('household_id').eq('user_id',user.id).single();
  if(membershipError||!membership)return {synced:0,message:'Household setup required'};
  const items=await getQueue();let synced=0;
  for(const item of items){
    try{
      const payload=JSON.parse(item.payload);
      const {sync_status,...cloud}=payload;
      if(item.entity==='documents'&&cloud.local_uri){
        cloud.remote_path=await uploadPrivateFile(membership.household_id,'documents',cloud.id,cloud.local_uri,cloud.file_name,cloud.mime_type);
        delete cloud.local_uri;
      }else if(cloud.photo_uri&&String(cloud.photo_uri).startsWith('file')){
        cloud.photo_uri=await uploadPrivateFile(membership.household_id,item.entity,cloud.id,cloud.photo_uri);
      }
      const {error}=await supabase.from(item.entity).upsert(cloud);
      if(error)throw error;
      await markSynced(item.entity,item.entity_id,item.id);synced++;
    }catch{/* Leave the record queued for the next retry. */}
  }
  if(items.length===synced){const tables=['floors','rooms','tenants','documents','bills'] as const;const cloud:any={};for(const table of tables){const{data,error}=await supabase.from(table).select('*');if(error)return{synced,message:`${synced} synced; cloud refresh pending`};cloud[table]=data??[];}await replaceFromCloud(cloud);}
  return {synced,message:items.length===synced?`${synced} change(s) synced; shared records refreshed`:`${synced} synced; ${items.length-synced} pending`};
}
