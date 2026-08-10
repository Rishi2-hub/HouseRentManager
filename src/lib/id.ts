export const makeId=()=>`${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
export const now=()=>new Date().toISOString();
