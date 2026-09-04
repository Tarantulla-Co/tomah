import {redirect} from 'next/navigation';
export default async function Page({params}:{params:Promise<{slug:string}>}){redirect(`/products/${(await params).slug}`)}
