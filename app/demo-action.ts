'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { demoEnabled, DEMO_SHOP_ID } from '@/lib/demo';
import { db } from '@/lib/db';
import { sessionToken } from '@/lib/session';
export async function openDemo() {
  if(!demoEnabled()) throw new Error('Démonstration indisponible');
  const shop=await db.shop.findUniqueOrThrow({where:{id:DEMO_SHOP_ID}});
  (await cookies()).set('stockify_session',sessionToken(shop.id),{httpOnly:true,sameSite:'lax',path:'/',maxAge:86400,secure:false});
  redirect('/inventory');
}
