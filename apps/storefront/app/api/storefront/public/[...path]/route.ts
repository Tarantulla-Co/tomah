import {forwardPublicRequest} from '@/lib/api';
type Context={params:Promise<{path:string[]}>};
export async function GET(request:Request,{params}:Context){return forwardPublicRequest(request,(await params).path)}
export async function POST(request:Request,{params}:Context){return forwardPublicRequest(request,(await params).path)}
