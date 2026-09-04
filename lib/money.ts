export function toMinor(value:string){const [whole='0',fraction='']=value.split('.');return BigInt(whole)*BigInt(100)+BigInt((fraction+'00').slice(0,2))}
export function fromMinor(value:bigint){return `${value/BigInt(100)}.${(value%BigInt(100)).toString().padStart(2,'0')}`}
export function formatMoney(value:string,currency:string){return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(value))}
