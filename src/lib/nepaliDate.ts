import {adToBs} from '@sbmdkl/nepali-date-converter';

export const NEPALI_MONTHS=[
  'Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin',
  'Kartik','Mangsir','Poush','Magh','Falgun','Chaitra',
];

function convertedToday(){
  const today=new Date();
  const ad=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const converted=adToBs(ad);
  return typeof converted==='string'?converted:'';
}

export function currentBsMonth(){
  const value=convertedToday();
  return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(0,7):'2083-01';
}

export function shiftBsMonth(value:string,offset:number){
  const [year,month]=value.split('-').map(Number);
  const absolute=year*12+(month-1)+offset;
  const shiftedYear=Math.floor(absolute/12);
  const shiftedMonth=absolute%12+1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2,'0')}`;
}

export function previousBsMonth(){return shiftBsMonth(currentBsMonth(),-1)}

export function bsMonthLabel(value:string){
  const [year,month]=value.split('-').map(Number);
  if(!year||month<1||month>12)return value;
  if(year<2070)return `${value} AD (legacy bill)`;
  return `${NEPALI_MONTHS[month-1]} ${year} BS`;
}

export function recentBsMonths(count=13){
  const current=currentBsMonth();
  return Array.from({length:count},(_,index)=>shiftBsMonth(current,-index));
}
