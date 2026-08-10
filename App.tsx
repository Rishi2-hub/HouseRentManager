import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Linking,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {initDb,listBills,listFloors,listRooms,listTenants} from './src/db/database';
import {supabase} from './src/lib/supabase';
import {syncPending} from './src/services/sync';
import {Bill,Floor,Room,Tab,Tenant} from './src/types';
import {colors} from './src/theme';
import {AuthScreen} from './src/screens/AuthScreen';
import {DashboardScreen} from './src/screens/DashboardScreen';
import {PropertiesScreen} from './src/screens/PropertiesScreen';
import {TenantsScreen} from './src/screens/TenantsScreen';
import {BillsScreen} from './src/screens/BillsScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
const tabs:Tab[]=['Dashboard','Properties','Tenants','Bills','Settings'];
export default function App(){
  const[ready,setReady]=useState(false),[logged,setLogged]=useState(false),[recovery,setRecovery]=useState(false),[tab,setTab]=useState<Tab>('Dashboard');
  const[floors,setFloors]=useState<Floor[]>([]),[rooms,setRooms]=useState<Room[]>([]),[tenants,setTenants]=useState<Tenant[]>([]),[bills,setBills]=useState<Bill[]>([]);
  const reload=useCallback(async()=>{setFloors(await listFloors());setRooms(await listRooms());setTenants(await listTenants());setBills(await listBills())},[]);
  const openAccount=useCallback(async(userId:string)=>{await initDb(userId);await syncPending();await reload();setLogged(true)},[reload]);
  const handleUrl=useCallback(async(url:string|null)=>{if(!url||!supabase)return;const params=new URLSearchParams((url.split('#')[1]||url.split('?')[1]||''));const access_token=params.get('access_token'),refresh_token=params.get('refresh_token'),type=params.get('type');if(access_token&&refresh_token){await supabase.auth.setSession({access_token,refresh_token});if(type==='recovery'||url.includes('reset-password'))setRecovery(true)}},[]);
  useEffect(()=>{(async()=>{await handleUrl(await Linking.getInitialURL());const session=(await supabase?.auth.getSession())?.data.session;if(session)await openAccount(session.user.id);setReady(true)})();const link=Linking.addEventListener('url',({url})=>{void handleUrl(url)});const sub=supabase?.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')setRecovery(true);if(session)setTimeout(()=>{void openAccount(session.user.id)},0);else setLogged(false)}).data.subscription;return()=>{link.remove();sub?.unsubscribe()}},[handleUrl,openAccount]);
  async function preview(){await initDb('preview');await reload();setLogged(true)}
  if(!ready)return <View style={s.loading}><ActivityIndicator size="large" color={colors.primary}/></View>;
  if(!logged||recovery)return <AuthScreen key={recovery?'recovery':'auth'} onOffline={preview} recovery={recovery} onRecoveryDone={()=>setRecovery(false)}/>;
  return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.top}><Text style={s.brand}>House Rent Manager</Text><Text style={s.offline}>● Local-first</Text></View><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{tab==='Dashboard'&&<DashboardScreen rooms={rooms} tenants={tenants} bills={bills}/>} {tab==='Properties'&&<PropertiesScreen floors={floors} rooms={rooms} reload={reload}/>} {tab==='Tenants'&&<TenantsScreen rooms={rooms} tenants={tenants} reload={reload}/>} {tab==='Bills'&&<BillsScreen tenants={tenants} bills={bills} reload={reload}/>} {tab==='Settings'&&<SettingsScreen onLogout={()=>setLogged(false)} onSynced={reload}/>}</ScrollView><View style={s.nav}>{tabs.map(x=><Pressable key={x} onPress={()=>setTab(x)} style={s.navItem}><Text style={[s.navText,tab===x&&s.navOn]}>{x}</Text></Pressable>)}</View></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},loading:{flex:1,alignItems:'center',justifyContent:'center'},top:{height:58,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:colors.border,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{fontSize:16,fontWeight:'900',color:colors.primaryDark},offline:{fontSize:11,color:colors.success,fontWeight:'700'},content:{padding:16,paddingBottom:28},nav:{height:62,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:colors.border,flexDirection:'row'},navItem:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:2},navText:{fontSize:10,color:colors.muted,fontWeight:'700'},navOn:{color:colors.primary,fontWeight:'900'}});
